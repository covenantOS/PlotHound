import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'
import type { SubscriptionTier } from '@/types/database'
import Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

// Map Stripe price IDs to subscription tiers
function getTierFromPriceId(priceId: string): SubscriptionTier {
  // Build mapping at runtime to ensure env vars are available
  const priceToTier: Record<string, SubscriptionTier> = {}

  if (process.env.STRIPE_PRICE_RESEARCHER_MONTHLY) {
    priceToTier[process.env.STRIPE_PRICE_RESEARCHER_MONTHLY] = 'researcher'
  }
  if (process.env.STRIPE_PRICE_RESEARCHER_YEARLY) {
    priceToTier[process.env.STRIPE_PRICE_RESEARCHER_YEARLY] = 'researcher'
  }
  if (process.env.STRIPE_PRICE_INVESTIGATOR_MONTHLY) {
    priceToTier[process.env.STRIPE_PRICE_INVESTIGATOR_MONTHLY] = 'investigator'
  }
  if (process.env.STRIPE_PRICE_INVESTIGATOR_YEARLY) {
    priceToTier[process.env.STRIPE_PRICE_INVESTIGATOR_YEARLY] = 'investigator'
  }
  if (process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY) {
    priceToTier[process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY] = 'professional'
  }
  if (process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY) {
    priceToTier[process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY] = 'professional'
  }

  const tier = priceToTier[priceId]
  if (!tier) {
    console.warn(`[Stripe Webhook] Unknown price ID: ${priceId}. Known prices:`, Object.keys(priceToTier))
  }
  return tier || 'free'
}

// Helper to update user subscription by customer ID or user ID from metadata
async function updateUserSubscription(
  supabase: Awaited<ReturnType<typeof createServiceClient>>,
  customerId: string,
  updates: { subscription_tier: SubscriptionTier; stripe_subscription_id: string | null }
) {
  // First try to find by stripe_customer_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existingProfile, error: findError } = await (supabase as any)
    .from('profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (existingProfile) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('profiles')
      .update(updates)
      .eq('id', existingProfile.id)

    if (error) {
      console.error('[Stripe Webhook] Failed to update profile:', error)
      return false
    }
    console.log(`[Stripe Webhook] Updated subscription for profile ${existingProfile.id} to ${updates.subscription_tier}`)
    return true
  }

  // Fallback: Get user ID from customer metadata
  console.log(`[Stripe Webhook] Profile not found by customer ID ${customerId}, checking customer metadata...`)
  const customer = await stripe.customers.retrieve(customerId)

  if (customer.deleted) {
    console.error('[Stripe Webhook] Customer was deleted')
    return false
  }

  const supabaseUserId = customer.metadata?.supabase_user_id
  if (!supabaseUserId) {
    console.error('[Stripe Webhook] No supabase_user_id in customer metadata')
    return false
  }

  // Update by user ID and also save the customer ID for future lookups
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase as any)
    .from('profiles')
    .update({
      ...updates,
      stripe_customer_id: customerId,
    })
    .eq('id', supabaseUserId)

  if (error) {
    console.error('[Stripe Webhook] Failed to update profile by user ID:', error)
    return false
  }

  console.log(`[Stripe Webhook] Updated subscription for user ${supabaseUserId} to ${updates.subscription_tier}`)
  return true
}

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('[Stripe Webhook] Signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  console.log(`[Stripe Webhook] Received event: ${event.type}`)

  const supabase = await createServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        console.log(`[Stripe Webhook] Checkout completed for customer: ${session.customer}`)

        if (session.mode === 'subscription' && session.customer && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          const priceId = subscription.items.data[0]?.price.id
          const tier = getTierFromPriceId(priceId)

          console.log(`[Stripe Webhook] Price ID: ${priceId}, Tier: ${tier}`)

          await updateUserSubscription(supabase, session.customer as string, {
            subscription_tier: tier,
            stripe_subscription_id: subscription.id,
          })
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const priceId = subscription.items.data[0]?.price.id
        const tier = subscription.status === 'active' ? getTierFromPriceId(priceId) : 'free'

        console.log(`[Stripe Webhook] Subscription updated: status=${subscription.status}, tier=${tier}`)

        await updateUserSubscription(supabase, subscription.customer as string, {
          subscription_tier: tier,
          stripe_subscription_id: subscription.id,
        })
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription
        console.log(`[Stripe Webhook] Subscription deleted for customer: ${subscription.customer}`)

        await updateUserSubscription(supabase, subscription.customer as string, {
          subscription_tier: 'free',
          stripe_subscription_id: null,
        })
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        console.log('[Stripe Webhook] Payment failed for customer:', invoice.customer)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[Stripe Webhook] Handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

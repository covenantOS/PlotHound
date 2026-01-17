import { NextResponse } from 'next/server'
import { headers } from 'next/headers'
import { stripe } from '@/lib/stripe/client'
import { createServiceClient } from '@/lib/supabase/server'
import type { SubscriptionTier } from '@/types/database'
import Stripe from 'stripe'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

// Map Stripe price IDs to subscription tiers
function getTierFromPriceId(priceId: string): SubscriptionTier {
  const priceToTier: Record<string, SubscriptionTier> = {
    [process.env.STRIPE_PRICE_RESEARCHER_MONTHLY || '']: 'researcher',
    [process.env.STRIPE_PRICE_RESEARCHER_YEARLY || '']: 'researcher',
    [process.env.STRIPE_PRICE_INVESTIGATOR_MONTHLY || '']: 'investigator',
    [process.env.STRIPE_PRICE_INVESTIGATOR_YEARLY || '']: 'investigator',
    [process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY || '']: 'professional',
    [process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY || '']: 'professional',
  }

  return priceToTier[priceId] || 'free'
}

export async function POST(request: Request) {
  const body = await request.text()
  const headersList = await headers()
  const signature = headersList.get('stripe-signature')!

  let event: Stripe.Event

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret)
  } catch (err) {
    console.error('Webhook signature verification failed:', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  const supabase = await createServiceClient()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session

        if (session.mode === 'subscription' && session.customer && session.subscription) {
          const subscription = await stripe.subscriptions.retrieve(session.subscription as string)
          const priceId = subscription.items.data[0]?.price.id
          const tier = getTierFromPriceId(priceId)

          // Update user profile
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase as any)
            .from('profiles')
            .update({
              subscription_tier: tier,
              stripe_subscription_id: subscription.id,
            })
            .eq('stripe_customer_id', session.customer as string)
        }
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription
        const priceId = subscription.items.data[0]?.price.id
        const tier = subscription.status === 'active' ? getTierFromPriceId(priceId) : 'free'

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('profiles')
          .update({
            subscription_tier: tier,
            stripe_subscription_id: subscription.id,
          })
          .eq('stripe_customer_id', subscription.customer as string)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from('profiles')
          .update({
            subscription_tier: 'free',
            stripe_subscription_id: null,
          })
          .eq('stripe_customer_id', subscription.customer as string)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice
        // Optionally handle failed payments - could send notification, etc.
        console.log('Payment failed for customer:', invoice.customer)
        break
      }
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook handler error:', error)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }
}

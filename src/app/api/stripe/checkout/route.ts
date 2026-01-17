import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { stripe, createCheckoutSession, createCustomer } from '@/lib/stripe/client'
import { getPriceId } from '@/lib/subscription-limits'
import type { SubscriptionTier } from '@/types/database'

interface ProfileData {
  stripe_customer_id: string | null
  email: string
  full_name: string | null
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { tier, billing = 'monthly' } = body as {
      tier: SubscriptionTier
      billing: 'monthly' | 'yearly'
    }

    const priceId = getPriceId(tier, billing)

    if (!priceId) {
      return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
    }

    // Get or create Stripe customer
    const { data: profileData } = await supabase
      .from('profiles')
      .select('stripe_customer_id, email, full_name')
      .eq('id', user.id)
      .single()

    const profile = profileData as ProfileData | null

    let customerId = profile?.stripe_customer_id

    if (!customerId) {
      const customer = await createCustomer({
        email: profile?.email || user.email!,
        name: profile?.full_name || undefined,
        metadata: {
          supabase_user_id: user.id,
        },
      })

      customerId = customer.id

      // Save customer ID to profile using fresh client
      const updateClient = await createClient()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (updateClient as any)
        .from('profiles')
        .update({ stripe_customer_id: customerId })
        .eq('id', user.id)
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    const session = await createCheckoutSession({
      customerId,
      priceId,
      successUrl: `${baseUrl}/settings?success=true`,
      cancelUrl: `${baseUrl}/settings?canceled=true`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error('Checkout error:', error)
    return NextResponse.json(
      { error: 'Failed to create checkout session' },
      { status: 500 }
    )
  }
}

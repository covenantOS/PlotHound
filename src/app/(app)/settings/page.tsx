import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Sparkles } from 'lucide-react'
import { TIER_LIMITS } from '@/lib/subscription-limits'
import { formatBytes } from '@/lib/utils'
import { BillingPortalButton } from '@/components/settings/billing-portal-button'
import { UpgradeButton } from '@/components/settings/upgrade-button'
import { APIKeysForm } from '@/components/settings/api-keys-form'
import type { SubscriptionTier, Profile } from '@/types/database'

const PLANS: { tier: SubscriptionTier; name: string; price: number; features: string[] }[] = [
  {
    tier: 'free',
    name: 'Free',
    price: 0,
    features: [
      '1 family tree',
      '10 ancestors per tree',
      '100MB storage',
      'Basic research tracking',
    ],
  },
  {
    tier: 'researcher',
    name: 'Researcher',
    price: 10,
    features: [
      'Unlimited trees',
      'Unlimited ancestors',
      '1GB storage',
      'AI-powered summaries',
      'Export research data',
    ],
  },
  {
    tier: 'investigator',
    name: 'Investigator',
    price: 25,
    features: [
      'Everything in Researcher',
      '5GB storage',
      'AI Research Planner',
      'Hypothesis confidence scoring',
      'Brick wall analyzer',
      'Source suggestions',
    ],
  },
  {
    tier: 'professional',
    name: 'Professional',
    price: 99,
    features: [
      'Everything in Investigator',
      'Unlimited storage',
      'Priority support',
      'API access (coming soon)',
      'Team features (coming soon)',
    ],
  },
]

export default async function SettingsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const profile = profileData as Profile | null
  const currentTier = profile?.subscription_tier || 'free'
  const tierIndex = PLANS.findIndex(p => p.tier === currentTier)

  return (
    <>
      <Header profile={profile} title="Settings" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle>Account</CardTitle>
              <CardDescription>Your account information</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground">Email</label>
                <p>{profile?.email}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Name</label>
                <p>{profile?.full_name || 'Not set'}</p>
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground">Storage Used</label>
                <p>{formatBytes(profile?.storage_used_bytes || 0)} / {formatBytes(TIER_LIMITS[currentTier].maxStorageBytes)}</p>
              </div>
            </CardContent>
          </Card>

          {/* Current Plan */}
          <Card>
            <CardHeader>
              <CardTitle>Current Plan</CardTitle>
              <CardDescription>Manage your subscription</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Badge variant={currentTier === 'free' ? 'secondary' : 'default'} className="text-lg px-3 py-1">
                    {TIER_LIMITS[currentTier].displayName}
                  </Badge>
                  {currentTier !== 'free' && (
                    <span className="text-2xl font-bold">${TIER_LIMITS[currentTier].price}/mo</span>
                  )}
                </div>
                {profile?.stripe_subscription_id && (
                  <BillingPortalButton />
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                {currentTier === 'free'
                  ? 'Upgrade to unlock more features and storage.'
                  : 'Thank you for supporting PlotHound!'}
              </p>
            </CardContent>
          </Card>

          {/* Plans */}
          <div>
            <h2 className="font-serif text-2xl font-bold mb-4">Plans</h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {PLANS.map((plan, index) => {
                const isCurrent = plan.tier === currentTier
                const isDowngrade = index < tierIndex
                const isUpgrade = index > tierIndex

                return (
                  <Card
                    key={plan.tier}
                    className={isCurrent ? 'border-primary ring-1 ring-primary' : ''}
                  >
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{plan.name}</CardTitle>
                        {isCurrent && <Badge>Current</Badge>}
                      </div>
                      <CardDescription>
                        {plan.price === 0 ? (
                          <span className="text-2xl font-bold">Free</span>
                        ) : (
                          <>
                            <span className="text-2xl font-bold">${plan.price}</span>
                            <span className="text-muted-foreground">/mo</span>
                          </>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 mb-4">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm">
                            <Check className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                            {feature}
                          </li>
                        ))}
                      </ul>
                      {isCurrent ? (
                        <Button disabled className="w-full">
                          Current Plan
                        </Button>
                      ) : isUpgrade ? (
                        <UpgradeButton tier={plan.tier} />
                      ) : (
                        <Button variant="outline" className="w-full" disabled>
                          {isDowngrade ? 'Downgrade' : 'Select'}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )
              })}
            </div>
          </div>

          {/* AI API Keys */}
          <APIKeysForm
            initialData={{
              ai_provider: ((profile as Record<string, unknown>)?.ai_provider as 'anthropic' | 'openai' | 'google') || 'anthropic',
              anthropic_api_key: (profile as Record<string, unknown>)?.anthropic_api_key as string | null,
              openai_api_key: (profile as Record<string, unknown>)?.openai_api_key as string | null,
              google_api_key: (profile as Record<string, unknown>)?.google_api_key as string | null,
              use_own_api_key: ((profile as Record<string, unknown>)?.use_own_api_key as boolean) || false,
            }}
          />

          {/* AI Features Preview */}
          <Card className="bg-gradient-to-r from-primary/5 to-accent/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                AI-Powered Research
              </CardTitle>
              <CardDescription>
                Available on Researcher tier and above
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <h4 className="font-medium mb-1">Researcher ($10/mo)</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>AI-generated ancestor summaries</li>
                  </ul>
                </div>
                <div>
                  <h4 className="font-medium mb-1">Investigator ($25/mo)</h4>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>Personalized research plans</li>
                    <li>Hypothesis confidence scoring</li>
                    <li>Brick wall breakthrough analysis</li>
                    <li>Source recommendations</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

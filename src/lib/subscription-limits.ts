import type { SubscriptionTier } from '@/types/database'

export const TIER_LIMITS = {
  free: {
    maxTrees: 1,
    maxAncestorsPerTree: 10,
    maxStorageBytes: 100 * 1024 * 1024, // 100MB
    aiFeatures: false,
    advancedAiFeatures: false,
    canExport: false,
    displayName: 'Free',
    price: 0,
  },
  researcher: {
    maxTrees: Infinity,
    maxAncestorsPerTree: Infinity,
    maxStorageBytes: 1024 * 1024 * 1024, // 1GB
    aiFeatures: true, // basic: summarize ancestor
    advancedAiFeatures: false,
    canExport: true,
    displayName: 'Researcher',
    price: 10,
  },
  investigator: {
    maxTrees: Infinity,
    maxAncestorsPerTree: Infinity,
    maxStorageBytes: 5 * 1024 * 1024 * 1024, // 5GB
    aiFeatures: true,
    advancedAiFeatures: true, // research planner, brick wall analyzer, hypothesis scoring
    canExport: true,
    displayName: 'Investigator',
    price: 25,
  },
  professional: {
    maxTrees: Infinity,
    maxAncestorsPerTree: Infinity,
    maxStorageBytes: Infinity,
    aiFeatures: true,
    advancedAiFeatures: true,
    canExport: true,
    displayName: 'Professional',
    price: 99,
    // additional: client workspaces, team sharing, API access (implement later)
  },
} as const

export type TierLimits = typeof TIER_LIMITS[SubscriptionTier]

export function getTierLimits(tier: SubscriptionTier): TierLimits {
  return TIER_LIMITS[tier]
}

export function canAccessAiFeatures(tier: SubscriptionTier): boolean {
  return TIER_LIMITS[tier].aiFeatures
}

export function canAccessAdvancedAi(tier: SubscriptionTier): boolean {
  return TIER_LIMITS[tier].advancedAiFeatures
}

export function canCreateTree(tier: SubscriptionTier, currentTreeCount: number): boolean {
  const limits = TIER_LIMITS[tier]
  return limits.maxTrees === Infinity || currentTreeCount < limits.maxTrees
}

export function canAddAncestor(tier: SubscriptionTier, currentAncestorCount: number): boolean {
  const limits = TIER_LIMITS[tier]
  return limits.maxAncestorsPerTree === Infinity || currentAncestorCount < limits.maxAncestorsPerTree
}

export function canUploadFile(tier: SubscriptionTier, currentStorageBytes: number, fileSizeBytes: number): boolean {
  const limits = TIER_LIMITS[tier]
  return limits.maxStorageBytes === Infinity || (currentStorageBytes + fileSizeBytes) <= limits.maxStorageBytes
}

export function getUpgradeMessage(tier: SubscriptionTier, feature: string): string {
  const messages: Record<string, Record<string, string>> = {
    free: {
      trees: 'Upgrade to Researcher to create unlimited family trees.',
      ancestors: 'Upgrade to Researcher to add unlimited ancestors.',
      storage: 'Upgrade to Researcher for 1GB of storage.',
      ai: 'Upgrade to Researcher to unlock AI-powered summaries.',
      advancedAi: 'Upgrade to Investigator to unlock research planning and brick wall analysis.',
      export: 'Upgrade to Researcher to export your research.',
    },
    researcher: {
      advancedAi: 'Upgrade to Investigator to unlock research planning, hypothesis scoring, and brick wall analysis.',
      storage: 'Upgrade to Investigator for 5GB of storage.',
    },
    investigator: {
      storage: 'Upgrade to Professional for unlimited storage.',
    },
    professional: {},
  }

  return messages[tier]?.[feature] || 'Upgrade your plan to access this feature.'
}

// Stripe price mappings
export const STRIPE_PRICES = {
  researcher_monthly: process.env.STRIPE_PRICE_RESEARCHER_MONTHLY || '',
  researcher_yearly: process.env.STRIPE_PRICE_RESEARCHER_YEARLY || '',
  investigator_monthly: process.env.STRIPE_PRICE_INVESTIGATOR_MONTHLY || '',
  investigator_yearly: process.env.STRIPE_PRICE_INVESTIGATOR_YEARLY || '',
  professional_monthly: process.env.STRIPE_PRICE_PROFESSIONAL_MONTHLY || '',
  professional_yearly: process.env.STRIPE_PRICE_PROFESSIONAL_YEARLY || '',
} as const

export function getPriceId(tier: SubscriptionTier, billing: 'monthly' | 'yearly'): string {
  const key = `${tier}_${billing}` as keyof typeof STRIPE_PRICES
  return STRIPE_PRICES[key] || ''
}

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import type { SubscriptionTier } from '@/types/database'

interface UpgradeButtonProps {
  tier: SubscriptionTier
}

export function UpgradeButton({ tier }: UpgradeButtonProps) {
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const handleUpgrade = async () => {
    setIsLoading(true)

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tier, billing: 'monthly' }),
      })

      const data = await response.json()

      if (data.url) {
        window.location.href = data.url
      } else {
        throw new Error(data.error || 'Failed to create checkout session')
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Something went wrong',
      })
      setIsLoading(false)
    }
  }

  return (
    <Button onClick={handleUpgrade} disabled={isLoading} className="w-full">
      {isLoading ? 'Loading...' : 'Upgrade'}
    </Button>
  )
}

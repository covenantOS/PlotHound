'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Sparkles, Lock } from 'lucide-react'
import type { SubscriptionTier } from '@/types/database'

interface UpgradePromptProps {
  currentTier: SubscriptionTier
  feature: string
  message: string
  compact?: boolean
}

export function UpgradePrompt({ currentTier, feature, message, compact = false }: UpgradePromptProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        <Lock className="h-4 w-4" />
        <span>{message}</span>
        <Button size="sm" variant="outline" asChild className="ml-auto">
          <Link href="/settings">Upgrade</Link>
        </Button>
      </div>
    )
  }

  return (
    <Card className="border-dashed">
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Sparkles className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-lg">Unlock {feature}</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      <CardContent className="text-center">
        <Button asChild>
          <Link href="/settings">View Plans</Link>
        </Button>
      </CardContent>
    </Card>
  )
}

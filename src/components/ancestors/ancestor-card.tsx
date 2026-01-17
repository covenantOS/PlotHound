'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BrickWall, FileText, Search, Lightbulb, ArrowRight } from 'lucide-react'
import type { Ancestor } from '@/types/database'

interface AncestorWithCounts extends Ancestor {
  facts?: { count: number }[]
  sources_checked?: { count: number }[]
  hypotheses?: { count: number }[]
}

interface AncestorCardProps {
  ancestor: AncestorWithCounts
}

export function AncestorCard({ ancestor }: AncestorCardProps) {
  const factsCount = ancestor.facts?.[0]?.count || 0
  const sourcesCount = ancestor.sources_checked?.[0]?.count || 0
  const hypothesesCount = ancestor.hypotheses?.[0]?.count || 0

  const displayName = [ancestor.given_names, ancestor.surname].filter(Boolean).join(' ') || 'Unknown'
  const lifespan = [ancestor.birth_date, ancestor.death_date].filter(Boolean).join(' - ')

  return (
    <Link href={`/ancestor/${ancestor.id}`}>
      <Card className="h-full transition-all hover:shadow-md hover:border-primary/50">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="font-serif font-medium truncate">{displayName}</h3>
              {ancestor.maiden_name && (
                <p className="text-sm text-muted-foreground truncate">
                  (nee {ancestor.maiden_name})
                </p>
              )}
              {lifespan && (
                <p className="text-sm text-muted-foreground">{lifespan}</p>
              )}
            </div>
            {ancestor.is_brick_wall && (
              <Badge variant="destructive" className="ml-2 flex-shrink-0">
                <BrickWall className="mr-1 h-3 w-3" />
                Stuck
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {(ancestor.birth_place || ancestor.death_place) && (
            <p className="text-xs text-muted-foreground mb-3 line-clamp-1">
              {ancestor.birth_place || ancestor.death_place}
            </p>
          )}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1" title="Facts">
              <FileText className="h-3 w-3" />
              {factsCount}
            </span>
            <span className="flex items-center gap-1" title="Sources Checked">
              <Search className="h-3 w-3" />
              {sourcesCount}
            </span>
            <span className="flex items-center gap-1" title="Hypotheses">
              <Lightbulb className="h-3 w-3" />
              {hypothesesCount}
            </span>
            <ArrowRight className="ml-auto h-4 w-4" />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

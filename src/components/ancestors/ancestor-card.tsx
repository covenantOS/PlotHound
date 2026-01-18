'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BrickWall, FileText, Search, Lightbulb, ArrowRight, Users, Heart } from 'lucide-react'
import type { Ancestor } from '@/types/database'

interface AncestorWithCounts extends Ancestor {
  facts?: { count: number }[]
  sources_checked?: { count: number }[]
  hypotheses?: { count: number }[]
  // Relationship data from join
  father?: { given_names: string | null; surname: string | null } | null
  mother?: { given_names: string | null; surname: string | null } | null
}

interface AncestorCardProps {
  ancestor: AncestorWithCounts
  showRelationships?: boolean
}

export function AncestorCard({ ancestor, showRelationships = true }: AncestorCardProps) {
  const factsCount = ancestor.facts?.[0]?.count || 0
  const sourcesCount = ancestor.sources_checked?.[0]?.count || 0
  const hypothesesCount = ancestor.hypotheses?.[0]?.count || 0

  const displayName = [ancestor.given_names, ancestor.surname].filter(Boolean).join(' ') || 'Unknown'
  const lifespan = [ancestor.birth_date, ancestor.death_date].filter(Boolean).join(' - ')

  // Relationship info
  const hasParents = ancestor.father_id || ancestor.mother_id
  const hasSpouses = ancestor.spouse_ids && ancestor.spouse_ids.length > 0
  const spouseCount = ancestor.spouse_ids?.length || 0

  // Get parent names from joined data if available
  const fatherName = ancestor.father
    ? [ancestor.father.given_names, ancestor.father.surname].filter(Boolean).join(' ')
    : null
  const motherName = ancestor.mother
    ? [ancestor.mother.given_names, ancestor.mother.surname].filter(Boolean).join(' ')
    : null

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
            <p className="text-xs text-muted-foreground mb-2 line-clamp-1">
              {ancestor.birth_place || ancestor.death_place}
            </p>
          )}

          {/* Relationship info */}
          {showRelationships && (hasParents || hasSpouses) && (
            <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mb-2 pb-2 border-b">
              {(fatherName || motherName) && (
                <span className="flex items-center gap-1" title="Parents">
                  <Users className="h-3 w-3" />
                  {fatherName && motherName
                    ? `${fatherName} & ${motherName}`
                    : fatherName || motherName}
                </span>
              )}
              {!fatherName && !motherName && hasParents && (
                <span className="flex items-center gap-1 text-muted-foreground/70" title="Has parents linked">
                  <Users className="h-3 w-3" />
                  Parents linked
                </span>
              )}
              {hasSpouses && (
                <span className="flex items-center gap-1" title="Spouses">
                  <Heart className="h-3 w-3" />
                  {spouseCount} spouse{spouseCount > 1 ? 's' : ''}
                </span>
              )}
            </div>
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

'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Users, User, Heart } from 'lucide-react'
import type { Ancestor } from '@/types/database'

interface RelationshipsDisplayProps {
  ancestor: Ancestor
  father?: Ancestor | null
  mother?: Ancestor | null
  spouses?: Ancestor[]
  children?: Ancestor[]
}

export function RelationshipsDisplay({
  ancestor,
  father,
  mother,
  spouses = [],
  children = [],
}: RelationshipsDisplayProps) {
  const hasParents = father || mother
  const hasSpouses = spouses.length > 0
  const hasChildren = children.length > 0
  const hasRelationships = hasParents || hasSpouses || hasChildren

  if (!hasRelationships) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Family Connections
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            No family relationships recorded yet. Use the Edit button to add parents or spouses.
          </p>
        </CardContent>
      </Card>
    )
  }

  const PersonLink = ({ person, label }: { person: Ancestor; label: string }) => {
    const name = [person.given_names, person.surname].filter(Boolean).join(' ') || 'Unknown'
    return (
      <Link
        href={`/ancestor/${person.id}`}
        className="flex items-center gap-2 p-2 rounded-md hover:bg-muted transition-colors"
      >
        <User className="h-4 w-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{name}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
        {person.is_brick_wall && (
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
            Stuck
          </Badge>
        )}
      </Link>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Family Connections
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Parents */}
        {hasParents && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Parents
            </h4>
            <div className="grid gap-1 sm:grid-cols-2">
              {father && <PersonLink person={father} label="Father" />}
              {mother && <PersonLink person={mother} label="Mother" />}
            </div>
          </div>
        )}

        {/* Spouses */}
        {hasSpouses && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Heart className="h-3 w-3" />
              Spouse{spouses.length > 1 ? 's' : ''}
            </h4>
            <div className="grid gap-1 sm:grid-cols-2">
              {spouses.map(spouse => (
                <PersonLink
                  key={spouse.id}
                  person={spouse}
                  label={spouse.birth_date ? `b. ${spouse.birth_date}` : 'Spouse'}
                />
              ))}
            </div>
          </div>
        )}

        {/* Children */}
        {hasChildren && (
          <div>
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Children
            </h4>
            <div className="grid gap-1 sm:grid-cols-2">
              {children.map(child => (
                <PersonLink
                  key={child.id}
                  person={child}
                  label={child.birth_date ? `b. ${child.birth_date}` : 'Child'}
                />
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

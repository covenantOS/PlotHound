'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { BrickWall, Users, Heart } from 'lucide-react'
import type { Ancestor } from '@/types/database'

interface AncestorWithCounts extends Ancestor {
  facts?: { count: number }[]
  sources_checked?: { count: number }[]
  hypotheses?: { count: number }[]
}

interface TreeViewProps {
  ancestors: AncestorWithCounts[]
  treeId: string
}

interface TreeNode {
  ancestor: AncestorWithCounts
  children: TreeNode[]
  spouse?: AncestorWithCounts
}

export function TreeView({ ancestors, treeId }: TreeViewProps) {
  // Build tree structure
  const { roots, orphans, stats } = useMemo(() => {
    if (!ancestors || ancestors.length === 0) {
      return { roots: [], orphans: [], stats: { people: 0, connections: 0 } }
    }

    const ancestorMap = new Map<string, AncestorWithCounts>()
    ancestors.forEach(a => ancestorMap.set(a.id, a))

    // Find children for each ancestor
    const childrenMap = new Map<string, string[]>()
    let connectionCount = 0

    ancestors.forEach(a => {
      if (a.father_id && ancestorMap.has(a.father_id)) {
        const existing = childrenMap.get(a.father_id) || []
        existing.push(a.id)
        childrenMap.set(a.father_id, existing)
        connectionCount++
      }
      if (a.mother_id && ancestorMap.has(a.mother_id)) {
        const existing = childrenMap.get(a.mother_id) || []
        if (!existing.includes(a.id)) {
          existing.push(a.id)
          childrenMap.set(a.mother_id, existing)
          connectionCount++
        }
      }
      if (a.spouse_ids && a.spouse_ids.length > 0) {
        connectionCount += a.spouse_ids.filter(id => ancestorMap.has(id)).length
      }
    })

    // Find root ancestors (no parents in tree)
    const rootAncestors = ancestors.filter(a => {
      const hasParentInTree = (a.father_id && ancestorMap.has(a.father_id)) ||
                              (a.mother_id && ancestorMap.has(a.mother_id))
      return !hasParentInTree
    })

    // Track which ancestors are placed in the tree
    const placedIds = new Set<string>()

    // Build tree nodes recursively
    function buildNode(ancestor: AncestorWithCounts): TreeNode {
      placedIds.add(ancestor.id)

      const childIds = childrenMap.get(ancestor.id) || []
      const children: TreeNode[] = []

      for (const childId of childIds) {
        if (!placedIds.has(childId)) {
          const child = ancestorMap.get(childId)
          if (child) {
            children.push(buildNode(child))
          }
        }
      }

      // Find spouse
      let spouse: AncestorWithCounts | undefined
      if (ancestor.spouse_ids && ancestor.spouse_ids.length > 0) {
        for (const spouseId of ancestor.spouse_ids) {
          if (!placedIds.has(spouseId) && ancestorMap.has(spouseId)) {
            spouse = ancestorMap.get(spouseId)
            if (spouse) {
              placedIds.add(spouseId)
              // Also add spouse's children
              const spouseChildIds = childrenMap.get(spouseId) || []
              for (const childId of spouseChildIds) {
                if (!placedIds.has(childId)) {
                  const child = ancestorMap.get(childId)
                  if (child) {
                    children.push(buildNode(child))
                  }
                }
              }
            }
            break
          }
        }
      }

      return { ancestor, children, spouse }
    }

    // Build trees from roots
    const trees: TreeNode[] = []
    for (const root of rootAncestors) {
      if (!placedIds.has(root.id)) {
        trees.push(buildNode(root))
      }
    }

    // Find orphans (not connected to any tree)
    const orphanAncestors = ancestors.filter(a => !placedIds.has(a.id))

    return {
      roots: trees,
      orphans: orphanAncestors,
      stats: { people: ancestors.length, connections: connectionCount / 2 } // Divide by 2 since we count both directions
    }
  }, [ancestors])

  if (ancestors.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        No ancestors to display
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>{stats.people} people</span>
        <span>{Math.round(stats.connections)} connections</span>
        {orphans.length > 0 && (
          <Badge variant="outline" className="text-orange-600">
            {orphans.length} unconnected
          </Badge>
        )}
      </div>

      {/* Tree(s) */}
      {roots.length > 0 ? (
        <div className="space-y-8">
          {roots.map((root, idx) => (
            <div key={root.ancestor.id} className="relative">
              {idx > 0 && <div className="border-t my-6" />}
              <FamilyTree node={root} />
            </div>
          ))}
        </div>
      ) : (
        <Card className="p-6 text-center text-muted-foreground">
          <p>No family connections detected yet.</p>
          <p className="text-sm mt-2">Use "Auto-Detect Relationships" or manually set parent/spouse relationships when editing ancestors.</p>
        </Card>
      )}

      {/* Orphans (unconnected ancestors) */}
      {orphans.length > 0 && (
        <div className="mt-8">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">
            Unconnected Ancestors ({orphans.length})
          </h3>
          <div className="flex flex-wrap gap-3">
            {orphans.map(ancestor => (
              <PersonCard key={ancestor.id} ancestor={ancestor} size="small" />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function FamilyTree({ node }: { node: TreeNode }) {
  return (
    <div className="flex flex-col items-center">
      {/* Parents row */}
      <div className="flex items-center gap-2">
        <PersonCard ancestor={node.ancestor} />
        {node.spouse && (
          <>
            <div className="w-8 h-0.5 bg-primary" title="Married" />
            <PersonCard ancestor={node.spouse} />
          </>
        )}
      </div>

      {/* Connector to children */}
      {node.children.length > 0 && (
        <>
          <div className="w-0.5 h-6 bg-muted-foreground/50" />

          {/* Horizontal connector for multiple children */}
          {node.children.length > 1 && (
            <div
              className="h-0.5 bg-muted-foreground/50"
              style={{ width: `${Math.min(node.children.length * 200, 800)}px` }}
            />
          )}

          {/* Children row */}
          <div className="flex flex-wrap justify-center gap-6 mt-1">
            {node.children.map(child => (
              <div key={child.ancestor.id} className="flex flex-col items-center">
                <div className="w-0.5 h-4 bg-muted-foreground/50" />
                <FamilyTree node={child} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function PersonCard({
  ancestor,
  size = 'normal'
}: {
  ancestor: AncestorWithCounts
  size?: 'normal' | 'small'
}) {
  const name = [ancestor.given_names, ancestor.surname].filter(Boolean).join(' ') || 'Unknown'
  const dates = [ancestor.birth_date, ancestor.death_date].filter(Boolean).join(' – ')

  const isSmall = size === 'small'

  return (
    <Link href={`/ancestor/${ancestor.id}`}>
      <Card className={`
        hover:border-primary hover:shadow-md transition-all cursor-pointer
        ${isSmall ? 'p-2 min-w-[120px]' : 'p-3 min-w-[160px]'}
        ${ancestor.is_brick_wall ? 'border-destructive/50' : ''}
      `}>
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <p className={`font-medium truncate ${isSmall ? 'text-xs' : 'text-sm'}`}>
              {name}
            </p>
            {ancestor.maiden_name && (
              <p className="text-[10px] text-muted-foreground truncate">
                née {ancestor.maiden_name}
              </p>
            )}
            {dates && (
              <p className={`text-muted-foreground truncate ${isSmall ? 'text-[10px]' : 'text-xs'}`}>
                {dates}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            {ancestor.spouse_ids && ancestor.spouse_ids.length > 0 && (
              <Heart className="h-3 w-3 text-pink-500" />
            )}
            {(ancestor.father_id || ancestor.mother_id) && (
              <Users className="h-3 w-3 text-blue-500" />
            )}
            {ancestor.is_brick_wall && (
              <BrickWall className="h-3 w-3 text-destructive" />
            )}
          </div>
        </div>
      </Card>
    </Link>
  )
}

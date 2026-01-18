'use client'

import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { BrickWall, FileText, Search, Lightbulb, ExternalLink, ChevronUp, ChevronDown } from 'lucide-react'
import type { Ancestor } from '@/types/database'
import { useState } from 'react'

interface AncestorWithCounts extends Ancestor {
  facts?: { count: number }[]
  sources_checked?: { count: number }[]
  hypotheses?: { count: number }[]
}

interface ListViewProps {
  ancestors: AncestorWithCounts[]
  treeId: string
}

type SortField = 'name' | 'birth' | 'death' | 'facts' | 'sources' | 'priority'
type SortDirection = 'asc' | 'desc'

export function ListView({ ancestors, treeId }: ListViewProps) {
  const [sortField, setSortField] = useState<SortField>('name')
  const [sortDir, setSortDir] = useState<SortDirection>('asc')

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
    }
  }

  const sortedAncestors = [...ancestors].sort((a, b) => {
    let comparison = 0

    switch (sortField) {
      case 'name':
        const nameA = `${a.surname || ''} ${a.given_names || ''}`.toLowerCase()
        const nameB = `${b.surname || ''} ${b.given_names || ''}`.toLowerCase()
        comparison = nameA.localeCompare(nameB)
        break
      case 'birth':
        comparison = (a.birth_date || '').localeCompare(b.birth_date || '')
        break
      case 'death':
        comparison = (a.death_date || '').localeCompare(b.death_date || '')
        break
      case 'facts':
        comparison = (a.facts?.[0]?.count || 0) - (b.facts?.[0]?.count || 0)
        break
      case 'sources':
        comparison = (a.sources_checked?.[0]?.count || 0) - (b.sources_checked?.[0]?.count || 0)
        break
      case 'priority':
        comparison = (b.research_priority || 0) - (a.research_priority || 0)
        break
    }

    return sortDir === 'asc' ? comparison : -comparison
  })

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return sortDir === 'asc' ? (
      <ChevronUp className="h-3 w-3 inline ml-1" />
    ) : (
      <ChevronDown className="h-3 w-3 inline ml-1" />
    )
  }

  const SortButton = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <button
      className="flex items-center hover:text-foreground transition-colors"
      onClick={() => handleSort(field)}
    >
      {children}
      <SortIcon field={field} />
    </button>
  )

  if (ancestors.length === 0) {
    return (
      <div className="flex items-center justify-center h-48 text-muted-foreground">
        No ancestors to display
      </div>
    )
  }

  return (
    <div className="border rounded-lg">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-[250px]">
              <SortButton field="name">Name</SortButton>
            </TableHead>
            <TableHead className="w-[120px]">
              <SortButton field="birth">Birth</SortButton>
            </TableHead>
            <TableHead className="w-[120px]">
              <SortButton field="death">Death</SortButton>
            </TableHead>
            <TableHead className="w-[150px]">Location</TableHead>
            <TableHead className="w-[80px] text-center">
              <SortButton field="facts">
                <span className="flex items-center gap-1">
                  <FileText className="h-3 w-3" /> Facts
                </span>
              </SortButton>
            </TableHead>
            <TableHead className="w-[80px] text-center">
              <SortButton field="sources">
                <span className="flex items-center gap-1">
                  <Search className="h-3 w-3" /> Sources
                </span>
              </SortButton>
            </TableHead>
            <TableHead className="w-[80px]">Status</TableHead>
            <TableHead className="w-[60px]"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedAncestors.map((ancestor) => {
            const displayName = [ancestor.given_names, ancestor.surname].filter(Boolean).join(' ') || 'Unknown'
            const factsCount = ancestor.facts?.[0]?.count || 0
            const sourcesCount = ancestor.sources_checked?.[0]?.count || 0
            const location = ancestor.birth_place || ancestor.death_place || '-'

            return (
              <TableRow key={ancestor.id} className="hover:bg-muted/50">
                <TableCell>
                  <div>
                    <Link
                      href={`/ancestor/${ancestor.id}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {displayName}
                    </Link>
                    {ancestor.maiden_name && (
                      <span className="text-muted-foreground text-sm ml-1">
                        (nee {ancestor.maiden_name})
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-sm">
                  {ancestor.birth_date || '-'}
                </TableCell>
                <TableCell className="text-sm">
                  {ancestor.death_date || '-'}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground truncate max-w-[150px]" title={location}>
                  {location}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="text-xs">
                    {factsCount}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant="outline" className="text-xs">
                    {sourcesCount}
                  </Badge>
                </TableCell>
                <TableCell>
                  {ancestor.is_brick_wall && (
                    <Badge variant="destructive" className="text-xs">
                      <BrickWall className="mr-1 h-3 w-3" />
                      Stuck
                    </Badge>
                  )}
                </TableCell>
                <TableCell>
                  <Link href={`/ancestor/${ancestor.id}`}>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </Link>
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

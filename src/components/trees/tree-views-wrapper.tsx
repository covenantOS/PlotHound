'use client'

import { useState } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TreeView } from './tree-view'
import { ListView } from './list-view'
import { AncestorCard } from '@/components/ancestors/ancestor-card'
import { GitBranch, List, LayoutGrid } from 'lucide-react'
import type { Ancestor } from '@/types/database'

interface AncestorWithCounts extends Ancestor {
  facts?: { count: number }[]
  sources_checked?: { count: number }[]
  hypotheses?: { count: number }[]
}

interface TreeViewsWrapperProps {
  ancestors: AncestorWithCounts[]
  treeId: string
}

export function TreeViewsWrapper({ ancestors, treeId }: TreeViewsWrapperProps) {
  const [view, setView] = useState<'tree' | 'list' | 'grid'>('tree')

  return (
    <Tabs value={view} onValueChange={(v) => setView(v as 'tree' | 'list' | 'grid')}>
      <TabsList className="mb-4">
        <TabsTrigger value="tree" className="flex items-center gap-2">
          <GitBranch className="h-4 w-4" />
          Tree
        </TabsTrigger>
        <TabsTrigger value="list" className="flex items-center gap-2">
          <List className="h-4 w-4" />
          List
        </TabsTrigger>
        <TabsTrigger value="grid" className="flex items-center gap-2">
          <LayoutGrid className="h-4 w-4" />
          Cards
        </TabsTrigger>
      </TabsList>

      <TabsContent value="tree" className="mt-0">
        <TreeView ancestors={ancestors} treeId={treeId} />
      </TabsContent>

      <TabsContent value="list" className="mt-0">
        <ListView ancestors={ancestors} treeId={treeId} />
      </TabsContent>

      <TabsContent value="grid" className="mt-0">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {ancestors.map((ancestor) => (
            <AncestorCard key={ancestor.id} ancestor={ancestor} />
          ))}
        </div>
      </TabsContent>
    </Tabs>
  )
}

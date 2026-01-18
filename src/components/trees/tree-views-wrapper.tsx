'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/use-toast'
import { TreeView } from './tree-view'
import { ListView } from './list-view'
import { AncestorCard } from '@/components/ancestors/ancestor-card'
import { GitBranch, List, LayoutGrid, Wand2, Loader2 } from 'lucide-react'
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
  const [isDetecting, setIsDetecting] = useState(false)
  const { toast } = useToast()
  const router = useRouter()

  const detectRelationships = async () => {
    setIsDetecting(true)
    try {
      const response = await fetch('/api/ai/detect-relationships', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ treeId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to detect relationships')
      }

      toast({
        title: 'Relationships detected',
        description: `Analyzed ${data.analyzed} people, updated ${data.updated} relationships.`,
      })

      router.refresh()
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Something went wrong',
      })
    }
    setIsDetecting(false)
  }

  return (
    <Tabs value={view} onValueChange={(v) => setView(v as 'tree' | 'list' | 'grid')}>
      <div className="flex items-center justify-between mb-4">
        <TabsList>
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

        <Button
          variant="outline"
          size="sm"
          onClick={detectRelationships}
          disabled={isDetecting || ancestors.length < 2}
        >
          {isDetecting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Detecting...
            </>
          ) : (
            <>
              <Wand2 className="mr-2 h-4 w-4" />
              Auto-Detect Relationships
            </>
          )}
        </Button>
      </div>

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

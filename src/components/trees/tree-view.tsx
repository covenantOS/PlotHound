'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BrickWall, ZoomIn, ZoomOut, Maximize2, ChevronDown, ChevronUp } from 'lucide-react'
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
  x: number
  y: number
  children: TreeNode[]
  spouses: AncestorWithCounts[]
  level: number
}

const NODE_WIDTH = 180
const NODE_HEIGHT = 80
const HORIZONTAL_GAP = 40
const VERTICAL_GAP = 100
const SPOUSE_GAP = 20

export function TreeView({ ancestors, treeId }: TreeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  // Build tree structure from ancestors
  const buildTree = useCallback(() => {
    if (!ancestors || ancestors.length === 0) return { nodes: [], connections: [], width: 0, height: 0 }

    // Create a map for quick lookup
    const ancestorMap = new Map<string, AncestorWithCounts>()
    ancestors.forEach(a => ancestorMap.set(a.id, a))

    // Find root nodes (those without parents in our set, or marked as "Self")
    const childIds = new Set<string>()
    ancestors.forEach(a => {
      if (a.father_id) childIds.add(a.father_id)
      if (a.mother_id) childIds.add(a.mother_id)
    })

    // People who have children in the tree or no parents
    let rootAncestors = ancestors.filter(a => !a.father_id && !a.mother_id)

    // If no clear roots, start from people with the most descendants
    if (rootAncestors.length === 0) {
      rootAncestors = ancestors.filter(a => childIds.has(a.id))
    }

    // Still nothing? Just use all ancestors
    if (rootAncestors.length === 0) {
      rootAncestors = [...ancestors]
    }

    // Group by generation/level based on parent-child relationships
    const levels: Map<string, number> = new Map()
    const visited = new Set<string>()

    // BFS to assign levels
    const assignLevels = (startId: string, startLevel: number) => {
      const queue: { id: string; level: number }[] = [{ id: startId, level: startLevel }]

      while (queue.length > 0) {
        const { id, level } = queue.shift()!
        if (visited.has(id)) continue
        visited.add(id)

        const currentLevel = levels.get(id)
        if (currentLevel === undefined || level < currentLevel) {
          levels.set(id, level)
        }

        const ancestor = ancestorMap.get(id)
        if (!ancestor) continue

        // Children are one level down
        ancestors.forEach(a => {
          if (a.father_id === id || a.mother_id === id) {
            queue.push({ id: a.id, level: level + 1 })
          }
        })

        // Parents are one level up
        if (ancestor.father_id && ancestorMap.has(ancestor.father_id)) {
          queue.push({ id: ancestor.father_id, level: level - 1 })
        }
        if (ancestor.mother_id && ancestorMap.has(ancestor.mother_id)) {
          queue.push({ id: ancestor.mother_id, level: level - 1 })
        }
      }
    }

    // Start from each root and assign levels
    rootAncestors.forEach((root, idx) => {
      if (!visited.has(root.id)) {
        assignLevels(root.id, 0)
      }
    })

    // Assign remaining unvisited ancestors
    ancestors.forEach(a => {
      if (!levels.has(a.id)) {
        levels.set(a.id, 0)
      }
    })

    // Normalize levels to start from 0
    const minLevel = Math.min(...Array.from(levels.values()))
    levels.forEach((level, id) => {
      levels.set(id, level - minLevel)
    })

    // Group ancestors by level
    const levelGroups: Map<number, AncestorWithCounts[]> = new Map()
    ancestors.forEach(a => {
      const level = levels.get(a.id) || 0
      if (!levelGroups.has(level)) {
        levelGroups.set(level, [])
      }
      levelGroups.get(level)!.push(a)
    })

    // Position nodes
    const nodes: { ancestor: AncestorWithCounts; x: number; y: number; level: number }[] = []
    const positions: Map<string, { x: number; y: number }> = new Map()

    let maxWidth = 0
    const sortedLevels = Array.from(levelGroups.keys()).sort((a, b) => a - b)

    sortedLevels.forEach(level => {
      const group = levelGroups.get(level)!
      const totalWidth = group.length * NODE_WIDTH + (group.length - 1) * HORIZONTAL_GAP
      maxWidth = Math.max(maxWidth, totalWidth)
    })

    sortedLevels.forEach(level => {
      const group = levelGroups.get(level)!
      const totalWidth = group.length * NODE_WIDTH + (group.length - 1) * HORIZONTAL_GAP
      const startX = (maxWidth - totalWidth) / 2

      group.forEach((ancestor, idx) => {
        const x = startX + idx * (NODE_WIDTH + HORIZONTAL_GAP)
        const y = level * (NODE_HEIGHT + VERTICAL_GAP)
        nodes.push({ ancestor, x, y, level })
        positions.set(ancestor.id, { x, y })
      })
    })

    // Generate connections
    const connections: { from: { x: number; y: number }; to: { x: number; y: number }; type: 'parent' | 'spouse' }[] = []

    ancestors.forEach(a => {
      const childPos = positions.get(a.id)
      if (!childPos) return

      // Connect to father
      if (a.father_id) {
        const fatherPos = positions.get(a.father_id)
        if (fatherPos) {
          connections.push({
            from: { x: fatherPos.x + NODE_WIDTH / 2, y: fatherPos.y + NODE_HEIGHT },
            to: { x: childPos.x + NODE_WIDTH / 2, y: childPos.y },
            type: 'parent'
          })
        }
      }

      // Connect to mother
      if (a.mother_id) {
        const motherPos = positions.get(a.mother_id)
        if (motherPos) {
          connections.push({
            from: { x: motherPos.x + NODE_WIDTH / 2, y: motherPos.y + NODE_HEIGHT },
            to: { x: childPos.x + NODE_WIDTH / 2, y: childPos.y },
            type: 'parent'
          })
        }
      }

      // Connect spouses
      if (a.spouse_ids && a.spouse_ids.length > 0) {
        a.spouse_ids.forEach(spouseId => {
          const spousePos = positions.get(spouseId)
          if (spousePos && a.id < spouseId) { // Only draw once
            connections.push({
              from: { x: childPos.x + NODE_WIDTH, y: childPos.y + NODE_HEIGHT / 2 },
              to: { x: spousePos.x, y: spousePos.y + NODE_HEIGHT / 2 },
              type: 'spouse'
            })
          }
        })
      }
    })

    const maxLevel = Math.max(...sortedLevels)
    const height = (maxLevel + 1) * (NODE_HEIGHT + VERTICAL_GAP)

    return { nodes, connections, width: maxWidth + NODE_WIDTH, height }
  }, [ancestors])

  const { nodes, connections, width, height } = buildTree()

  // Pan and zoom handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true)
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y })
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y })
    }
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setZoom(z => Math.min(Math.max(0.3, z * delta), 2))
  }

  const resetView = () => {
    setZoom(1)
    setPan({ x: 0, y: 0 })
  }

  if (ancestors.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        No ancestors to display
      </div>
    )
  }

  return (
    <div className="relative h-full min-h-[600px] border rounded-lg bg-muted/20 overflow-hidden">
      {/* Controls */}
      <div className="absolute top-4 right-4 z-10 flex gap-2">
        <Button variant="outline" size="icon" onClick={() => setZoom(z => Math.min(z * 1.2, 2))}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={() => setZoom(z => Math.max(z * 0.8, 0.3))}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={resetView}>
          <Maximize2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Zoom indicator */}
      <div className="absolute bottom-4 right-4 z-10 px-2 py-1 bg-background/80 rounded text-xs">
        {Math.round(zoom * 100)}%
      </div>

      {/* Tree canvas */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing overflow-hidden"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
      >
        <div
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transformOrigin: 'center center',
            width: width + 100,
            height: height + 100,
            padding: 50,
          }}
        >
          {/* SVG for connections */}
          <svg
            className="absolute pointer-events-none"
            style={{ width: width + 100, height: height + 100, left: 0, top: 0 }}
          >
            {connections.map((conn, idx) => {
              if (conn.type === 'spouse') {
                // Horizontal dashed line for spouses
                return (
                  <line
                    key={idx}
                    x1={conn.from.x + 50}
                    y1={conn.from.y + 50}
                    x2={conn.to.x + 50}
                    y2={conn.to.y + 50}
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                    strokeDasharray="5,5"
                  />
                )
              }

              // Curved line for parent-child
              const midY = (conn.from.y + conn.to.y) / 2 + 50
              return (
                <path
                  key={idx}
                  d={`M ${conn.from.x + 50} ${conn.from.y + 50}
                      C ${conn.from.x + 50} ${midY},
                        ${conn.to.x + 50} ${midY},
                        ${conn.to.x + 50} ${conn.to.y + 50}`}
                  fill="none"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth="2"
                />
              )
            })}
          </svg>

          {/* Nodes */}
          {nodes.map(({ ancestor, x, y }) => (
            <Link
              key={ancestor.id}
              href={`/ancestor/${ancestor.id}`}
              className="absolute block"
              style={{ left: x + 50, top: y + 50, width: NODE_WIDTH, height: NODE_HEIGHT }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="h-full bg-card border rounded-lg shadow-sm hover:shadow-md hover:border-primary/50 transition-all p-3 flex flex-col justify-between">
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <h4 className="font-medium text-sm truncate flex-1">
                      {[ancestor.given_names, ancestor.surname].filter(Boolean).join(' ') || 'Unknown'}
                    </h4>
                    {ancestor.is_brick_wall && (
                      <BrickWall className="h-3 w-3 text-destructive flex-shrink-0" />
                    )}
                  </div>
                  {ancestor.maiden_name && (
                    <p className="text-xs text-muted-foreground truncate">
                      (nee {ancestor.maiden_name})
                    </p>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {[ancestor.birth_date, ancestor.death_date].filter(Boolean).join(' - ')}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

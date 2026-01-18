'use client'

import { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { BrickWall, ZoomIn, ZoomOut, Maximize2, Home } from 'lucide-react'
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

interface PositionedNode {
  ancestor: AncestorWithCounts
  x: number
  y: number
  generation: number
}

interface Connection {
  fromId: string
  toId: string
  fromX: number
  fromY: number
  toX: number
  toY: number
  type: 'parent-child' | 'spouse'
}

const NODE_WIDTH = 160
const NODE_HEIGHT = 72
const H_SPACING = 30
const V_SPACING = 120

export function TreeView({ ancestors, treeId }: TreeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.8 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0, transformX: 0, transformY: 0 })
  const [containerSize, setContainerSize] = useState({ width: 800, height: 600 })

  // Resize observer
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Build the tree structure
  const { nodes, connections, bounds } = useMemo(() => {
    if (!ancestors || ancestors.length === 0) {
      return { nodes: [], connections: [], bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 } }
    }

    const ancestorMap = new Map<string, AncestorWithCounts>()
    ancestors.forEach(a => ancestorMap.set(a.id, a))

    // Find children for each ancestor
    const childrenMap = new Map<string, string[]>()
    ancestors.forEach(a => {
      if (a.father_id) {
        const existing = childrenMap.get(a.father_id) || []
        existing.push(a.id)
        childrenMap.set(a.father_id, existing)
      }
      if (a.mother_id) {
        const existing = childrenMap.get(a.mother_id) || []
        if (!existing.includes(a.id)) existing.push(a.id)
        childrenMap.set(a.mother_id, existing)
      }
    })

    // Assign generations using BFS from roots (people without parents in tree)
    const generations = new Map<string, number>()
    const roots = ancestors.filter(a => !a.father_id && !a.mother_id)

    // If no roots, find people who are parents but not children
    if (roots.length === 0) {
      const hasChildren = new Set(Array.from(childrenMap.keys()))
      const isChild = new Set<string>()
      ancestors.forEach(a => {
        if (a.father_id) isChild.add(a.id)
        if (a.mother_id) isChild.add(a.id)
      })

      ancestors.forEach(a => {
        if (hasChildren.has(a.id) && !isChild.has(a.id)) {
          roots.push(a)
        }
      })
    }

    // Still no roots? Just use first ancestor
    if (roots.length === 0 && ancestors.length > 0) {
      roots.push(ancestors[0])
    }

    // BFS to assign generations
    const queue: { id: string; gen: number }[] = roots.map(r => ({ id: r.id, gen: 0 }))
    const visited = new Set<string>()

    while (queue.length > 0) {
      const { id, gen } = queue.shift()!
      if (visited.has(id)) continue
      visited.add(id)
      generations.set(id, gen)

      // Process children (next generation)
      const children = childrenMap.get(id) || []
      children.forEach(childId => {
        if (!visited.has(childId)) {
          queue.push({ id: childId, gen: gen + 1 })
        }
      })

      // Process spouse at same generation
      const ancestor = ancestorMap.get(id)
      if (ancestor?.spouse_ids) {
        ancestor.spouse_ids.forEach(spouseId => {
          if (!visited.has(spouseId) && ancestorMap.has(spouseId)) {
            queue.push({ id: spouseId, gen })
          }
        })
      }
    }

    // Handle any unvisited ancestors
    ancestors.forEach(a => {
      if (!generations.has(a.id)) {
        // Try to infer from parent
        if (a.father_id && generations.has(a.father_id)) {
          generations.set(a.id, (generations.get(a.father_id) || 0) + 1)
        } else if (a.mother_id && generations.has(a.mother_id)) {
          generations.set(a.id, (generations.get(a.mother_id) || 0) + 1)
        } else {
          generations.set(a.id, 0)
        }
      }
    })

    // Group by generation
    const genGroups = new Map<number, AncestorWithCounts[]>()
    ancestors.forEach(a => {
      const gen = generations.get(a.id) || 0
      const group = genGroups.get(gen) || []
      group.push(a)
      genGroups.set(gen, group)
    })

    // Sort generations
    const sortedGens = Array.from(genGroups.keys()).sort((a, b) => a - b)

    // Position nodes
    const positions = new Map<string, { x: number; y: number }>()
    const positionedNodes: PositionedNode[] = []

    // Calculate max width needed
    let maxNodesInGen = 0
    sortedGens.forEach(gen => {
      const group = genGroups.get(gen) || []
      maxNodesInGen = Math.max(maxNodesInGen, group.length)
    })

    const totalWidth = maxNodesInGen * (NODE_WIDTH + H_SPACING)

    sortedGens.forEach((gen, genIndex) => {
      const group = genGroups.get(gen) || []
      const groupWidth = group.length * (NODE_WIDTH + H_SPACING) - H_SPACING
      const startX = (totalWidth - groupWidth) / 2

      group.forEach((ancestor, idx) => {
        const x = startX + idx * (NODE_WIDTH + H_SPACING)
        const y = genIndex * V_SPACING
        positions.set(ancestor.id, { x, y })
        positionedNodes.push({ ancestor, x, y, generation: gen })
      })
    })

    // Build connections
    const conns: Connection[] = []

    ancestors.forEach(a => {
      const childPos = positions.get(a.id)
      if (!childPos) return

      // Parent connections
      if (a.father_id && positions.has(a.father_id)) {
        const fatherPos = positions.get(a.father_id)!
        conns.push({
          fromId: a.father_id,
          toId: a.id,
          fromX: fatherPos.x + NODE_WIDTH / 2,
          fromY: fatherPos.y + NODE_HEIGHT,
          toX: childPos.x + NODE_WIDTH / 2,
          toY: childPos.y,
          type: 'parent-child',
        })
      }

      if (a.mother_id && positions.has(a.mother_id)) {
        const motherPos = positions.get(a.mother_id)!
        conns.push({
          fromId: a.mother_id,
          toId: a.id,
          fromX: motherPos.x + NODE_WIDTH / 2,
          fromY: motherPos.y + NODE_HEIGHT,
          toX: childPos.x + NODE_WIDTH / 2,
          toY: childPos.y,
          type: 'parent-child',
        })
      }

      // Spouse connections (only draw once per pair)
      if (a.spouse_ids && a.spouse_ids.length > 0) {
        a.spouse_ids.forEach(spouseId => {
          if (a.id < spouseId && positions.has(spouseId)) {
            const spousePos = positions.get(spouseId)!
            conns.push({
              fromId: a.id,
              toId: spouseId,
              fromX: childPos.x + NODE_WIDTH,
              fromY: childPos.y + NODE_HEIGHT / 2,
              toX: spousePos.x,
              toY: spousePos.y + NODE_HEIGHT / 2,
              type: 'spouse',
            })
          }
        })
      }
    })

    // Calculate bounds
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    positionedNodes.forEach(n => {
      minX = Math.min(minX, n.x)
      maxX = Math.max(maxX, n.x + NODE_WIDTH)
      minY = Math.min(minY, n.y)
      maxY = Math.max(maxY, n.y + NODE_HEIGHT)
    })

    return {
      nodes: positionedNodes,
      connections: conns,
      bounds: { minX: minX - 50, maxX: maxX + 50, minY: minY - 50, maxY: maxY + 50 },
    }
  }, [ancestors])

  // Center the tree on initial load
  useEffect(() => {
    if (nodes.length > 0 && containerSize.width > 0) {
      const treeWidth = bounds.maxX - bounds.minX
      const treeHeight = bounds.maxY - bounds.minY

      // Calculate scale to fit
      const scaleX = (containerSize.width - 100) / treeWidth
      const scaleY = (containerSize.height - 100) / treeHeight
      const scale = Math.min(Math.max(0.3, Math.min(scaleX, scaleY)), 1)

      // Center the tree
      const centerX = containerSize.width / 2 - (bounds.minX + treeWidth / 2) * scale
      const centerY = 50

      setTransform({ x: centerX, y: centerY, scale })
    }
  }, [nodes.length, containerSize, bounds])

  // Mouse handlers for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    setIsDragging(true)
    setDragStart({
      x: e.clientX,
      y: e.clientY,
      transformX: transform.x,
      transformY: transform.y,
    })
  }, [transform])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    const dx = e.clientX - dragStart.x
    const dy = e.clientY - dragStart.y
    setTransform(t => ({
      ...t,
      x: dragStart.transformX + dx,
      y: dragStart.transformY + dy,
    }))
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Touch handlers
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    const touch = e.touches[0]
    setIsDragging(true)
    setDragStart({
      x: touch.clientX,
      y: touch.clientY,
      transformX: transform.x,
      transformY: transform.y,
    })
  }, [transform])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return
    const touch = e.touches[0]
    const dx = touch.clientX - dragStart.x
    const dy = touch.clientY - dragStart.y
    setTransform(t => ({
      ...t,
      x: dragStart.transformX + dx,
      y: dragStart.transformY + dy,
    }))
  }, [isDragging, dragStart])

  const handleTouchEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Zoom handlers
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    setTransform(t => ({
      ...t,
      scale: Math.min(Math.max(0.2, t.scale * delta), 2),
    }))
  }, [])

  const zoomIn = useCallback(() => {
    setTransform(t => ({ ...t, scale: Math.min(t.scale * 1.25, 2) }))
  }, [])

  const zoomOut = useCallback(() => {
    setTransform(t => ({ ...t, scale: Math.max(t.scale * 0.8, 0.2) }))
  }, [])

  const resetView = useCallback(() => {
    if (nodes.length === 0) return
    const treeWidth = bounds.maxX - bounds.minX
    const treeHeight = bounds.maxY - bounds.minY
    const scaleX = (containerSize.width - 100) / treeWidth
    const scaleY = (containerSize.height - 100) / treeHeight
    const scale = Math.min(Math.max(0.3, Math.min(scaleX, scaleY)), 1)
    const centerX = containerSize.width / 2 - (bounds.minX + treeWidth / 2) * scale
    setTransform({ x: centerX, y: 50, scale })
  }, [nodes, bounds, containerSize])

  if (ancestors.length === 0) {
    return (
      <div className="flex items-center justify-center h-96 text-muted-foreground">
        No ancestors to display
      </div>
    )
  }

  const treeWidth = bounds.maxX - bounds.minX
  const treeHeight = bounds.maxY - bounds.minY

  return (
    <div className="relative h-[600px] border rounded-lg bg-muted/10 overflow-hidden">
      {/* Controls */}
      <div className="absolute top-3 right-3 z-10 flex gap-1.5">
        <Button variant="secondary" size="icon" className="h-8 w-8" onClick={zoomIn}>
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" className="h-8 w-8" onClick={zoomOut}>
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="secondary" size="icon" className="h-8 w-8" onClick={resetView}>
          <Home className="h-4 w-4" />
        </Button>
      </div>

      {/* Legend */}
      <div className="absolute top-3 left-3 z-10 bg-background/90 backdrop-blur-sm rounded-md px-3 py-2 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-muted-foreground" />
          <span>Parent-Child</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 bg-primary border-dashed border-t-2 border-primary" style={{ borderStyle: 'dashed' }} />
          <span>Spouse</span>
        </div>
      </div>

      {/* Stats and zoom indicator */}
      <div className="absolute bottom-3 right-3 z-10 px-2 py-1 bg-background/80 rounded text-xs space-y-1">
        <div>{nodes.length} people, {connections.length} connections</div>
        <div>{Math.round(transform.scale * 100)}%</div>
      </div>

      {/* Tree canvas */}
      <div
        ref={containerRef}
        className={`w-full h-full ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          style={{
            transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
            transformOrigin: '0 0',
            width: treeWidth,
            height: treeHeight,
            position: 'relative',
          }}
        >
          {/* SVG for connections */}
          <svg
            className="absolute pointer-events-none"
            style={{
              left: bounds.minX,
              top: bounds.minY,
              width: treeWidth,
              height: treeHeight,
              overflow: 'visible',
            }}
          >
            {connections.map((conn, idx) => {
              const x1 = conn.fromX - bounds.minX
              const y1 = conn.fromY - bounds.minY
              const x2 = conn.toX - bounds.minX
              const y2 = conn.toY - bounds.minY

              if (conn.type === 'spouse') {
                return (
                  <line
                    key={idx}
                    x1={x1}
                    y1={y1}
                    x2={x2}
                    y2={y2}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2 / transform.scale}
                    strokeDasharray={`${4 / transform.scale},${4 / transform.scale}`}
                  />
                )
              }

              // Parent-child: curved line
              const midY = (y1 + y2) / 2
              return (
                <path
                  key={idx}
                  d={`M ${x1} ${y1} C ${x1} ${midY}, ${x2} ${midY}, ${x2} ${y2}`}
                  fill="none"
                  stroke="hsl(var(--muted-foreground))"
                  strokeWidth={2 / transform.scale}
                />
              )
            })}
          </svg>

          {/* Nodes */}
          {nodes.map(({ ancestor, x, y }) => (
            <Link
              key={ancestor.id}
              href={`/ancestor/${ancestor.id}`}
              className="absolute block select-none"
              style={{
                left: x - bounds.minX,
                top: y - bounds.minY,
                width: NODE_WIDTH,
                height: NODE_HEIGHT,
              }}
              onClick={(e) => {
                if (isDragging) {
                  e.preventDefault()
                }
              }}
              draggable={false}
            >
              <div className="h-full bg-card border-2 rounded-lg shadow-sm hover:shadow-md hover:border-primary transition-all p-2.5 flex flex-col justify-between">
                <div className="min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <h4 className="font-medium text-xs truncate flex-1 leading-tight">
                      {[ancestor.given_names, ancestor.surname].filter(Boolean).join(' ') || 'Unknown'}
                    </h4>
                    {ancestor.is_brick_wall && (
                      <BrickWall className="h-3 w-3 text-destructive flex-shrink-0" />
                    )}
                  </div>
                  {ancestor.maiden_name && (
                    <p className="text-[10px] text-muted-foreground truncate leading-tight">
                      (nee {ancestor.maiden_name})
                    </p>
                  )}
                </div>
                <p className="text-[10px] text-muted-foreground leading-tight">
                  {[ancestor.birth_date, ancestor.death_date].filter(Boolean).join(' – ') || 'Dates unknown'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

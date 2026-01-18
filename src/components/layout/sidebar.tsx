'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Dog,
  LayoutDashboard,
  TreePine,
  BrickWall,
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Upload,
  Wand2,
} from 'lucide-react'
import { useState } from 'react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Import', href: '/import', icon: Upload },
  { name: 'AI Tree Builder', href: '/ai-tree-builder', icon: Wand2 },
  { name: 'Brick Walls', href: '/brick-walls', icon: BrickWall },
  { name: 'Settings', href: '/settings', icon: Settings },
]

interface SidebarProps {
  trees?: { id: string; name: string }[]
  currentTreeId?: string
  subscriptionTier?: string
}

export function Sidebar({ trees = [], currentTreeId, subscriptionTier = 'free' }: SidebarProps) {
  const pathname = usePathname()
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div
      className={cn(
        'relative flex h-full flex-col border-r bg-card transition-all duration-300',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Dog className="h-8 w-8 text-primary flex-shrink-0" />
          {!collapsed && (
            <span className="font-serif text-xl font-bold text-foreground">PlotHound</span>
          )}
        </Link>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="absolute -right-3 top-20 z-10 h-6 w-6 rounded-full border bg-background"
        onClick={() => setCollapsed(!collapsed)}
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4" />
        ) : (
          <ChevronLeft className="h-4 w-4" />
        )}
      </Button>

      <ScrollArea className="flex-1 py-4">
        <nav className="space-y-1 px-2">
          {navigation.map((item) => {
            const isActive = pathname === item.href
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.name}</span>}
              </Link>
            )
          })}
        </nav>

        {!collapsed && trees.length > 0 && (
          <div className="mt-6 px-3">
            <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Family Trees
            </h3>
            <nav className="space-y-1">
              {trees.map((tree) => {
                const isActive = pathname.startsWith(`/tree/${tree.id}`) || currentTreeId === tree.id
                return (
                  <Link
                    key={tree.id}
                    href={`/tree/${tree.id}`}
                    className={cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
                      isActive
                        ? 'bg-accent text-accent-foreground'
                        : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                    )}
                  >
                    <TreePine className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">{tree.name}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
        )}
      </ScrollArea>

      {!collapsed && subscriptionTier === 'free' && (
        <div className="border-t p-4">
          <div className="rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <span className="text-sm font-medium">AI Research</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Unlock AI-powered research plans
            </p>
            <Button size="sm" className="mt-2 w-full" asChild>
              <Link href="/settings">Upgrade</Link>
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

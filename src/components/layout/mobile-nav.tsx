'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Dog,
  LayoutDashboard,
  TreePine,
  BrickWall,
  Settings,
  Sparkles,
  Upload,
  Wand2,
  Menu,
  X,
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Import', href: '/import', icon: Upload },
  { name: 'AI Tree Builder', href: '/ai-tree-builder', icon: Wand2 },
  { name: 'Brick Walls', href: '/brick-walls', icon: BrickWall },
  { name: 'Settings', href: '/settings', icon: Settings },
]

interface MobileNavProps {
  trees?: { id: string; name: string }[]
  subscriptionTier?: string
}

export function MobileNav({ trees = [], subscriptionTier = 'free' }: MobileNavProps) {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  // Close menu when pathname changes
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  // Prevent body scroll when menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <>
      {/* Mobile Header */}
      <div className="fixed top-0 left-0 right-0 z-50 flex h-14 items-center justify-between border-b bg-card px-4 md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Dog className="h-7 w-7 text-primary" />
          <span className="font-serif text-lg font-bold">PlotHound</span>
        </Link>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setIsOpen(!isOpen)}
          className="h-10 w-10"
        >
          {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </Button>
      </div>

      {/* Mobile spacer */}
      <div className="h-14 md:hidden" />

      {/* Mobile Menu Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile Menu Panel */}
      <div
        className={cn(
          'fixed top-14 bottom-0 left-0 z-40 w-72 transform bg-card transition-transform duration-300 ease-in-out md:hidden',
          isOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex h-full flex-col overflow-y-auto pb-safe">
          <nav className="space-y-1 p-4">
            {navigation.map((item) => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-4 py-3 text-base font-medium transition-colors',
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground active:bg-muted'
                  )}
                >
                  <item.icon className="h-5 w-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>

          {trees.length > 0 && (
            <div className="mt-4 px-4">
              <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Family Trees
              </h3>
              <nav className="space-y-1">
                {trees.map((tree) => {
                  const isActive = pathname.startsWith(`/tree/${tree.id}`)
                  return (
                    <Link
                      key={tree.id}
                      href={`/tree/${tree.id}`}
                      className={cn(
                        'flex items-center gap-3 rounded-lg px-4 py-3 text-base transition-colors',
                        isActive
                          ? 'bg-accent text-accent-foreground'
                          : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                      )}
                    >
                      <TreePine className="h-5 w-5 flex-shrink-0" />
                      <span className="truncate">{tree.name}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>
          )}

          {subscriptionTier === 'free' && (
            <div className="mt-auto border-t p-4">
              <div className="rounded-lg bg-gradient-to-r from-primary/10 to-accent/10 p-4">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-primary" />
                  <span className="font-medium">AI Research</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Unlock AI-powered research plans
                </p>
                <Button size="sm" className="mt-3 w-full" asChild>
                  <Link href="/settings">Upgrade</Link>
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

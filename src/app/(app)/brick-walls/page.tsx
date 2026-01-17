import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { BrickWall, ArrowRight, TreePine, Sparkles } from 'lucide-react'
import { UpgradePrompt } from '@/components/layout/upgrade-prompt'
import { canAccessAdvancedAi } from '@/lib/subscription-limits'
import type { Profile, Ancestor } from '@/types/database'

interface BrickWallAncestor extends Ancestor {
  tree: { id: string; name: string } | null
  facts: { count: number }[]
  sources_checked: { count: number }[]
}

export default async function BrickWallsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const profile = profileData as Profile | null

  // Get all brick wall ancestors across all trees
  const { data: brickWallsData } = await supabase
    .from('ancestors')
    .select(`
      *,
      tree:trees(id, name),
      facts(count),
      sources_checked(count)
    `)
    .eq('is_brick_wall', true)
    .order('research_priority', { ascending: false })

  const brickWalls = brickWallsData as BrickWallAncestor[] | null

  return (
    <>
      <Header profile={profile} title="Brick Walls" />

      <div className="flex-1 overflow-auto p-6">
        <div className="mb-6">
          <p className="text-muted-foreground">
            Ancestors you are stuck on. Focus your research efforts here.
          </p>
        </div>

        {!canAccessAdvancedAi(profile?.subscription_tier || 'free') && brickWalls && brickWalls.length > 0 && (
          <div className="mb-6">
            <UpgradePrompt
              currentTier={profile?.subscription_tier || 'free'}
              feature="AI Brick Wall Analysis"
              message="Get AI-powered suggestions for breaking through your brick walls with fresh research approaches."
            />
          </div>
        )}

        {brickWalls?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <BrickWall className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">No brick walls</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Great news! You do not have any ancestors marked as brick walls.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {brickWalls?.map((ancestor) => {
              const displayName = [ancestor.given_names, ancestor.surname].filter(Boolean).join(' ') || 'Unknown'
              const lifespan = [ancestor.birth_date, ancestor.death_date].filter(Boolean).join(' - ')
              const factsCount = Array.isArray(ancestor.facts) ? ancestor.facts[0]?.count : 0
              const sourcesCount = Array.isArray(ancestor.sources_checked) ? ancestor.sources_checked[0]?.count : 0

              return (
                <Card key={ancestor.id} className="border-destructive/30">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="font-serif">{displayName}</CardTitle>
                        {lifespan && (
                          <CardDescription>{lifespan}</CardDescription>
                        )}
                      </div>
                      <Badge variant="destructive">
                        <BrickWall className="mr-1 h-3 w-3" />
                        Stuck
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-3">
                      <TreePine className="h-4 w-4" />
                      <Link href={`/tree/${ancestor.tree?.id}`} className="hover:underline">
                        {ancestor.tree?.name}
                      </Link>
                    </div>

                    {ancestor.brick_wall_notes && (
                      <p className="text-sm text-muted-foreground mb-3 line-clamp-2">
                        {ancestor.brick_wall_notes}
                      </p>
                    )}

                    <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                      <span>{factsCount} facts</span>
                      <span>{sourcesCount} sources checked</span>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="outline" size="sm" asChild className="flex-1">
                        <Link href={`/ancestor/${ancestor.id}`}>
                          View Details
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                      </Button>
                      {canAccessAdvancedAi(profile?.subscription_tier || 'free') && (
                        <Button size="sm" asChild>
                          <Link href={`/ancestor/${ancestor.id}/plan`}>
                            <Sparkles className="mr-2 h-4 w-4" />
                            Get AI Help
                          </Link>
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

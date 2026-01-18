import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, TreePine, Users, BrickWall, Clock, ArrowRight, Upload, Wand2, Sparkles } from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import { CreateTreeDialog } from '@/components/trees/create-tree-dialog'
import type { Profile, Tree, ResearchLogEntry, Ancestor } from '@/types/database'

interface TreeWithCount extends Tree {
  ancestors: { count: number }[]
}

interface ActivityEntry extends ResearchLogEntry {
  ancestor: { id: string; given_names: string | null; surname: string | null; tree_id: string } | null
}

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const profile = profileData as Profile | null

  // Fetch trees with ancestor counts
  const { data: treesData } = await supabase
    .from('trees')
    .select(`
      *,
      ancestors(count)
    `)
    .order('updated_at', { ascending: false })

  const trees = treesData as TreeWithCount[] | null

  // Count brick walls across all trees
  const { count: brickWallCount } = await supabase
    .from('ancestors')
    .select('*', { count: 'exact', head: true })
    .eq('is_brick_wall', true)
    .in('tree_id', trees?.map(t => t.id) || [])

  // Get recent activity (last 5 research log entries)
  const { data: recentActivityData } = await supabase
    .from('research_log')
    .select(`
      *,
      ancestor:ancestors(id, given_names, surname, tree_id)
    `)
    .order('created_at', { ascending: false })
    .limit(5)

  const recentActivity = recentActivityData as ActivityEntry[] | null

  const totalAncestors = trees?.reduce((acc, tree) => {
    const count = Array.isArray(tree.ancestors) ? tree.ancestors[0]?.count : 0
    return acc + (count || 0)
  }, 0) || 0

  return (
    <>
      <Header profile={profile} title="Dashboard">
        <CreateTreeDialog>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            New Tree
          </Button>
        </CreateTreeDialog>
      </Header>

      <div className="flex-1 overflow-auto p-6">
        {/* Stats Overview */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Family Trees</CardTitle>
              <TreePine className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{trees?.length || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ancestors</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalAncestors}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Brick Walls</CardTitle>
              <BrickWall className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{brickWallCount || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Subscription</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant={profile?.subscription_tier === 'free' ? 'secondary' : 'default'}>
                {profile?.subscription_tier || 'Free'}
              </Badge>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div className="grid gap-4 md:grid-cols-2 mb-8">
          <Card className="border-dashed border-2 hover:border-primary transition-colors">
            <Link href="/import" className="block">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Upload className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold">Import from Ancestry</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Upload a GEDCOM file from Ancestry, FamilySearch, or other software
                    </p>
                    <Button variant="link" className="px-0 mt-2">
                      Import ancestors →
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Link>
          </Card>

          <Card className="border-dashed border-2 hover:border-primary transition-colors bg-gradient-to-br from-primary/5 to-transparent">
            <Link href="/ai-tree-builder" className="block">
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
                    <Wand2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold">AI Tree Builder</h3>
                      <Badge variant="secondary" className="text-xs">
                        <Sparkles className="h-3 w-3 mr-1" />
                        New
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      Give us 3-5 ancestors and let AI research and build your tree
                    </p>
                    <Button variant="link" className="px-0 mt-2">
                      Build with AI →
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Link>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Trees List */}
          <Card className="lg:col-span-1">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Your Family Trees</CardTitle>
                <CardDescription>
                  {trees?.length === 0
                    ? 'Create your first family tree to start researching'
                    : 'Select a tree to continue your research'}
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {!trees || trees.length === 0 ? (
                <div className="text-center py-8">
                  <TreePine className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    No family trees yet
                  </p>
                  <CreateTreeDialog>
                    <Button className="mt-4">
                      <Plus className="mr-2 h-4 w-4" />
                      Create Your First Tree
                    </Button>
                  </CreateTreeDialog>
                </div>
              ) : (
                <div className="space-y-3">
                  {trees.map((tree) => {
                    const ancestorCount = Array.isArray(tree.ancestors)
                      ? tree.ancestors[0]?.count
                      : 0
                    return (
                      <Link
                        key={tree.id}
                        href={`/tree/${tree.id}`}
                        className="flex items-center justify-between rounded-lg border p-4 transition-colors hover:bg-muted"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                            <TreePine className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-medium">{tree.name}</h3>
                            <p className="text-sm text-muted-foreground">
                              {ancestorCount || 0} ancestors
                            </p>
                          </div>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      </Link>
                    )
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
              <CardDescription>
                Your latest research log entries
              </CardDescription>
            </CardHeader>
            <CardContent>
              {recentActivity?.length === 0 ? (
                <div className="text-center py-8">
                  <Clock className="mx-auto h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-sm text-muted-foreground">
                    No recent activity
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {recentActivity?.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-start gap-3 rounded-lg border p-3"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted">
                        <Clock className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Link
                            href={`/ancestor/${entry.ancestor?.id}`}
                            className="font-medium text-sm hover:underline truncate"
                          >
                            {entry.ancestor?.given_names} {entry.ancestor?.surname}
                          </Link>
                          <span className="text-xs text-muted-foreground">
                            {formatRelativeDate(entry.log_date)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {entry.entry_text}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

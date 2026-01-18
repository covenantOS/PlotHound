import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Plus, Search, BrickWall } from 'lucide-react'
import { CreateAncestorDialog } from '@/components/ancestors/create-ancestor-dialog'
import { EditTreeDialog } from '@/components/trees/edit-tree-dialog'
import { TreeViewsWrapper } from '@/components/trees/tree-views-wrapper'
import type { Profile, Tree, Ancestor } from '@/types/database'

interface AncestorWithCounts extends Ancestor {
  facts: { count: number }[]
  sources_checked: { count: number }[]
  hypotheses: { count: number }[]
}

interface TreePageProps {
  params: Promise<{ treeId: string }>
  searchParams: Promise<{ search?: string; filter?: string }>
}

export default async function TreePage({ params, searchParams }: TreePageProps) {
  const { treeId } = await params
  const { search, filter } = await searchParams

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const profile = profileData as Profile | null

  const { data: treeData, error } = await supabase
    .from('trees')
    .select('*')
    .eq('id', treeId)
    .single()

  if (error || !treeData) {
    notFound()
  }

  const tree = treeData as unknown as Tree

  // Build query for ancestors
  let query = supabase
    .from('ancestors')
    .select(`
      *,
      facts(count),
      sources_checked(count),
      hypotheses(count)
    `)
    .eq('tree_id', treeId)

  // Apply search filter
  if (search) {
    query = query.or(`given_names.ilike.%${search}%,surname.ilike.%${search}%,maiden_name.ilike.%${search}%`)
  }

  // Apply brick wall filter
  if (filter === 'brick-walls') {
    query = query.eq('is_brick_wall', true)
  }

  const { data: ancestorsData } = await query.order('research_priority', { ascending: false })
  const ancestors = ancestorsData as AncestorWithCounts[] | null

  const brickWallCount = ancestors?.filter(a => a.is_brick_wall).length || 0

  return (
    <>
      <Header profile={profile} title={tree.name}>
        <EditTreeDialog tree={tree}>
          <Button variant="outline" size="sm">
            Edit Tree
          </Button>
        </EditTreeDialog>
        <CreateAncestorDialog treeId={treeId}>
          <Button size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Add Ancestor
          </Button>
        </CreateAncestorDialog>
      </Header>

      <div className="flex-1 overflow-auto p-6">
        {/* Tree Info */}
        {tree.description && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <p className="text-muted-foreground">{tree.description}</p>
            </CardContent>
          </Card>
        )}

        {/* Search and Filters */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <form className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              name="search"
              placeholder="Search ancestors..."
              defaultValue={search}
              className="pl-10"
            />
          </form>
          <div className="flex items-center gap-2">
            <Link href={`/tree/${treeId}`}>
              <Badge variant={!filter ? 'default' : 'outline'} className="cursor-pointer">
                All ({ancestors?.length || 0})
              </Badge>
            </Link>
            <Link href={`/tree/${treeId}?filter=brick-walls`}>
              <Badge
                variant={filter === 'brick-walls' ? 'destructive' : 'outline'}
                className="cursor-pointer"
              >
                <BrickWall className="mr-1 h-3 w-3" />
                Brick Walls ({brickWallCount})
              </Badge>
            </Link>
          </div>
        </div>

        {/* Tree Views */}
        {ancestors?.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <Search className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium">
                {search ? 'No ancestors found' : 'No ancestors yet'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {search
                  ? 'Try adjusting your search terms'
                  : 'Add your first ancestor to start building your family tree'}
              </p>
              {!search && (
                <CreateAncestorDialog treeId={treeId}>
                  <Button className="mt-4">
                    <Plus className="mr-2 h-4 w-4" />
                    Add First Ancestor
                  </Button>
                </CreateAncestorDialog>
              )}
            </CardContent>
          </Card>
        ) : (
          <TreeViewsWrapper ancestors={ancestors || []} treeId={treeId} />
        )}
      </div>
    </>
  )
}

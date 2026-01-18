import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import {
  BrickWall,
  FileText,
  Search,
  Lightbulb,
  BookOpen,
  FileUp,
  Sparkles,
  ChevronLeft,
  Edit,
  Target,
  Clock,
} from 'lucide-react'
import { formatRelativeDate } from '@/lib/utils'
import { EditAncestorDialog } from '@/components/ancestors/edit-ancestor-dialog'
import { BrickWallToggle } from '@/components/ancestors/brick-wall-toggle'
import { FactsList } from '@/components/facts/facts-list'
import { SourcesList } from '@/components/sources/sources-list'
import { HypothesesList } from '@/components/hypotheses/hypotheses-list'
import { ResearchLogList } from '@/components/research-log/research-log-list'
import { ResearchGoalsList } from '@/components/research-goals/research-goals-list'
import { RelationshipsDisplay } from '@/components/ancestors/relationships-display'
import { UpgradePrompt } from '@/components/layout/upgrade-prompt'
import { canAccessAdvancedAi } from '@/lib/subscription-limits'
import type { Ancestor, Fact, SourceChecked, Hypothesis, ResearchLogEntry, ResearchGoal, ResearchPlan, Evidence, Profile } from '@/types/database'

interface AncestorWithTree extends Ancestor {
  tree: { id: string; name: string } | null
}

interface HypothesisWithEvidence extends Hypothesis {
  evidence: Evidence[]
}

interface AncestorPageProps {
  params: Promise<{ ancestorId: string }>
  searchParams: Promise<{ tab?: string }>
}

export default async function AncestorPage({ params, searchParams }: AncestorPageProps) {
  const { ancestorId } = await params
  const { tab } = await searchParams

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const profile = profileData as Profile | null

  // Fetch ancestor with related data
  const { data: ancestorData, error } = await supabase
    .from('ancestors')
    .select(`
      *,
      tree:trees(id, name)
    `)
    .eq('id', ancestorId)
    .single()

  if (error || !ancestorData) {
    notFound()
  }

  const ancestor = ancestorData as unknown as AncestorWithTree

  // Fetch related data
  const [
    factsResult,
    sourcesResult,
    hypothesesResult,
    researchLogResult,
    researchGoalsResult,
    researchPlanResult,
    fatherResult,
    motherResult,
    childrenResult,
  ] = await Promise.all([
    supabase.from('facts').select('*').eq('ancestor_id', ancestorId).order('created_at', { ascending: false }),
    supabase.from('sources_checked').select('*').eq('ancestor_id', ancestorId).order('date_checked', { ascending: false }),
    supabase.from('hypotheses').select('*, evidence(*)').eq('ancestor_id', ancestorId).order('created_at', { ascending: false }),
    supabase.from('research_log').select('*').eq('ancestor_id', ancestorId).order('log_date', { ascending: false }).limit(10),
    supabase.from('research_goals').select('*').eq('ancestor_id', ancestorId).order('created_at', { ascending: false }),
    supabase.from('research_plans').select('*').eq('ancestor_id', ancestorId).eq('is_current', true).single(),
    // Fetch father if exists
    ancestor.father_id
      ? supabase.from('ancestors').select('*').eq('id', ancestor.father_id).single()
      : Promise.resolve({ data: null }),
    // Fetch mother if exists
    ancestor.mother_id
      ? supabase.from('ancestors').select('*').eq('id', ancestor.mother_id).single()
      : Promise.resolve({ data: null }),
    // Fetch children (ancestors where this person is father or mother)
    supabase
      .from('ancestors')
      .select('*')
      .eq('tree_id', ancestor.tree_id)
      .or(`father_id.eq.${ancestorId},mother_id.eq.${ancestorId}`)
      .order('birth_date'),
  ])

  // Fetch spouses if exists
  let spouses: Ancestor[] = []
  if (ancestor.spouse_ids && ancestor.spouse_ids.length > 0) {
    const { data: spousesData } = await supabase
      .from('ancestors')
      .select('*')
      .in('id', ancestor.spouse_ids)
    spouses = spousesData as Ancestor[] || []
  }

  const facts = factsResult.data as Fact[] | null
  const sourcesChecked = sourcesResult.data as SourceChecked[] | null
  const hypotheses = hypothesesResult.data as HypothesisWithEvidence[] | null
  const researchLog = researchLogResult.data as ResearchLogEntry[] | null
  const researchGoals = researchGoalsResult.data as ResearchGoal[] | null
  const researchPlan = researchPlanResult.data as ResearchPlan | null
  const father = fatherResult.data as Ancestor | null
  const mother = motherResult.data as Ancestor | null
  const children = childrenResult.data as Ancestor[] || []

  const displayName = [ancestor.given_names, ancestor.surname].filter(Boolean).join(' ') || 'Unknown Ancestor'
  const lifespan = [ancestor.birth_date, ancestor.death_date].filter(Boolean).join(' - ')
  const activeGoals = researchGoals?.filter(g => g.status === 'active').length || 0

  const defaultTab = tab || 'overview'

  return (
    <>
      <Header profile={profile}>
        <Link
          href={`/tree/${ancestor.tree?.id}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ChevronLeft className="h-4 w-4" />
          {ancestor.tree?.name}
        </Link>
      </Header>

      <div className="flex-1 overflow-auto">
        {/* Ancestor Header */}
        <div className="border-b bg-card px-6 py-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="font-serif text-2xl font-bold">{displayName}</h1>
                {ancestor.is_brick_wall && (
                  <Badge variant="destructive">
                    <BrickWall className="mr-1 h-3 w-3" />
                    Brick Wall
                  </Badge>
                )}
              </div>
              {ancestor.maiden_name && (
                <p className="text-muted-foreground">nee {ancestor.maiden_name}</p>
              )}
              {lifespan && <p className="text-muted-foreground">{lifespan}</p>}
              {(ancestor.birth_place || ancestor.death_place) && (
                <p className="text-sm text-muted-foreground">
                  {ancestor.birth_place && `Born: ${ancestor.birth_place}`}
                  {ancestor.birth_place && ancestor.death_place && ' | '}
                  {ancestor.death_place && `Died: ${ancestor.death_place}`}
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <BrickWallToggle
                ancestorId={ancestorId}
                isBrickWall={ancestor.is_brick_wall}
                brickWallNotes={ancestor.brick_wall_notes}
              />
              <EditAncestorDialog ancestor={ancestor}>
                <Button variant="outline" size="sm">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </EditAncestorDialog>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="mt-4 flex flex-wrap gap-4">
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground" />
              <span>{facts?.length || 0} facts</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span>{sourcesChecked?.length || 0} sources checked</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Lightbulb className="h-4 w-4 text-muted-foreground" />
              <span>{hypotheses?.length || 0} hypotheses</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span>{activeGoals} active goals</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue={defaultTab} className="px-6 py-4">
          <TabsList className="mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="facts">Facts</TabsTrigger>
            <TabsTrigger value="sources">Sources</TabsTrigger>
            <TabsTrigger value="hypotheses">Hypotheses</TabsTrigger>
            <TabsTrigger value="log">Research Log</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Family Connections */}
            <RelationshipsDisplay
              ancestor={ancestor}
              father={father}
              mother={mother}
              spouses={spouses}
              children={children}
            />

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Research Goals */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="h-5 w-5" />
                    Research Goals
                  </CardTitle>
                  <CardDescription>
                    What you&apos;re trying to find for this ancestor
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ResearchGoalsList
                    ancestorId={ancestorId}
                    goals={researchGoals || []}
                    compact
                  />
                </CardContent>
              </Card>

              {/* Recent Activity */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    Recent Activity
                  </CardTitle>
                  <CardDescription>
                    Latest research log entries
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {researchLog?.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No research log entries yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {researchLog?.slice(0, 5).map((entry) => (
                        <div key={entry.id} className="border-l-2 border-muted pl-3">
                          <p className="text-sm line-clamp-2">{entry.entry_text}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatRelativeDate(entry.log_date)}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* AI Research Plan */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    AI Research Plan
                  </CardTitle>
                  <CardDescription>
                    Get AI-powered suggestions for your next research steps
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!canAccessAdvancedAi(profile?.subscription_tier || 'free') ? (
                    <UpgradePrompt
                      currentTier={profile?.subscription_tier || 'free'}
                      feature="AI Research Planning"
                      message="Unlock AI-powered research plans, hypothesis scoring, and brick wall analysis."
                      compact
                    />
                  ) : researchPlan ? (
                    <div className="space-y-4">
                      <p className="text-sm">{(researchPlan.plan_json as any).summary}</p>
                      <Button asChild variant="outline">
                        <Link href={`/ancestor/${ancestorId}/plan`}>View Full Plan</Link>
                      </Button>
                    </div>
                  ) : (
                    <div className="text-center py-4">
                      <p className="text-sm text-muted-foreground mb-4">
                        Generate a personalized research plan based on what you know and what you&apos;ve already tried.
                      </p>
                      <Button asChild>
                        <Link href={`/ancestor/${ancestorId}/plan`}>
                          <Sparkles className="mr-2 h-4 w-4" />
                          Generate Research Plan
                        </Link>
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Notes */}
            {ancestor.notes && (
              <Card>
                <CardHeader>
                  <CardTitle>Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{ancestor.notes}</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="facts">
            <FactsList ancestorId={ancestorId} facts={facts || []} />
          </TabsContent>

          <TabsContent value="sources">
            <SourcesList ancestorId={ancestorId} sources={sourcesChecked || []} />
          </TabsContent>

          <TabsContent value="hypotheses">
            <HypothesesList
              ancestorId={ancestorId}
              hypotheses={hypotheses || []}
              subscriptionTier={profile?.subscription_tier || 'free'}
            />
          </TabsContent>

          <TabsContent value="log">
            <ResearchLogList ancestorId={ancestorId} entries={researchLog || []} />
          </TabsContent>
        </Tabs>
      </div>
    </>
  )
}

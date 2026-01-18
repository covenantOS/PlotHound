'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useToast } from '@/components/ui/use-toast'
import {
  ChevronLeft,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Clock,
  Lightbulb,
  Loader2,
  Bot,
  Key,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import type { ResearchPlanData } from '@/types/database'

const LIKELIHOOD_COLORS: Record<string, string> = {
  low: 'bg-red-500',
  medium: 'bg-orange-500',
  high: 'bg-yellow-500',
  very_high: 'bg-green-500',
}

const LIKELIHOOD_LABELS: Record<string, string> = {
  low: 'Low (10-25%)',
  medium: 'Medium (26-50%)',
  high: 'High (51-75%)',
  very_high: 'Very High (76-95%)',
}

interface AgentResearchResult {
  success: boolean
  summary: string
  saved: {
    facts: string[]
    sources: string[]
    hypotheses: string[]
    logEntry: string | null
  }
  nextSteps: string[]
}

export default function ResearchPlanPage() {
  const params = useParams()
  const ancestorId = params.ancestorId as string
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const [isLoading, setIsLoading] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isResearching, setIsResearching] = useState(false)
  const [plan, setPlan] = useState<ResearchPlanData | null>(null)
  const [ancestor, setAncestor] = useState<{ given_names: string | null; surname: string | null } | null>(null)
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set())
  const [hasByok, setHasByok] = useState(false)
  const [researchGoal, setResearchGoal] = useState('')
  const [agentResult, setAgentResult] = useState<AgentResearchResult | null>(null)

  useEffect(() => {
    loadData()
  }, [ancestorId])

  const loadData = async () => {
    setIsLoading(true)

    // Fetch ancestor
    const { data: ancestorData } = await supabase
      .from('ancestors')
      .select('given_names, surname')
      .eq('id', ancestorId)
      .single()

    setAncestor(ancestorData)

    // Fetch existing plan
    const { data: planResult } = await supabase
      .from('research_plans')
      .select('plan_json')
      .eq('ancestor_id', ancestorId)
      .eq('is_current', true)
      .single()

    const planData = planResult as { plan_json: ResearchPlanData } | null
    if (planData) {
      setPlan(planData.plan_json)
    }

    // Check if user has BYOK enabled
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profileData } = await supabase
        .from('profiles')
        .select('use_own_api_key, anthropic_api_key, openai_api_key, google_api_key')
        .eq('id', user.id)
        .single()

      if (profileData) {
        const hasKey = Boolean(
          profileData.use_own_api_key &&
          (profileData.anthropic_api_key || profileData.openai_api_key || profileData.google_api_key)
        )
        setHasByok(hasKey)
      }
    }

    setIsLoading(false)
  }

  const runAgentResearch = async () => {
    setIsResearching(true)
    setAgentResult(null)

    try {
      const response = await fetch('/api/ai/agent-research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ancestorId,
          researchGoal: researchGoal || undefined,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to run agent research')
      }

      setAgentResult(data)

      toast({
        title: 'Agent research complete',
        description: `Added ${data.saved.facts.length} facts, ${data.saved.sources.length} sources, and ${data.saved.hypotheses.length} hypotheses.`,
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Something went wrong',
      })
    }

    setIsResearching(false)
  }

  const generatePlan = async () => {
    setIsGenerating(true)

    try {
      const response = await fetch('/api/ai/research-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ancestorId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate plan')
      }

      setPlan(data.plan)
      setCompletedSteps(new Set())

      toast({
        title: 'Research plan generated',
        description: 'Your AI-powered research plan is ready.',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error instanceof Error ? error.message : 'Something went wrong',
      })
    }

    setIsGenerating(false)
  }

  const toggleStep = (index: number) => {
    const newCompleted = new Set(completedSteps)
    if (newCompleted.has(index)) {
      newCompleted.delete(index)
    } else {
      newCompleted.add(index)
    }
    setCompletedSteps(newCompleted)
  }

  const displayName = [ancestor?.given_names, ancestor?.surname].filter(Boolean).join(' ') || 'Unknown Ancestor'

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="border-b bg-card px-6 py-4">
        <Link
          href={`/ancestor/${ancestorId}`}
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
        >
          <ChevronLeft className="h-4 w-4" />
          Back to {displayName}
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-serif text-2xl font-bold flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              AI Research Plan
            </h1>
            <p className="text-muted-foreground">for {displayName}</p>
          </div>
          <Button onClick={generatePlan} disabled={isGenerating}>
            {isGenerating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : plan ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4" />
                Regenerate Plan
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Generate Plan
              </>
            )}
          </Button>
        </div>
      </div>

      <div className="p-6">
        {!plan ? (
          <Card className="max-w-xl mx-auto">
            <CardContent className="py-12 text-center">
              <Sparkles className="mx-auto h-16 w-16 text-primary/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">No Research Plan Yet</h3>
              <p className="text-muted-foreground mb-6">
                Generate an AI-powered research plan based on what you know and what you have already tried.
              </p>
              <Button onClick={generatePlan} disabled={isGenerating}>
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Research Plan
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6 max-w-4xl mx-auto">
            {/* Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Research Strategy</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{plan.summary}</p>
              </CardContent>
            </Card>

            {/* AI Agent Research */}
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bot className="h-5 w-5 text-primary" />
                  AI Agent Research
                </CardTitle>
                <CardDescription>
                  Let AI automatically analyze and add facts, sources, and hypotheses to this ancestor
                </CardDescription>
              </CardHeader>
              <CardContent>
                {!hasByok ? (
                  <div className="flex items-center gap-4 p-4 bg-muted rounded-lg">
                    <Key className="h-8 w-8 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">Requires Your Own API Key</p>
                      <p className="text-sm text-muted-foreground">
                        Add your Anthropic, OpenAI, or Google API key in Settings to use agent research.
                      </p>
                    </div>
                    <Button variant="outline" asChild>
                      <Link href="/settings">Add API Key</Link>
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="research-goal">Research Goal (optional)</Label>
                      <Input
                        id="research-goal"
                        placeholder="e.g., Find parents, Confirm immigration date..."
                        value={researchGoal}
                        onChange={(e) => setResearchGoal(e.target.value)}
                        disabled={isResearching}
                      />
                      <p className="text-xs text-muted-foreground">
                        Leave blank for general research analysis
                      </p>
                    </div>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            onClick={runAgentResearch}
                            disabled={isResearching}
                            className="w-full"
                          >
                            {isResearching ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                AI is researching...
                              </>
                            ) : (
                              <>
                                <Bot className="mr-2 h-4 w-4" />
                                Run Agent Research
                              </>
                            )}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>This will use your API key to run AI analysis</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {/* Agent Results */}
                    {agentResult && (
                      <div className="mt-4 p-4 bg-background rounded-lg border space-y-4">
                        <div className="flex items-center gap-2 text-green-600">
                          <CheckCircle2 className="h-5 w-5" />
                          <span className="font-medium">Research Complete</span>
                        </div>

                        <p className="text-sm">{agentResult.summary}</p>

                        <div className="grid gap-3 sm:grid-cols-3">
                          <div className="p-3 bg-muted rounded-md">
                            <p className="text-2xl font-bold">{agentResult.saved.facts.length}</p>
                            <p className="text-xs text-muted-foreground">Facts Added</p>
                          </div>
                          <div className="p-3 bg-muted rounded-md">
                            <p className="text-2xl font-bold">{agentResult.saved.sources.length}</p>
                            <p className="text-xs text-muted-foreground">Sources Documented</p>
                          </div>
                          <div className="p-3 bg-muted rounded-md">
                            <p className="text-2xl font-bold">{agentResult.saved.hypotheses.length}</p>
                            <p className="text-xs text-muted-foreground">Hypotheses Generated</p>
                          </div>
                        </div>

                        {agentResult.nextSteps.length > 0 && (
                          <div>
                            <p className="text-sm font-medium mb-2">Recommended Next Steps:</p>
                            <ul className="text-sm text-muted-foreground space-y-1">
                              {agentResult.nextSteps.map((step, i) => (
                                <li key={i} className="flex items-start gap-2">
                                  <span className="text-primary">-</span>
                                  {step}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <Button variant="outline" asChild className="w-full">
                          <Link href={`/ancestor/${ancestorId}`}>
                            View Updated Ancestor Profile
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Steps */}
            <div>
              <h2 className="font-serif text-xl font-bold mb-4">
                Recommended Steps ({completedSteps.size}/{plan.steps.length} completed)
              </h2>
              <div className="space-y-4">
                {plan.steps.map((step, index) => (
                  <Card
                    key={index}
                    className={completedSteps.has(index) ? 'opacity-60' : ''}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-start gap-3">
                        <Checkbox
                          checked={completedSteps.has(index)}
                          onCheckedChange={() => toggleStep(index)}
                          className="mt-1"
                        />
                        <div className="flex-1">
                          <div className="flex items-start justify-between">
                            <div>
                              <Badge variant="outline" className="mb-2">
                                Step {step.priority}
                              </Badge>
                              <CardTitle
                                className={`text-base ${completedSteps.has(index) ? 'line-through' : ''}`}
                              >
                                {step.source_name}
                              </CardTitle>
                              <CardDescription>
                                {step.repository}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-2 w-2 rounded-full ${LIKELIHOOD_COLORS[step.likelihood]}`}
                                title={LIKELIHOOD_LABELS[step.likelihood]}
                              />
                              <span className="text-sm text-muted-foreground">
                                {step.likelihood_percent}%
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pl-10">
                      <p className="text-sm text-muted-foreground mb-3">
                        {step.rationale}
                      </p>
                      {step.tips && (
                        <div className="flex items-start gap-2 text-sm bg-muted p-2 rounded-md mb-3">
                          <Lightbulb className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <p>{step.tips}</p>
                        </div>
                      )}
                      <div className="flex items-center gap-4 text-sm">
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="h-4 w-4" />
                          ~{step.estimated_minutes} min
                        </span>
                        <Badge variant="outline" className="capitalize">
                          {step.source_type}
                        </Badge>
                        {step.url && (
                          <a
                            href={step.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1 text-primary hover:underline"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Open Source
                          </a>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>

            {/* Alternative Approaches */}
            {plan.alternative_approaches && plan.alternative_approaches.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Alternative Approaches</CardTitle>
                  <CardDescription>
                    If the main steps do not yield results, consider these alternatives
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {plan.alternative_approaches.map((approach, index) => (
                      <li key={index} className="flex items-start gap-2">
                        <span className="text-primary">-</span>
                        <span>{approach}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

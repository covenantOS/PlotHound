'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/components/ui/use-toast'
import { UpgradePrompt } from '@/components/layout/upgrade-prompt'
import {
  Sparkles,
  TreePine,
  Plus,
  X,
  Loader2,
  CheckCircle2,
  Search,
  BookOpen,
  Users,
  AlertCircle,
  Crown,
} from 'lucide-react'
import type { SubscriptionTier } from '@/types/database'

interface SeedAncestor {
  id: string
  givenNames: string
  surname: string
  birthYear: string
  birthPlace: string
  deathYear: string
  relationship: string
}

interface ResearchResult {
  ancestorsFound: number
  generationsResearched: number
  sourcesChecked: number
  notesAdded: number
  treeId: string
}

type BuilderStep = 'input' | 'researching' | 'complete'

const EMPTY_ANCESTOR: SeedAncestor = {
  id: '',
  givenNames: '',
  surname: '',
  birthYear: '',
  birthPlace: '',
  deathYear: '',
  relationship: '',
}

const RELATIONSHIPS = [
  'Self (Starting Point)',
  'Parent',
  'Grandparent',
  'Great-Grandparent',
  'Sibling',
  'Spouse',
]

export default function AiTreeBuilderPage() {
  const [step, setStep] = useState<BuilderStep>('input')
  const [treeName, setTreeName] = useState('')
  const [seedAncestors, setSeedAncestors] = useState<SeedAncestor[]>([
    { ...EMPTY_ANCESTOR, id: '1', relationship: 'Self (Starting Point)' },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [result, setResult] = useState<ResearchResult | null>(null)
  const [profile, setProfile] = useState<{ subscription_tier: SubscriptionTier } | null>(null)

  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  useEffect(() => {
    loadProfile()
  }, [])

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data } = await supabase
        .from('profiles')
        .select('subscription_tier')
        .eq('id', user.id)
        .single()
      setProfile(data as { subscription_tier: SubscriptionTier } | null)
    }
  }

  const canUseAiBuilder = profile?.subscription_tier &&
    ['researcher', 'investigator', 'professional'].includes(profile.subscription_tier)

  const addAncestor = () => {
    if (seedAncestors.length >= 5) return
    setSeedAncestors([
      ...seedAncestors,
      { ...EMPTY_ANCESTOR, id: Date.now().toString() },
    ])
  }

  const removeAncestor = (id: string) => {
    if (seedAncestors.length <= 1) return
    setSeedAncestors(seedAncestors.filter(a => a.id !== id))
  }

  const updateAncestor = (id: string, field: keyof SeedAncestor, value: string) => {
    setSeedAncestors(seedAncestors.map(a =>
      a.id === id ? { ...a, [field]: value } : a
    ))
  }

  const isValidInput = () => {
    if (!treeName.trim()) return false
    return seedAncestors.some(a => a.givenNames.trim() || a.surname.trim())
  }

  const handleBuild = async () => {
    if (!isValidInput()) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please provide a tree name and at least one ancestor with a name.',
      })
      return
    }

    setStep('researching')
    setProgress(0)
    setProgressMessage('Starting AI research...')

    try {
      const response = await fetch('/api/ai/build-tree', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          treeName,
          seedAncestors: seedAncestors.filter(a => a.givenNames.trim() || a.surname.trim()),
        }),
      })

      // Handle streaming response
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No response stream')

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n').filter(Boolean)

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6))

            if (data.type === 'progress') {
              setProgress(data.progress)
              setProgressMessage(data.message)
            } else if (data.type === 'complete') {
              setResult(data.result)
              setStep('complete')
            } else if (data.type === 'error') {
              throw new Error(data.error)
            }
          }
        }
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Research Failed',
        description: error instanceof Error ? error.message : 'Something went wrong',
      })
      setStep('input')
    }
  }

  return (
    <>
      <Header title="AI Tree Builder" />

      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-3xl mx-auto">
          {step === 'input' && (
            <div className="space-y-6">
              {/* Hero Section */}
              <div className="text-center mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
                  <Sparkles className="h-8 w-8 text-primary" />
                </div>
                <h1 className="font-serif text-3xl font-bold">AI Tree Builder</h1>
                <p className="text-muted-foreground mt-2 max-w-lg mx-auto">
                  Give us 3-5 ancestors you know about, and our AI will research and build your family tree automatically
                </p>
              </div>

              {/* Upsell for free tier */}
              {!canUseAiBuilder && (
                <Card className="border-primary/50 bg-primary/5">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="h-5 w-5 text-primary" />
                      Upgrade to Use AI Tree Builder
                    </CardTitle>
                    <CardDescription>
                      Let AI do the tedious research for you. Our AI will search historical records,
                      find relatives, and build your tree with notes about what it discovers.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <Search className="h-8 w-8 mx-auto text-primary mb-2" />
                        <p className="text-sm font-medium">Search Records</p>
                        <p className="text-xs text-muted-foreground">Census, vital records, newspapers</p>
                      </div>
                      <div className="text-center">
                        <Users className="h-8 w-8 mx-auto text-primary mb-2" />
                        <p className="text-sm font-medium">Find Relatives</p>
                        <p className="text-xs text-muted-foreground">Parents, siblings, children</p>
                      </div>
                      <div className="text-center">
                        <BookOpen className="h-8 w-8 mx-auto text-primary mb-2" />
                        <p className="text-sm font-medium">Add Notes</p>
                        <p className="text-xs text-muted-foreground">Stories, facts, sources</p>
                      </div>
                    </div>
                    <UpgradePrompt
                      currentTier={profile?.subscription_tier || 'free'}
                      feature="AI Tree Builder"
                      message="Start at $10/month and let AI build your family tree"
                    />
                  </CardContent>
                </Card>
              )}

              {/* Input Form */}
              <Card className={!canUseAiBuilder ? 'opacity-60 pointer-events-none' : ''}>
                <CardHeader>
                  <CardTitle>Your Starting Point</CardTitle>
                  <CardDescription>
                    Enter what you know about your ancestors. The more details, the better the research.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Tree Name */}
                  <div className="space-y-2">
                    <Label htmlFor="tree-name">Family Tree Name *</Label>
                    <Input
                      id="tree-name"
                      placeholder="e.g., Smith Family Tree"
                      value={treeName}
                      onChange={(e) => setTreeName(e.target.value)}
                    />
                  </div>

                  {/* Seed Ancestors */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label>Seed Ancestors ({seedAncestors.length}/5)</Label>
                      {seedAncestors.length < 5 && (
                        <Button variant="outline" size="sm" onClick={addAncestor}>
                          <Plus className="h-4 w-4 mr-1" />
                          Add Ancestor
                        </Button>
                      )}
                    </div>

                    {seedAncestors.map((ancestor, index) => (
                      <Card key={ancestor.id} className="border-dashed">
                        <CardHeader className="py-3">
                          <div className="flex items-center justify-between">
                            <Badge variant="secondary">Ancestor {index + 1}</Badge>
                            {seedAncestors.length > 1 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeAncestor(ancestor.id)}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </CardHeader>
                        <CardContent className="py-2 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Given Names</Label>
                              <Input
                                placeholder="John William"
                                value={ancestor.givenNames}
                                onChange={(e) => updateAncestor(ancestor.id, 'givenNames', e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Surname</Label>
                              <Input
                                placeholder="Smith"
                                value={ancestor.surname}
                                onChange={(e) => updateAncestor(ancestor.id, 'surname', e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Birth Year</Label>
                              <Input
                                placeholder="1850"
                                value={ancestor.birthYear}
                                onChange={(e) => updateAncestor(ancestor.id, 'birthYear', e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Death Year</Label>
                              <Input
                                placeholder="1920"
                                value={ancestor.deathYear}
                                onChange={(e) => updateAncestor(ancestor.id, 'deathYear', e.target.value)}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Relationship</Label>
                              <select
                                className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm"
                                value={ancestor.relationship}
                                onChange={(e) => updateAncestor(ancestor.id, 'relationship', e.target.value)}
                              >
                                <option value="">Select...</option>
                                {RELATIONSHIPS.map(r => (
                                  <option key={r} value={r}>{r}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Birth Place</Label>
                            <Input
                              placeholder="Boston, Massachusetts, USA"
                              value={ancestor.birthPlace}
                              onChange={(e) => updateAncestor(ancestor.id, 'birthPlace', e.target.value)}
                            />
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleBuild}
                    disabled={!isValidInput() || isLoading || !canUseAiBuilder}
                  >
                    <Sparkles className="mr-2 h-5 w-5" />
                    Build My Family Tree with AI
                  </Button>
                </CardFooter>
              </Card>

              {/* How it works */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">How It Works</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="space-y-3 text-sm">
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">1</span>
                      <span>Enter ancestors you know (names, dates, places)</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">2</span>
                      <span>AI searches historical records, newspapers, and genealogy databases</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">3</span>
                      <span>Relatives are added with notes about discovered records and stories</span>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-medium">4</span>
                      <span>Review and verify - AI findings are starting points, not guarantees</span>
                    </li>
                  </ol>
                  <div className="mt-4 p-3 bg-muted rounded-md flex gap-2">
                    <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <p className="text-xs text-muted-foreground">
                      <strong>Note:</strong> AI-discovered ancestors are starting points for your research.
                      Always verify findings with original sources before treating them as fact.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {step === 'researching' && (
            <Card>
              <CardContent className="py-12">
                <div className="text-center space-y-6">
                  <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-primary/10">
                    <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  </div>
                  <div>
                    <h2 className="font-serif text-2xl font-bold">Researching Your Family</h2>
                    <p className="text-muted-foreground mt-2">{progressMessage}</p>
                  </div>
                  <Progress value={progress} className="max-w-md mx-auto" />
                  <p className="text-sm text-muted-foreground">{progress}% complete</p>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'complete' && result && (
            <Card>
              <CardHeader className="text-center">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 mx-auto mb-4">
                  <CheckCircle2 className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle className="font-serif text-2xl">Your Family Tree is Ready!</CardTitle>
                <CardDescription>
                  The AI has researched and built your family tree
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-3xl font-bold text-primary">{result.ancestorsFound}</p>
                    <p className="text-sm text-muted-foreground">Ancestors Found</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-3xl font-bold text-primary">{result.generationsResearched}</p>
                    <p className="text-sm text-muted-foreground">Generations</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-3xl font-bold text-primary">{result.sourcesChecked}</p>
                    <p className="text-sm text-muted-foreground">Sources Checked</p>
                  </div>
                  <div className="text-center p-4 bg-muted rounded-lg">
                    <p className="text-3xl font-bold text-primary">{result.notesAdded}</p>
                    <p className="text-sm text-muted-foreground">Notes Added</p>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-6">
                  <p className="text-sm text-amber-800">
                    <strong>Remember:</strong> These findings are AI-generated starting points.
                    We recommend verifying each ancestor against original records before treating them as confirmed.
                  </p>
                </div>

                <div className="flex gap-4">
                  <Button
                    className="flex-1"
                    onClick={() => router.push(`/tree/${result.treeId}`)}
                  >
                    <TreePine className="mr-2 h-5 w-5" />
                    View Your Tree
                  </Button>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setStep('input')
                      setTreeName('')
                      setSeedAncestors([{ ...EMPTY_ANCESTOR, id: '1', relationship: 'Self (Starting Point)' }])
                      setResult(null)
                    }}
                  >
                    Build Another Tree
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  )
}

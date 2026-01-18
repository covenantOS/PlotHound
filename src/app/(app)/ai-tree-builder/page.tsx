'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  Upload,
  FileText,
  PenLine,
} from 'lucide-react'
import type { SubscriptionTier } from '@/types/database'

interface SeedAncestor {
  id: string
  givenNames: string
  surname: string
  birthYear: string
  birthPlace: string
  deathYear: string
  deathPlace?: string
  relationship: string
  generation?: number
  notes?: string
}

interface ResearchResult {
  ancestorsFound: number
  generationsResearched: number
  sourcesChecked: number
  notesAdded: number
  treeId: string
}

type BuilderStep = 'input' | 'researching' | 'complete'
type InputMode = 'manual' | 'upload'

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

const ACCEPTED_FILE_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'text/plain',
  'text/csv',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]

export default function AiTreeBuilderPage() {
  const [step, setStep] = useState<BuilderStep>('input')
  const [inputMode, setInputMode] = useState<InputMode>('manual')
  const [treeName, setTreeName] = useState('')
  const [seedAncestors, setSeedAncestors] = useState<SeedAncestor[]>([
    { ...EMPTY_ANCESTOR, id: '1', relationship: 'Self (Starting Point)' },
  ])
  const [isLoading, setIsLoading] = useState(false)
  const [isParsingFile, setIsParsingFile] = useState(false)
  const [progress, setProgress] = useState(0)
  const [progressMessage, setProgressMessage] = useState('')
  const [result, setResult] = useState<ResearchResult | null>(null)
  const [profile, setProfile] = useState<{ subscription_tier: SubscriptionTier } | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [additionalContext, setAdditionalContext] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
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
    if (seedAncestors.length >= 20) return
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

  const handleFileSelect = async (file: File) => {
    if (!ACCEPTED_FILE_TYPES.includes(file.type) &&
        !file.name.endsWith('.pdf') &&
        !file.name.endsWith('.docx') &&
        !file.name.endsWith('.doc') &&
        !file.name.endsWith('.txt') &&
        !file.name.endsWith('.csv')) {
      toast({
        variant: 'destructive',
        title: 'Unsupported File Type',
        description: 'Please upload a PDF, Word doc, image, or text file.',
      })
      return
    }

    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File Too Large',
        description: 'Please upload a file smaller than 10MB.',
      })
      return
    }

    setUploadedFile(file)
    setIsParsingFile(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/ai/parse-document', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to parse document')
      }

      const data = await response.json()

      // Set the tree name if we got one
      if (data.treeName && !treeName) {
        setTreeName(data.treeName)
      }

      // Add parsed ancestors
      if (data.ancestors && data.ancestors.length > 0) {
        const newAncestors: SeedAncestor[] = data.ancestors.map((a: {
          givenNames?: string
          surname?: string
          birthYear?: string
          birthPlace?: string
          deathYear?: string
          deathPlace?: string
          relationship?: string
          generation?: number
          notes?: string
        }, index: number) => ({
          id: `parsed-${index}-${Date.now()}`,
          givenNames: a.givenNames || '',
          surname: a.surname || '',
          birthYear: a.birthYear || '',
          birthPlace: a.birthPlace || '',
          deathYear: a.deathYear || '',
          deathPlace: a.deathPlace || '',
          relationship: a.relationship || '',
          generation: a.generation,
          notes: a.notes || '',
        }))

        setSeedAncestors(newAncestors)

        toast({
          title: 'Document Parsed',
          description: `Found ${newAncestors.length} ancestor${newAncestors.length === 1 ? '' : 's'} in your document.`,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'No Ancestors Found',
          description: 'Could not extract ancestor information from this document.',
        })
      }

      // Store additional context
      if (data.additionalContext) {
        setAdditionalContext(data.additionalContext)
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Parse Failed',
        description: error instanceof Error ? error.message : 'Failed to parse document',
      })
      setUploadedFile(null)
    } finally {
      setIsParsingFile(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    const file = e.dataTransfer.files[0]
    if (file) {
      handleFileSelect(file)
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
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
          additionalContext,
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
                  Upload a document or enter ancestors manually, and our AI will research and build your family tree
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

              {/* Input Mode Toggle */}
              <div className={!canUseAiBuilder ? 'opacity-60 pointer-events-none' : ''}>
                <div className="flex gap-2 mb-4">
                  <Button
                    variant={inputMode === 'upload' ? 'default' : 'outline'}
                    onClick={() => setInputMode('upload')}
                    className="flex-1"
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Upload Document
                  </Button>
                  <Button
                    variant={inputMode === 'manual' ? 'default' : 'outline'}
                    onClick={() => setInputMode('manual')}
                    className="flex-1"
                  >
                    <PenLine className="h-4 w-4 mr-2" />
                    Enter Manually
                  </Button>
                </div>

                {/* File Upload Section */}
                {inputMode === 'upload' && (
                  <Card className="mb-4">
                    <CardHeader>
                      <CardTitle className="text-lg">Upload Your Research</CardTitle>
                      <CardDescription>
                        Upload a PDF, Word doc, image, or text file with genealogy data.
                        The AI will extract ancestor information automatically.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div
                        className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                          isDragging ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
                        } ${isParsingFile ? 'pointer-events-none opacity-60' : 'cursor-pointer hover:border-primary/50'}`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <input
                          ref={fileInputRef}
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx,.txt,.csv,.jpg,.jpeg,.png,.gif,.webp"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleFileSelect(file)
                          }}
                        />

                        {isParsingFile ? (
                          <div className="space-y-3">
                            <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
                            <p className="text-sm text-muted-foreground">
                              Analyzing document with AI...
                            </p>
                          </div>
                        ) : uploadedFile ? (
                          <div className="space-y-3">
                            <FileText className="h-10 w-10 mx-auto text-primary" />
                            <div>
                              <p className="font-medium">{uploadedFile.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {(uploadedFile.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                setUploadedFile(null)
                                setSeedAncestors([{ ...EMPTY_ANCESTOR, id: '1', relationship: 'Self (Starting Point)' }])
                              }}
                            >
                              Remove & Upload Different File
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <Upload className="h-10 w-10 mx-auto text-muted-foreground" />
                            <div>
                              <p className="font-medium">Drop your file here or click to browse</p>
                              <p className="text-sm text-muted-foreground mt-1">
                                PDF, Word, images, or text files up to 10MB
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 p-3 bg-muted rounded-md">
                        <p className="text-xs text-muted-foreground">
                          <strong>Supported sources:</strong> Ancestry exports, FamilySearch PDFs,
                          scanned documents, family letters, obituaries, census images, and more.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Input Form */}
              <Card className={!canUseAiBuilder ? 'opacity-60 pointer-events-none' : ''}>
                <CardHeader>
                  <CardTitle>
                    {inputMode === 'upload' && uploadedFile ? 'Review Extracted Ancestors' : 'Your Starting Point'}
                  </CardTitle>
                  <CardDescription>
                    {inputMode === 'upload' && uploadedFile
                      ? 'Review and edit the ancestors extracted from your document. Add more details if needed.'
                      : 'Enter what you know about your ancestors. The more details, the better the research.'
                    }
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
                      <Label>
                        {inputMode === 'upload' ? 'Extracted' : 'Seed'} Ancestors ({seedAncestors.length})
                      </Label>
                      <Button variant="outline" size="sm" onClick={addAncestor}>
                        <Plus className="h-4 w-4 mr-1" />
                        Add Ancestor
                      </Button>
                    </div>

                    <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
                      {seedAncestors.map((ancestor, index) => (
                        <Card key={ancestor.id} className="border-dashed">
                          <CardHeader className="py-3">
                            <div className="flex items-center justify-between">
                              <Badge variant="secondary">
                                {ancestor.givenNames || ancestor.surname
                                  ? `${ancestor.givenNames} ${ancestor.surname}`.trim()
                                  : `Ancestor ${index + 1}`
                                }
                              </Badge>
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
                            {ancestor.notes && (
                              <div className="p-2 bg-muted rounded text-xs text-muted-foreground">
                                <strong>Notes from document:</strong> {ancestor.notes}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>

                  {additionalContext && (
                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-800">
                        <strong>Additional context from document:</strong> {additionalContext}
                      </p>
                    </div>
                  )}
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={handleBuild}
                    disabled={!isValidInput() || isLoading || !canUseAiBuilder || isParsingFile}
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
                      <span>Upload a document or enter ancestors you know (names, dates, places)</span>
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
                      setUploadedFile(null)
                      setAdditionalContext('')
                      setInputMode('manual')
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

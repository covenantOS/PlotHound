'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import { Plus, MoreVertical, Pencil, Trash2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react'
import { UpgradePrompt } from '@/components/layout/upgrade-prompt'
import { EvidenceList } from './evidence-list'
import { canAccessAdvancedAi } from '@/lib/subscription-limits'
import type { Hypothesis, HypothesisStatus, Evidence, SubscriptionTier } from '@/types/database'

const STATUS_CONFIG: Record<HypothesisStatus, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' | 'success' }> = {
  testing: { label: 'Testing', variant: 'secondary' },
  confirmed: { label: 'Confirmed', variant: 'success' },
  disproven: { label: 'Disproven', variant: 'destructive' },
  inconclusive: { label: 'Inconclusive', variant: 'outline' },
}

interface HypothesisWithEvidence extends Hypothesis {
  evidence?: Evidence[]
}

interface HypothesesListProps {
  ancestorId: string
  hypotheses: HypothesisWithEvidence[]
  subscriptionTier: SubscriptionTier
}

export function HypothesesList({ ancestorId, hypotheses, subscriptionTier }: HypothesesListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingHypothesis, setEditingHypothesis] = useState<Hypothesis | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [isLoading, setIsLoading] = useState(false)
  const [status, setStatus] = useState<HypothesisStatus>('testing')
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedIds)
    if (newExpanded.has(id)) {
      newExpanded.delete(id)
    } else {
      newExpanded.add(id)
    }
    setExpandedIds(newExpanded)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)

    const hypothesisData = {
      ancestor_id: ancestorId,
      hypothesis_text: formData.get('hypothesis_text') as string,
      status,
      notes: formData.get('notes') as string || null,
    }

    let error
    if (editingHypothesis) {
      const result = await supabase
        .from('hypotheses')
        .update(hypothesisData)
        .eq('id', editingHypothesis.id)
      error = result.error
    } else {
      const result = await supabase
        .from('hypotheses')
        .insert(hypothesisData)
      error = result.error
    }

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
      setIsLoading(false)
      return
    }

    toast({
      title: editingHypothesis ? 'Hypothesis updated' : 'Hypothesis added',
      description: `The hypothesis has been ${editingHypothesis ? 'updated' : 'added'}.`,
    })

    resetForm()
    router.refresh()
  }

  const handleDelete = async (hypothesisId: string) => {
    const { error } = await supabase
      .from('hypotheses')
      .delete()
      .eq('id', hypothesisId)

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
      return
    }

    toast({
      title: 'Hypothesis deleted',
      description: 'The hypothesis and all its evidence have been removed.',
    })

    router.refresh()
  }

  const resetForm = () => {
    setDialogOpen(false)
    setEditingHypothesis(null)
    setStatus('testing')
    setIsLoading(false)
  }

  const openEdit = (hypothesis: Hypothesis) => {
    setEditingHypothesis(hypothesis)
    setStatus(hypothesis.status)
    setDialogOpen(true)
  }

  const getConfidenceColor = (score: number | null) => {
    if (score === null) return 'bg-muted'
    if (score >= 76) return 'bg-green-600'
    if (score >= 51) return 'bg-yellow-500'
    if (score >= 26) return 'bg-orange-500'
    return 'bg-red-500'
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Hypotheses</h3>
          <p className="text-sm text-muted-foreground">Track theories and the evidence for/against them</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) resetForm()
          else setDialogOpen(true)
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Hypothesis
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingHypothesis ? 'Edit Hypothesis' : 'Add Hypothesis'}</DialogTitle>
                <DialogDescription>
                  Document a theory that needs verification through evidence.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="hypothesis_text">Hypothesis</Label>
                  <Textarea
                    id="hypothesis_text"
                    name="hypothesis_text"
                    defaultValue={editingHypothesis?.hypothesis_text || ''}
                    placeholder="e.g., Johann Mueller who arrived in 1852 is the same person as John Miller in the 1870 census"
                    rows={3}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as HypothesisStatus)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([value, config]) => (
                        <SelectItem key={value} value={value}>{config.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    defaultValue={editingHypothesis?.notes || ''}
                    rows={2}
                    disabled={isLoading}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Saving...' : editingHypothesis ? 'Update' : 'Add Hypothesis'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {hypotheses.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No hypotheses yet. Add theories about this ancestor to track and verify.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {hypotheses.map((hypothesis) => {
            const statusConfig = STATUS_CONFIG[hypothesis.status]
            const isExpanded = expandedIds.has(hypothesis.id)
            const supportingEvidence = hypothesis.evidence?.filter(e => e.evidence_type === 'supports').length || 0
            const contradictingEvidence = hypothesis.evidence?.filter(e => e.evidence_type === 'contradicts').length || 0

            return (
              <Card key={hypothesis.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant={statusConfig.variant as any}>{statusConfig.label}</Badge>
                        {hypothesis.confidence_score !== null && (
                          <div className="flex items-center gap-2">
                            <div className="w-24">
                              <Progress value={hypothesis.confidence_score} className="h-2" />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {hypothesis.confidence_score}%
                            </span>
                          </div>
                        )}
                      </div>
                      <CardTitle className="text-base font-medium">
                        {hypothesis.hypothesis_text}
                      </CardTitle>
                    </div>
                    <div className="flex items-center gap-1">
                      {canAccessAdvancedAi(subscriptionTier) && (
                        <Button variant="ghost" size="icon" title="AI Analysis">
                          <Sparkles className="h-4 w-4" />
                        </Button>
                      )}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(hypothesis)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(hypothesis.id)}
                            className="text-destructive"
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                    <span className="text-green-600">{supportingEvidence} supporting</span>
                    <span className="text-red-600">{contradictingEvidence} contradicting</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    onClick={() => toggleExpanded(hypothesis.id)}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="mr-2 h-4 w-4" />
                        Hide Evidence
                      </>
                    ) : (
                      <>
                        <ChevronDown className="mr-2 h-4 w-4" />
                        Show Evidence ({hypothesis.evidence?.length || 0})
                      </>
                    )}
                  </Button>
                  {isExpanded && (
                    <div className="mt-4 border-t pt-4">
                      <EvidenceList
                        hypothesisId={hypothesis.id}
                        evidence={hypothesis.evidence || []}
                      />
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {!canAccessAdvancedAi(subscriptionTier) && hypotheses.length > 0 && (
        <UpgradePrompt
          currentTier={subscriptionTier}
          feature="AI Hypothesis Scoring"
          message="Let AI analyze your evidence and calculate confidence scores for each hypothesis."
          compact
        />
      )}
    </div>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
import { useToast } from '@/components/ui/use-toast'
import { Plus, ThumbsUp, ThumbsDown, Minus, Trash2 } from 'lucide-react'
import type { Evidence, EvidenceType } from '@/types/database'

const EVIDENCE_TYPE_CONFIG: Record<EvidenceType, { label: string; icon: typeof ThumbsUp; color: string }> = {
  supports: { label: 'Supports', icon: ThumbsUp, color: 'text-green-600' },
  contradicts: { label: 'Contradicts', icon: ThumbsDown, color: 'text-red-600' },
  neutral: { label: 'Neutral', icon: Minus, color: 'text-muted-foreground' },
}

interface EvidenceListProps {
  hypothesisId: string
  evidence: Evidence[]
}

export function EvidenceList({ hypothesisId, evidence }: EvidenceListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('supports')
  const [weight, setWeight] = useState('5')
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)

    const { error } = await supabase
      .from('evidence')
      .insert({
        hypothesis_id: hypothesisId,
        evidence_type: evidenceType,
        evidence_text: formData.get('evidence_text') as string,
        source_citation: formData.get('source_citation') as string || null,
        weight: parseInt(weight),
      })

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
      title: 'Evidence added',
      description: 'The evidence has been recorded.',
    })

    setDialogOpen(false)
    setEvidenceType('supports')
    setWeight('5')
    setIsLoading(false)
    router.refresh()
  }

  const handleDelete = async (evidenceId: string) => {
    const { error } = await supabase
      .from('evidence')
      .delete()
      .eq('id', evidenceId)

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
      return
    }

    toast({
      title: 'Evidence deleted',
      description: 'The evidence has been removed.',
    })

    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Evidence</h4>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline">
              <Plus className="mr-2 h-3 w-3" />
              Add Evidence
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[450px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Add Evidence</DialogTitle>
                <DialogDescription>
                  Add evidence that supports or contradicts this hypothesis.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Evidence Type</Label>
                  <RadioGroup
                    value={evidenceType}
                    onValueChange={(v) => setEvidenceType(v as EvidenceType)}
                    className="flex gap-4"
                  >
                    {Object.entries(EVIDENCE_TYPE_CONFIG).map(([value, config]) => (
                      <div key={value} className="flex items-center space-x-2">
                        <RadioGroupItem value={value} id={`evidence-${value}`} />
                        <Label htmlFor={`evidence-${value}`} className="cursor-pointer flex items-center gap-1">
                          <config.icon className={`h-4 w-4 ${config.color}`} />
                          {config.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="evidence_text">Evidence</Label>
                  <Textarea
                    id="evidence_text"
                    name="evidence_text"
                    placeholder="Describe the evidence..."
                    rows={3}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source_citation">Source</Label>
                  <Input
                    id="source_citation"
                    name="source_citation"
                    placeholder="Where is this evidence from?"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Weight (1-10)</Label>
                  <Select value={weight} onValueChange={setWeight}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((w) => (
                        <SelectItem key={w} value={w.toString()}>
                          {w} - {w <= 3 ? 'Weak' : w <= 6 ? 'Moderate' : 'Strong'}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Adding...' : 'Add Evidence'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {evidence.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No evidence recorded yet.
        </p>
      ) : (
        <div className="space-y-2">
          {evidence.map((e) => {
            const config = EVIDENCE_TYPE_CONFIG[e.evidence_type]
            return (
              <div
                key={e.id}
                className="flex items-start justify-between rounded-md border p-3 text-sm"
              >
                <div className="flex gap-2">
                  <config.icon className={`h-4 w-4 mt-0.5 ${config.color}`} />
                  <div className="space-y-1">
                    <p>{e.evidence_text}</p>
                    {e.source_citation && (
                      <p className="text-xs text-muted-foreground">
                        Source: {e.source_citation}
                      </p>
                    )}
                    <Badge variant="outline" className="text-xs">
                      Weight: {e.weight}/10
                    </Badge>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleDelete(e.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

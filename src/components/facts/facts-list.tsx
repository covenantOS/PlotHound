'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
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
import { Plus, MoreVertical, Pencil, Trash2 } from 'lucide-react'
import type { Fact, Confidence } from '@/types/database'

const FACT_TYPES = [
  'birth', 'death', 'marriage', 'residence', 'occupation',
  'immigration', 'military', 'education', 'religion', 'custom'
]

const CONFIDENCE_COLORS: Record<Confidence, string> = {
  certain: 'bg-green-600',
  probable: 'bg-yellow-500',
  possible: 'bg-orange-500',
  uncertain: 'bg-red-500',
}

interface FactsListProps {
  ancestorId: string
  facts: Fact[]
}

export function FactsList({ ancestorId, facts }: FactsListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingFact, setEditingFact] = useState<Fact | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [factType, setFactType] = useState('')
  const [confidence, setConfidence] = useState<Confidence>('probable')
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)

    const factData = {
      ancestor_id: ancestorId,
      fact_type: factType,
      fact_value: formData.get('fact_value') as string,
      fact_date: formData.get('fact_date') as string || null,
      fact_place: formData.get('fact_place') as string || null,
      source_citation: formData.get('source_citation') as string || null,
      confidence,
      notes: formData.get('notes') as string || null,
    }

    let error
    if (editingFact) {
      const result = await supabase
        .from('facts')
        .update(factData)
        .eq('id', editingFact.id)
      error = result.error
    } else {
      const result = await supabase
        .from('facts')
        .insert(factData)
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
      title: editingFact ? 'Fact updated' : 'Fact added',
      description: `The fact has been ${editingFact ? 'updated' : 'added'}.`,
    })

    setDialogOpen(false)
    setEditingFact(null)
    setFactType('')
    setConfidence('probable')
    setIsLoading(false)
    router.refresh()
  }

  const handleDelete = async (factId: string) => {
    const { error } = await supabase
      .from('facts')
      .delete()
      .eq('id', factId)

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
      return
    }

    toast({
      title: 'Fact deleted',
      description: 'The fact has been removed.',
    })

    router.refresh()
  }

  const openEdit = (fact: Fact) => {
    setEditingFact(fact)
    setFactType(fact.fact_type)
    setConfidence(fact.confidence)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-medium">Known Facts</h3>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setEditingFact(null)
            setFactType('')
            setConfidence('probable')
          }
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Fact
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingFact ? 'Edit Fact' : 'Add Fact'}</DialogTitle>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Fact Type</Label>
                    <Select value={factType} onValueChange={setFactType} required>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {FACT_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Confidence</Label>
                    <Select value={confidence} onValueChange={(v) => setConfidence(v as Confidence)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="certain">Certain</SelectItem>
                        <SelectItem value="probable">Probable</SelectItem>
                        <SelectItem value="possible">Possible</SelectItem>
                        <SelectItem value="uncertain">Uncertain</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="fact_value">Value</Label>
                  <Input
                    id="fact_value"
                    name="fact_value"
                    defaultValue={editingFact?.fact_value || ''}
                    placeholder="e.g., Married to Jane Smith"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="fact_date">Date</Label>
                    <Input
                      id="fact_date"
                      name="fact_date"
                      defaultValue={editingFact?.fact_date || ''}
                      placeholder="e.g., 15 Jun 1880"
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fact_place">Place</Label>
                    <Input
                      id="fact_place"
                      name="fact_place"
                      defaultValue={editingFact?.fact_place || ''}
                      placeholder="City, State"
                      disabled={isLoading}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source_citation">Source Citation</Label>
                  <Input
                    id="source_citation"
                    name="source_citation"
                    defaultValue={editingFact?.source_citation || ''}
                    placeholder="Where did you find this?"
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    name="notes"
                    defaultValue={editingFact?.notes || ''}
                    rows={2}
                    disabled={isLoading}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isLoading || !factType}>
                  {isLoading ? 'Saving...' : editingFact ? 'Update Fact' : 'Add Fact'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {facts.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No facts recorded yet. Add known facts about this ancestor.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {facts.map((fact) => (
            <Card key={fact.id}>
              <CardContent className="flex items-start justify-between p-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="capitalize">
                      {fact.fact_type}
                    </Badge>
                    <span
                      className={`h-2 w-2 rounded-full ${CONFIDENCE_COLORS[fact.confidence]}`}
                      title={`Confidence: ${fact.confidence}`}
                    />
                  </div>
                  <p className="font-medium">{fact.fact_value}</p>
                  {(fact.fact_date || fact.fact_place) && (
                    <p className="text-sm text-muted-foreground">
                      {[fact.fact_date, fact.fact_place].filter(Boolean).join(' - ')}
                    </p>
                  )}
                  {fact.source_citation && (
                    <p className="text-xs text-muted-foreground">
                      Source: {fact.source_citation}
                    </p>
                  )}
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(fact)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(fact.id)}
                      className="text-destructive"
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/use-toast'
import { Plus, MoreVertical, Pencil, Trash2, ExternalLink, Check, X, AlertCircle, RefreshCw } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import type { SourceChecked, SourceOutcome } from '@/types/database'

const SOURCE_TYPES = [
  'census', 'vital', 'church', 'military', 'land',
  'probate', 'newspaper', 'immigration', 'dna', 'other'
]

const REPOSITORIES = [
  'Ancestry.com', 'FamilySearch', 'MyHeritage', 'Findmypast',
  'Newspapers.com', 'Fold3', 'County Courthouse', 'State Archives',
  'National Archives', 'Local Library', 'Family Bible', 'Other'
]

const OUTCOME_CONFIG: Record<SourceOutcome, { label: string; icon: typeof Check; color: string }> = {
  found_record: { label: 'Found Record', icon: Check, color: 'text-green-600' },
  nothing_found: { label: 'Nothing Found', icon: X, color: 'text-muted-foreground' },
  partial_info: { label: 'Partial Info', icon: AlertCircle, color: 'text-yellow-600' },
  need_to_revisit: { label: 'Need to Revisit', icon: RefreshCw, color: 'text-blue-600' },
}

interface SourcesListProps {
  ancestorId: string
  sources: SourceChecked[]
}

export function SourcesList({ ancestorId, sources }: SourcesListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingSource, setEditingSource] = useState<SourceChecked | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [sourceType, setSourceType] = useState('')
  const [repository, setRepository] = useState('')
  const [outcome, setOutcome] = useState<SourceOutcome>('nothing_found')
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)

    const sourceData = {
      ancestor_id: ancestorId,
      source_name: formData.get('source_name') as string,
      source_type: sourceType || null,
      repository: repository || null,
      outcome,
      findings: formData.get('findings') as string || null,
      source_url: formData.get('source_url') as string || null,
    }

    let error
    if (editingSource) {
      const result = await supabase
        .from('sources_checked')
        .update(sourceData)
        .eq('id', editingSource.id)
      error = result.error
    } else {
      const result = await supabase
        .from('sources_checked')
        .insert(sourceData)
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
      title: editingSource ? 'Source updated' : 'Source logged',
      description: `The source has been ${editingSource ? 'updated' : 'logged'}.`,
    })

    resetForm()
    router.refresh()
  }

  const handleDelete = async (sourceId: string) => {
    const { error } = await supabase
      .from('sources_checked')
      .delete()
      .eq('id', sourceId)

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
      return
    }

    toast({
      title: 'Source deleted',
      description: 'The source has been removed.',
    })

    router.refresh()
  }

  const resetForm = () => {
    setDialogOpen(false)
    setEditingSource(null)
    setSourceType('')
    setRepository('')
    setOutcome('nothing_found')
    setIsLoading(false)
  }

  const openEdit = (source: SourceChecked) => {
    setEditingSource(source)
    setSourceType(source.source_type || '')
    setRepository(source.repository || '')
    setOutcome(source.outcome)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Sources Checked</h3>
          <p className="text-sm text-muted-foreground">Track what you have searched and the results</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) resetForm()
          else setDialogOpen(true)
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Log Source
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingSource ? 'Edit Source' : 'Log Source Checked'}</DialogTitle>
                <DialogDescription>
                  Record a source you searched, whether you found something or not.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="source_name">Source Name</Label>
                  <Input
                    id="source_name"
                    name="source_name"
                    defaultValue={editingSource?.source_name || ''}
                    placeholder="e.g., 1850 Federal Census, Hamilton County, Ohio"
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Source Type</Label>
                    <Select value={sourceType} onValueChange={setSourceType}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {SOURCE_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type.charAt(0).toUpperCase() + type.slice(1)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Repository</Label>
                    <Select value={repository} onValueChange={setRepository}>
                      <SelectTrigger>
                        <SelectValue placeholder="Where searched" />
                      </SelectTrigger>
                      <SelectContent>
                        {REPOSITORIES.map((repo) => (
                          <SelectItem key={repo} value={repo}>{repo}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Outcome</Label>
                  <RadioGroup
                    value={outcome}
                    onValueChange={(v) => setOutcome(v as SourceOutcome)}
                    className="grid grid-cols-2 gap-2"
                  >
                    {Object.entries(OUTCOME_CONFIG).map(([value, config]) => (
                      <div key={value} className="flex items-center space-x-2">
                        <RadioGroupItem value={value} id={value} />
                        <Label htmlFor={value} className="cursor-pointer flex items-center gap-1">
                          <config.icon className={`h-4 w-4 ${config.color}`} />
                          {config.label}
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="findings">Findings / Notes</Label>
                  <Textarea
                    id="findings"
                    name="findings"
                    defaultValue={editingSource?.findings || ''}
                    placeholder="What did you find or learn?"
                    rows={3}
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="source_url">URL (optional)</Label>
                  <Input
                    id="source_url"
                    name="source_url"
                    type="url"
                    defaultValue={editingSource?.source_url || ''}
                    placeholder="Link to the source"
                    disabled={isLoading}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Saving...' : editingSource ? 'Update Source' : 'Log Source'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {sources.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No sources logged yet. Start by recording what you have already searched.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {sources.map((source) => {
            const outcomeConfig = OUTCOME_CONFIG[source.outcome]
            return (
              <Card key={source.id}>
                <CardContent className="flex items-start justify-between p-4">
                  <div className="space-y-1 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <outcomeConfig.icon className={`h-4 w-4 ${outcomeConfig.color}`} />
                      <span className="font-medium truncate">{source.source_name}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {source.source_type && (
                        <Badge variant="outline" className="capitalize text-xs">
                          {source.source_type}
                        </Badge>
                      )}
                      {source.repository && (
                        <span className="text-xs text-muted-foreground">{source.repository}</span>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {formatDate(source.date_checked)}
                      </span>
                    </div>
                    {source.findings && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{source.findings}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    {source.source_url && (
                      <Button variant="ghost" size="icon" asChild>
                        <a href={source.source_url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    )}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(source)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDelete(source.id)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}

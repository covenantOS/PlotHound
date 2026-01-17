'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
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
import { Plus, MoreVertical, Pencil, Trash2, Clock } from 'lucide-react'
import { formatDate, formatRelativeDate } from '@/lib/utils'
import type { ResearchLogEntry } from '@/types/database'

interface ResearchLogListProps {
  ancestorId: string
  entries: ResearchLogEntry[]
}

export function ResearchLogList({ ancestorId, entries }: ResearchLogListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingEntry, setEditingEntry] = useState<ResearchLogEntry | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)
    const sessionMinutes = formData.get('session_minutes') as string

    const entryData = {
      ancestor_id: ancestorId,
      entry_text: formData.get('entry_text') as string,
      session_minutes: sessionMinutes ? parseInt(sessionMinutes) : null,
    }

    let error
    if (editingEntry) {
      const result = await supabase
        .from('research_log')
        .update(entryData)
        .eq('id', editingEntry.id)
      error = result.error
    } else {
      const result = await supabase
        .from('research_log')
        .insert(entryData)
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
      title: editingEntry ? 'Entry updated' : 'Entry added',
      description: `Your research log has been ${editingEntry ? 'updated' : 'saved'}.`,
    })

    resetForm()
    router.refresh()
  }

  const handleDelete = async (entryId: string) => {
    const { error } = await supabase
      .from('research_log')
      .delete()
      .eq('id', entryId)

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
      return
    }

    toast({
      title: 'Entry deleted',
      description: 'The log entry has been removed.',
    })

    router.refresh()
  }

  const resetForm = () => {
    setDialogOpen(false)
    setEditingEntry(null)
    setIsLoading(false)
  }

  const openEdit = (entry: ResearchLogEntry) => {
    setEditingEntry(entry)
    setDialogOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-medium">Research Log</h3>
          <p className="text-sm text-muted-foreground">Track your research sessions and discoveries</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          if (!open) resetForm()
          else setDialogOpen(true)
        }}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="mr-2 h-4 w-4" />
              Add Entry
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>{editingEntry ? 'Edit Log Entry' : 'Add Log Entry'}</DialogTitle>
                <DialogDescription>
                  Record what you worked on, discovered, or learned today.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="entry_text">What did you work on?</Label>
                  <Textarea
                    id="entry_text"
                    name="entry_text"
                    defaultValue={editingEntry?.entry_text || ''}
                    placeholder="Describe what you researched, found, or learned..."
                    rows={6}
                    required
                    disabled={isLoading}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="session_minutes">Session Duration (optional)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="session_minutes"
                      name="session_minutes"
                      type="number"
                      min="1"
                      defaultValue={editingEntry?.session_minutes || ''}
                      placeholder="30"
                      className="w-24"
                      disabled={isLoading}
                    />
                    <span className="text-sm text-muted-foreground">minutes</span>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="submit" disabled={isLoading}>
                  {isLoading ? 'Saving...' : editingEntry ? 'Update Entry' : 'Add Entry'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No log entries yet. Start documenting your research sessions.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <Card key={entry.id}>
              <CardContent className="flex items-start justify-between p-4">
                <div className="space-y-1 flex-1">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>{formatDate(entry.log_date)}</span>
                    <span>({formatRelativeDate(entry.log_date)})</span>
                    {entry.session_minutes && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {entry.session_minutes} min
                      </span>
                    )}
                  </div>
                  <p className="whitespace-pre-wrap">{entry.entry_text}</p>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(entry)}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(entry.id)}
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

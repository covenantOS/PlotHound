'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Plus, MoreVertical, Pencil, Trash2, Target, CheckCircle2, XCircle } from 'lucide-react'
import type { ResearchGoal, GoalStatus } from '@/types/database'

const STATUS_CONFIG: Record<GoalStatus, { label: string; icon: typeof Target; color: string }> = {
  active: { label: 'Active', icon: Target, color: 'text-primary' },
  completed: { label: 'Completed', icon: CheckCircle2, color: 'text-green-600' },
  abandoned: { label: 'Abandoned', icon: XCircle, color: 'text-muted-foreground' },
}

interface ResearchGoalsListProps {
  ancestorId: string
  goals: ResearchGoal[]
  compact?: boolean
}

export function ResearchGoalsList({ ancestorId, goals, compact = false }: ResearchGoalsListProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingGoal, setEditingGoal] = useState<ResearchGoal | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)

    const goalData = {
      ancestor_id: ancestorId,
      goal_text: formData.get('goal_text') as string,
      notes: formData.get('notes') as string || null,
    }

    let error
    if (editingGoal) {
      const result = await supabase
        .from('research_goals')
        .update(goalData)
        .eq('id', editingGoal.id)
      error = result.error
    } else {
      const result = await supabase
        .from('research_goals')
        .insert(goalData)
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
      title: editingGoal ? 'Goal updated' : 'Goal added',
      description: `The research goal has been ${editingGoal ? 'updated' : 'added'}.`,
    })

    resetForm()
    router.refresh()
  }

  const handleStatusChange = async (goalId: string, newStatus: GoalStatus) => {
    const { error } = await supabase
      .from('research_goals')
      .update({
        status: newStatus,
        completed_at: newStatus === 'completed' ? new Date().toISOString() : null,
      })
      .eq('id', goalId)

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
      return
    }

    router.refresh()
  }

  const handleDelete = async (goalId: string) => {
    const { error } = await supabase
      .from('research_goals')
      .delete()
      .eq('id', goalId)

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
      return
    }

    toast({
      title: 'Goal deleted',
      description: 'The research goal has been removed.',
    })

    router.refresh()
  }

  const resetForm = () => {
    setDialogOpen(false)
    setEditingGoal(null)
    setIsLoading(false)
  }

  const openEdit = (goal: ResearchGoal) => {
    setEditingGoal(goal)
    setDialogOpen(true)
  }

  const activeGoals = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')
  const displayGoals = compact ? activeGoals.slice(0, 5) : goals

  return (
    <div className="space-y-4">
      {!compact && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">Research Goals</h3>
            <p className="text-sm text-muted-foreground">What you are trying to find for this ancestor</p>
          </div>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        if (!open) resetForm()
        else setDialogOpen(true)
      }}>
        <DialogTrigger asChild>
          <Button size="sm" variant={compact ? 'outline' : 'default'} className={compact ? 'w-full' : ''}>
            <Plus className="mr-2 h-4 w-4" />
            Add Goal
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-[450px]">
          <form onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>{editingGoal ? 'Edit Goal' : 'Add Research Goal'}</DialogTitle>
              <DialogDescription>
                Define what you are trying to find or verify for this ancestor.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="goal_text">Goal</Label>
                <Input
                  id="goal_text"
                  name="goal_text"
                  defaultValue={editingGoal?.goal_text || ''}
                  placeholder="e.g., Find immigration record, Identify parents"
                  required
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="notes">Notes (optional)</Label>
                <Textarea
                  id="notes"
                  name="notes"
                  defaultValue={editingGoal?.notes || ''}
                  placeholder="Additional context or details..."
                  rows={3}
                  disabled={isLoading}
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : editingGoal ? 'Update Goal' : 'Add Goal'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {displayGoals.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-4">
          No research goals set yet.
        </p>
      ) : (
        <div className="space-y-2">
          {displayGoals.map((goal) => {
            const config = STATUS_CONFIG[goal.status]
            return (
              <div
                key={goal.id}
                className={`flex items-start gap-3 rounded-md border p-3 ${
                  goal.status === 'completed' ? 'bg-muted/50' : ''
                }`}
              >
                <Checkbox
                  checked={goal.status === 'completed'}
                  onCheckedChange={(checked) => {
                    handleStatusChange(goal.id, checked ? 'completed' : 'active')
                  }}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${goal.status === 'completed' ? 'line-through text-muted-foreground' : ''}`}>
                    {goal.goal_text}
                  </p>
                  {goal.notes && (
                    <p className="text-xs text-muted-foreground mt-1">{goal.notes}</p>
                  )}
                </div>
                {!compact && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-6 w-6">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openEdit(goal)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleStatusChange(goal.id, 'abandoned')}>
                        <XCircle className="mr-2 h-4 w-4" />
                        Abandon
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(goal.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )
          })}
        </div>
      )}

      {compact && completedGoals.length > 0 && (
        <p className="text-xs text-muted-foreground text-center">
          {completedGoals.length} goal{completedGoals.length !== 1 ? 's' : ''} completed
        </p>
      )}
    </div>
  )
}

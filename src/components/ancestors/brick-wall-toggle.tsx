'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { useToast } from '@/components/ui/use-toast'
import { BrickWall } from 'lucide-react'

interface BrickWallToggleProps {
  ancestorId: string
  isBrickWall: boolean
  brickWallNotes: string | null
}

export function BrickWallToggle({ ancestorId, isBrickWall, brickWallNotes }: BrickWallToggleProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [notes, setNotes] = useState(brickWallNotes || '')
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const handleToggle = async () => {
    setIsLoading(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('ancestors')
      .update({
        is_brick_wall: !isBrickWall,
        brick_wall_notes: !isBrickWall ? notes : null,
      })
      .eq('id', ancestorId)

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
      title: isBrickWall ? 'Brick wall removed' : 'Marked as brick wall',
      description: isBrickWall
        ? 'Great progress on your research!'
        : 'Added to your brick walls list.',
    })

    setOpen(false)
    setIsLoading(false)
    router.refresh()
  }

  const handleSaveNotes = async () => {
    setIsLoading(true)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from('ancestors')
      .update({ brick_wall_notes: notes })
      .eq('id', ancestorId)

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
      title: 'Notes saved',
      description: 'Brick wall notes updated.',
    })

    setOpen(false)
    setIsLoading(false)
    router.refresh()
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant={isBrickWall ? 'destructive' : 'outline'}
          size="sm"
        >
          <BrickWall className="mr-2 h-4 w-4" />
          {isBrickWall ? 'Brick Wall' : 'Mark as Stuck'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="space-y-4">
          <div>
            <h4 className="font-medium">
              {isBrickWall ? 'Brick Wall Notes' : 'Mark as Brick Wall'}
            </h4>
            <p className="text-sm text-muted-foreground">
              {isBrickWall
                ? 'Update your notes about why you are stuck.'
                : 'Document what you have tried and why you are stuck.'}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="brick-wall-notes">Notes</Label>
            <Textarea
              id="brick-wall-notes"
              placeholder="What have you tried? What are the challenges?"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              disabled={isLoading}
            />
          </div>
          <div className="flex justify-end gap-2">
            {isBrickWall ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggle}
                  disabled={isLoading}
                >
                  Remove Brick Wall
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={isLoading}
                >
                  Save Notes
                </Button>
              </>
            ) : (
              <Button
                size="sm"
                onClick={handleToggle}
                disabled={isLoading}
              >
                Mark as Brick Wall
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { useToast } from '@/components/ui/use-toast'
import type { Ancestor } from '@/types/database'

interface EditAncestorDialogProps {
  ancestor: Ancestor & { tree?: { id: string; name: string } | null }
  children: React.ReactNode
}

export function EditAncestorDialog({ ancestor, children }: EditAncestorDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [gender, setGender] = useState<string>(ancestor.gender || '')
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)

    const { error } = await supabase
      .from('ancestors')
      .update({
        given_names: formData.get('given_names') as string || null,
        surname: formData.get('surname') as string || null,
        maiden_name: formData.get('maiden_name') as string || null,
        nicknames: formData.get('nicknames') as string || null,
        gender: gender || null,
        birth_date: formData.get('birth_date') as string || null,
        birth_place: formData.get('birth_place') as string || null,
        death_date: formData.get('death_date') as string || null,
        death_place: formData.get('death_place') as string || null,
        notes: formData.get('notes') as string || null,
      })
      .eq('id', ancestor.id)

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
      title: 'Ancestor updated',
      description: 'Your changes have been saved.',
    })

    setOpen(false)
    setIsLoading(false)
    router.refresh()
  }

  const handleDelete = async () => {
    setIsLoading(true)

    const { error } = await supabase
      .from('ancestors')
      .delete()
      .eq('id', ancestor.id)

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
      title: 'Ancestor deleted',
      description: 'The ancestor has been removed from your tree.',
    })

    router.push(`/tree/${ancestor.tree?.id}`)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Edit Ancestor</DialogTitle>
            <DialogDescription>
              Update information about this ancestor.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="given_names">Given Names</Label>
                <Input
                  id="given_names"
                  name="given_names"
                  defaultValue={ancestor.given_names || ''}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="surname">Surname</Label>
                <Input
                  id="surname"
                  name="surname"
                  defaultValue={ancestor.surname || ''}
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maiden_name">Maiden Name</Label>
                <Input
                  id="maiden_name"
                  name="maiden_name"
                  defaultValue={ancestor.maiden_name || ''}
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="nicknames">Nicknames</Label>
                <Input
                  id="nicknames"
                  name="nicknames"
                  defaultValue={ancestor.nicknames || ''}
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select value={gender} onValueChange={setGender} disabled={isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birth_date">Birth Date</Label>
                <Input
                  id="birth_date"
                  name="birth_date"
                  defaultValue={ancestor.birth_date || ''}
                  placeholder="e.g., 1850, abt 1850"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birth_place">Birth Place</Label>
                <Input
                  id="birth_place"
                  name="birth_place"
                  defaultValue={ancestor.birth_place || ''}
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="death_date">Death Date</Label>
                <Input
                  id="death_date"
                  name="death_date"
                  defaultValue={ancestor.death_date || ''}
                  placeholder="e.g., 1920, abt 1920"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="death_place">Death Place</Label>
                <Input
                  id="death_place"
                  name="death_place"
                  defaultValue={ancestor.death_place || ''}
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                defaultValue={ancestor.notes || ''}
                rows={4}
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button type="button" variant="destructive" disabled={isLoading}>
                  Delete Ancestor
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Ancestor</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to delete this ancestor? This will permanently
                    delete all facts, sources, hypotheses, and research logs associated
                    with them. This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
            <div className="flex gap-2 sm:ml-auto">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading}>
                {isLoading ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

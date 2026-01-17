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
import { useToast } from '@/components/ui/use-toast'

interface CreateAncestorDialogProps {
  treeId: string
  children: React.ReactNode
}

export function CreateAncestorDialog({ treeId, children }: CreateAncestorDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [gender, setGender] = useState<string>('')
  const router = useRouter()
  const { toast } = useToast()
  const supabase = createClient()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)

    const formData = new FormData(e.currentTarget)

    const { data, error } = await supabase
      .from('ancestors')
      .insert({
        tree_id: treeId,
        given_names: formData.get('given_names') as string || null,
        surname: formData.get('surname') as string || null,
        maiden_name: formData.get('maiden_name') as string || null,
        gender: gender || null,
        birth_date: formData.get('birth_date') as string || null,
        birth_place: formData.get('birth_place') as string || null,
        death_date: formData.get('death_date') as string || null,
        death_place: formData.get('death_place') as string || null,
        notes: formData.get('notes') as string || null,
      })
      .select()
      .single()

    if (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message,
      })
      setIsLoading(false)
      return
    }

    const name = [formData.get('given_names'), formData.get('surname')].filter(Boolean).join(' ') || 'Ancestor'

    toast({
      title: 'Ancestor added',
      description: `${name} has been added to your tree.`,
    })

    setOpen(false)
    setIsLoading(false)
    setGender('')
    router.push(`/ancestor/${data.id}`)
    router.refresh()
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Ancestor</DialogTitle>
            <DialogDescription>
              Add basic information about an ancestor. You can add more details later.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="given_names">Given Names</Label>
                <Input
                  id="given_names"
                  name="given_names"
                  placeholder="John William"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="surname">Surname</Label>
                <Input
                  id="surname"
                  name="surname"
                  placeholder="Smith"
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
                  placeholder="If applicable"
                  disabled={isLoading}
                />
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
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="birth_date">Birth Date</Label>
                <Input
                  id="birth_date"
                  name="birth_date"
                  placeholder="e.g., 1850, abt 1850, bef 1860"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="birth_place">Birth Place</Label>
                <Input
                  id="birth_place"
                  name="birth_place"
                  placeholder="City, State, Country"
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
                  placeholder="e.g., 1920, abt 1920"
                  disabled={isLoading}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="death_place">Death Place</Label>
                <Input
                  id="death_place"
                  name="death_place"
                  placeholder="City, State, Country"
                  disabled={isLoading}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                name="notes"
                placeholder="Any initial notes about this ancestor..."
                disabled={isLoading}
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'Adding...' : 'Add Ancestor'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

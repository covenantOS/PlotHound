import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { Toaster } from '@/components/ui/toaster'

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  // Fetch user's trees for sidebar
  const { data: trees } = await supabase
    .from('trees')
    .select('id, name')
    .order('updated_at', { ascending: false })

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar trees={trees || []} />
      <main className="flex flex-1 flex-col overflow-hidden">
        {children}
      </main>
      <Toaster />
    </div>
  )
}

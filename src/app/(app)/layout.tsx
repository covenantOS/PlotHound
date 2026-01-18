import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { Sidebar } from '@/components/layout/sidebar'
import { MobileNav } from '@/components/layout/mobile-nav'
import { Toaster } from '@/components/ui/toaster'

// Force dynamic rendering to always get fresh subscription data
export const dynamic = 'force-dynamic'
export const revalidate = 0

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

  // Fetch user's trees and profile for sidebar
  const [{ data: trees }, { data: profile }] = await Promise.all([
    supabase
      .from('trees')
      .select('id, name')
      .order('updated_at', { ascending: false }),
    supabase
      .from('profiles')
      .select('subscription_tier')
      .eq('id', user.id)
      .single(),
  ])

  const subscriptionTier = (profile as { subscription_tier: string } | null)?.subscription_tier || 'free'

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar - hidden on mobile */}
      <div className="hidden md:flex h-full">
        <Sidebar trees={trees || []} subscriptionTier={subscriptionTier} />
      </div>

      {/* Mobile navigation */}
      <MobileNav trees={trees || []} subscriptionTier={subscriptionTier} />

      <main className="flex flex-1 flex-col overflow-hidden">
        {children}
      </main>
      <Toaster />
    </div>
  )
}

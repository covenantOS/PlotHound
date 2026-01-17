import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  // Note: Database types are not applied here due to manual type definitions.
  // Run `supabase gen types typescript` to generate proper types from your Supabase schema.
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}

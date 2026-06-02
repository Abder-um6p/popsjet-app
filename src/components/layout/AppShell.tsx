import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ResponsiveShell from '@/components/layout/ResponsiveShell'
import type { UserRole } from '@/types/database'

export default async function AppShell({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, email, role, avatar_url, onboarding_completed, disabled_at')
    .eq('id', user.id)
    .single()

  if (!profile?.onboarding_completed) redirect('/auth/onboarding')
  if (profile?.disabled_at) redirect('/auth/login')

  return (
    <ResponsiveShell profile={profile as any}>
      {children}
    </ResponsiveShell>
  )
}

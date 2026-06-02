import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import type { UserRole } from '@/types/database'

export default async function TrashLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, avatar_url, onboarding_completed')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')
  if (!profile.onboarding_completed) redirect('/auth/onboarding')

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar role={profile.role as UserRole} profile={profile as any} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar profile={profile as any} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

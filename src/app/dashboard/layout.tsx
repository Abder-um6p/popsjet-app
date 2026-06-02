import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role, avatar_url, onboarding_completed')
    .eq('id', user.id)
    .single()

  // Si le profil n'existe pas encore (délai trigger), on le crée à la volée
  if (!profile) {
    const supabaseAdmin = await createClient()
    await supabaseAdmin.from('profiles').upsert({
      id: user.id,
      email: user.email ?? '',
      full_name: user.user_metadata?.full_name ?? user.email?.split('@')[0] ?? '',
      role: 'membre',
      onboarding_completed: false,
    })
    redirect('/auth/onboarding')
  }

  if (!profile.onboarding_completed) {
    redirect('/auth/onboarding')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      <Sidebar role={profile.role as import('@/types/database').UserRole} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <TopBar profile={profile as any} />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

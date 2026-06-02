import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users } from 'lucide-react'
import UserTable from './_components/UserTable'

export const dynamic = 'force-dynamic'

export default async function AdminUsersPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'directeur'].includes(profile?.role ?? '')) {
    redirect('/dashboard')
  }

  const isAdmin = profile?.role === 'admin'

  return (
    <div className="space-y-8 max-w-7xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <Users className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">
              Gestion des utilisateurs
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Gérez les accès, rôles et permissions des collaborateurs
            </p>
          </div>
        </div>
      </div>

      <UserTable isAdmin={isAdmin} currentUserId={user.id} />
    </div>
  )
}

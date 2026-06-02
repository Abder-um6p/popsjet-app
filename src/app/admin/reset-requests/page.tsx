import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { createServerClient } from '@supabase/ssr'
import ResetRequestsTable from './_components/ResetRequestsTable'

export const dynamic = 'force-dynamic'

export default async function ResetRequestsPage() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: () => {},
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'directeur'].includes(profile.role)) {
    redirect('/dashboard')
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Demandes de réinitialisation</h1>
        <p className="text-sm text-gray-500 mt-1">
          Validez ou refusez les demandes de réinitialisation de mot de passe
        </p>
      </div>
      <ResetRequestsTable isAdmin={profile.role === 'admin'} />
    </div>
  )
}

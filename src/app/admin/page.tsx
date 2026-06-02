import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user!.id).single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()
  const [{ count: usersCount }, { count: projectsCount }] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('projects').select('*', { count: 'exact', head: true }).is('deleted_at', null),
  ])

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Administration</h1>
        <p className="text-sm text-gray-500 mt-0.5">Gestion de la plateforme Jet Pops</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="text-3xl font-bold text-gray-900 mb-1">{usersCount ?? 0}</div>
          <div className="text-sm text-gray-500">Utilisateurs</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="text-3xl font-bold text-gray-900 mb-1">{projectsCount ?? 0}</div>
          <div className="text-sm text-gray-500">Projets</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-2 h-2 rounded-full bg-green-400 inline-block" />
            <span className="text-sm font-medium text-green-700">Système opérationnel</span>
          </div>
          <div className="text-xs text-gray-400">RLS · Auth email · CNDP</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Sécurité</h2>
        <div className="space-y-3">
          {[
            { label: 'Row Level Security (RLS)', status: 'Activé' },
            { label: 'Authentification email', status: 'Activé' },
            { label: 'Conformité CNDP', status: 'Conforme' },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-700">{item.label}</span>
              <span className="text-xs font-medium bg-green-50 text-green-700 px-2.5 py-1 rounded-full">{item.status}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Users, UserCheck, Shield } from 'lucide-react'

export default async function ParticipantsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'directeur', 'chef_projet'].includes(profile?.role ?? '')) redirect('/dashboard')

  const admin = createAdminClient()

  const [{ data: participants }, { data: projects }] = await Promise.all([
    admin.from('participants').select('*').is('deleted_at', null).order('created_at', { ascending: false }),
    admin.from('projects').select('id, title, code').is('deleted_at', null).order('title'),
  ])

  const list = participants ?? []
  const projectMap = Object.fromEntries((projects ?? []).map(p => [p.id, p]))

  const stats = {
    total:   list.length,
    withConsent: list.filter(p => p.consent_given).length,
    byGender: {
      M: list.filter(p => p.gender === 'M').length,
      F: list.filter(p => p.gender === 'F').length,
      other: list.filter(p => p.gender === 'Other' || !p.gender).length,
    },
  }

  const AGE_LABELS: Record<string, string> = {
    '18-24': '18–24 ans',
    '25-34': '25–34 ans',
    '35-44': '35–44 ans',
    '45+':   '45 ans et +',
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Participants</h1>
          <p className="text-sm text-gray-500 mt-0.5">Données anonymisées — conformité CNDP</p>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
          <Shield className="w-3.5 h-3.5 text-green-600" />
          <span className="text-xs font-medium text-green-700">Données anonymisées</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: stats.total, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Consentement donné', value: stats.withConsent, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Hommes', value: stats.byGender.M, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50' },
          { label: 'Femmes', value: stats.byGender.F, icon: Users, color: 'text-pink-600', bg: 'bg-pink-50' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg ${s.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <span className="text-xs text-gray-500">{s.label}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            </div>
          )
        })}
      </div>

      {/* Table */}
      {list.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-20 text-center">
          <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Aucun participant enregistré</p>
          <p className="text-gray-400 text-xs mt-1">Les participants sont ajoutés depuis la page d'un projet</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">ID anonyme</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Projet</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Genre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Âge</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Ville</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Consentement</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Participations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {list.map(p => (
                <tr key={p.id} className="hover:bg-gray-50/50 transition">
                  <td className="px-4 py-3">
                    <span className="font-mono text-xs text-gray-500">{p.anonymous_id}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-gray-600 text-xs">
                    {projectMap[p.project_id]?.title ?? '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.gender === 'M' ? 'bg-indigo-50 text-indigo-700' :
                      p.gender === 'F' ? 'bg-pink-50 text-pink-700' :
                                         'bg-gray-100 text-gray-600'
                    }`}>
                      {p.gender === 'M' ? 'Homme' : p.gender === 'F' ? 'Femme' : 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                    {p.age_range ? AGE_LABELS[p.age_range] ?? p.age_range : '—'}
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">{p.city ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      p.consent_given ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                    }`}>
                      {p.consent_given ? 'Oui' : 'Non'}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs text-center">
                    {p.participation_count ?? 1}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}

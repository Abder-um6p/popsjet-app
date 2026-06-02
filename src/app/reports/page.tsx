import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BarChart2, TrendingUp, Users, CheckSquare, FolderKanban } from 'lucide-react'

function Bar({ pct, color = 'bg-blue-500' }: { pct: number; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      <span className="text-xs text-gray-500 w-8 text-right">{Math.round(pct)}%</span>
    </div>
  )
}

export default async function ReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'directeur'].includes(profile?.role ?? '')) redirect('/dashboard')

  const admin = createAdminClient()

  const [
    { data: projects },
    { data: tasks },
    { data: profiles },
    { data: participants },
    { data: expenses },
  ] = await Promise.all([
    admin.from('projects').select('id, type, status, budget, completion_pct, created_at').is('deleted_at', null),
    admin.from('tasks').select('id, status, priority, created_at').is('deleted_at', null),
    admin.from('profiles').select('id, role, created_at').eq('onboarding_completed', true),
    admin.from('participants').select('id, gender, age_range, consent_given').is('deleted_at', null),
    // M-03 : filtre deleted_at IS NULL — exclut les dépenses supprimées des stats financières
    admin.from('expenses').select('id, amount, status, category').is('deleted_at', null),
  ])

  const P = projects ?? []
  const T = tasks ?? []
  const U = profiles ?? []
  const PA = participants ?? []
  const EX = expenses ?? []

  // Project stats
  const projectByStatus = {
    draft:     P.filter(p => p.status === 'draft').length,
    active:    P.filter(p => p.status === 'active').length,
    completed: P.filter(p => p.status === 'completed').length,
    archived:  P.filter(p => p.status === 'archived').length,
  }
  const projectByType: Record<string, number> = {}
  P.forEach(p => { projectByType[p.type] = (projectByType[p.type] ?? 0) + 1 })

  const avgCompletion = P.length ? Math.round(P.reduce((s, p) => s + (p.completion_pct ?? 0), 0) / P.length) : 0
  const totalBudget   = P.reduce((s, p) => s + (p.budget ?? 0), 0)

  // Task stats
  const taskByStatus = {
    todo:        T.filter(t => t.status === 'todo').length,
    in_progress: T.filter(t => t.status === 'in_progress').length,
    review:      T.filter(t => t.status === 'review').length,
    done:        T.filter(t => t.status === 'done').length,
  }
  const taskDoneRate = T.length ? (taskByStatus.done / T.length) * 100 : 0

  // User stats
  const userByRole: Record<string, number> = {}
  U.forEach(u => { userByRole[u.role] = (userByRole[u.role] ?? 0) + 1 })

  // Expense stats
  const totalApproved = EX.filter(e => e.status === 'approved').reduce((s, e) => s + e.amount, 0)
  const totalPending  = EX.filter(e => e.status === 'pending').reduce((s, e) => s + e.amount, 0)

  // Participants stats
  const participantsByGender = {
    M: PA.filter(p => p.gender === 'M').length,
    F: PA.filter(p => p.gender === 'F').length,
  }
  const consentRate = PA.length ? (PA.filter(p => p.consent_given).length / PA.length) * 100 : 0

  const TYPE_LABELS: Record<string, string> = {
    workshop: 'Workshop', hackathon: 'Hackathon', bootcamp: 'Bootcamp',
    incubation: 'Incubation', meeting: 'Réunion', other: 'Autre',
    structured: 'Structuré', flexible: 'Flexible',
  }
  const ROLE_LABELS: Record<string, string> = {
    admin: 'Admin', directeur: 'Directeur', chef_projet: 'Chef projet', membre: 'Membre',
  }

  return (
    <div className="space-y-8 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Reporting</h1>
        <p className="text-sm text-gray-500 mt-0.5">Vue d'ensemble de la plateforme — indicateurs MEL</p>
      </div>

      {/* KPIs globaux */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Projets',      value: P.length,   icon: FolderKanban, color: 'text-blue-600',   bg: 'bg-blue-50' },
          { label: 'Tâches',       value: T.length,   icon: CheckSquare,  color: 'text-green-600',  bg: 'bg-green-50' },
          { label: 'Utilisateurs', value: U.length,   icon: Users,        color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Participants', value: PA.length,  icon: Users,        color: 'text-pink-600',   bg: 'bg-pink-50' },
        ].map(k => {
          const Icon = k.icon
          return (
            <div key={k.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg ${k.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${k.color}`} />
                </div>
                <span className="text-xs text-gray-500">{k.label}</span>
              </div>
              <div className="text-2xl font-bold text-gray-900">{k.value}</div>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Projets par statut */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <FolderKanban className="w-4 h-4 text-blue-600" /> Projets par statut
          </h2>
          <div className="space-y-3">
            {[
              { label: 'Actifs',     value: projectByStatus.active,    color: 'bg-blue-500' },
              { label: 'Terminés',   value: projectByStatus.completed,  color: 'bg-green-500' },
              { label: 'Brouillons', value: projectByStatus.draft,      color: 'bg-gray-400' },
              { label: 'Archivés',   value: projectByStatus.archived,   color: 'bg-red-400' },
            ].map(s => (
              <div key={s.label}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{s.label}</span><span className="font-semibold">{s.value}</span>
                </div>
                <Bar pct={P.length ? (s.value / P.length) * 100 : 0} color={s.color} />
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-sm">
            <span className="text-gray-500">Avancement moyen</span>
            <span className="font-bold text-gray-900">{avgCompletion}%</span>
          </div>
        </div>

        {/* Projets par type */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-purple-600" /> Projets par type
          </h2>
          {Object.keys(projectByType).length === 0 ? (
            <p className="text-sm text-gray-400 py-6 text-center">Aucun projet</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(projectByType).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
                <div key={type}>
                  <div className="flex justify-between text-xs text-gray-600 mb-1">
                    <span>{TYPE_LABELS[type] ?? type}</span><span className="font-semibold">{count}</span>
                  </div>
                  <Bar pct={P.length ? (count / P.length) * 100 : 0} color="bg-purple-500" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tâches */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <CheckSquare className="w-4 h-4 text-green-600" /> Tâches
          </h2>
          <div className="space-y-3">
            {[
              { label: 'À faire',      value: taskByStatus.todo,        color: 'bg-gray-400' },
              { label: 'En cours',     value: taskByStatus.in_progress, color: 'bg-blue-500' },
              { label: 'En révision',  value: taskByStatus.review,      color: 'bg-yellow-500' },
              { label: 'Terminées',    value: taskByStatus.done,        color: 'bg-green-500' },
            ].map(s => (
              <div key={s.label}>
                <div className="flex justify-between text-xs text-gray-600 mb-1">
                  <span>{s.label}</span><span className="font-semibold">{s.value}</span>
                </div>
                <Bar pct={T.length ? (s.value / T.length) * 100 : 0} color={s.color} />
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between text-sm">
            <span className="text-gray-500">Taux de complétion</span>
            <span className="font-bold text-green-600">{Math.round(taskDoneRate)}%</span>
          </div>
        </div>

        {/* Équipe & Participants */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-600" /> Équipe par rôle
            </h2>
            <div className="space-y-2">
              {Object.entries(userByRole).sort((a, b) => b[1] - a[1]).map(([role, count]) => (
                <div key={role} className="flex items-center justify-between text-sm py-1">
                  <span className="text-gray-700">{ROLE_LABELS[role] ?? role}</span>
                  <span className="font-semibold text-gray-900">{count}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-base font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-pink-600" /> Participants & Budget
            </h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Taux consentement CNDP</span>
                <span className="font-semibold text-green-600">{Math.round(consentRate)}%</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Hommes / Femmes</span>
                <span className="font-semibold">{participantsByGender.M} / {participantsByGender.F}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Budget total projets</span>
                <span className="font-semibold">{totalBudget.toLocaleString('fr-MA')} MAD</span>
              </div>
              <div className="flex justify-between py-1 border-b border-gray-50">
                <span className="text-gray-500">Dépenses approuvées</span>
                <span className="font-semibold text-green-600">{totalApproved.toLocaleString('fr-MA')} MAD</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-gray-500">Dépenses en attente</span>
                <span className="font-semibold text-yellow-600">{totalPending.toLocaleString('fr-MA')} MAD</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}

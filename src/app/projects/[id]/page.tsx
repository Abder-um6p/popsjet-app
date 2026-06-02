import { createClient, createAdminClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatDate, formatAmount, projectStatusColor, LABELS } from '@/lib/utils'
import { Calendar, DollarSign, Users, CheckSquare, Edit, Plus } from 'lucide-react'
import Link from 'next/link'
import TaskRow from './_components/TaskRow'
import BulkTaskImport from './_components/BulkTaskImport'
import BackButton from './_components/BackButton'
import ProjectSummaryAI from './_components/ProjectSummaryAI'
import ProjectRisksAI from './_components/ProjectRisksAI'
import ProjectReportAI from './_components/ProjectReportAI'

// ─── Types locaux ─────────────────────────────────────────────────────────────

type MemberProfile = { id: string; full_name: string; email: string } | null

type Member = {
  id: string
  role: string
  profile: MemberProfile
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return notFound()

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  // Client admin pour contourner la récursion RLS de project_members
  const admin = createAdminClient()

  // ── Projet ──────────────────────────────────────────────────────────────────
  const { data: project } = await admin
    .from('projects')
    .select('*')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!project) notFound()

  // ── Tâches + Membres + Dépenses en parallèle ─────────────────────────────
  const [
    { data: tasks },
    { data: rawMembers },
    { data: approvedExpenses },
  ] = await Promise.all([
    admin.from('tasks')
      .select('id, title, status, priority, due_date, assigned_to')
      .eq('project_id', id).is('deleted_at', null)
      .order('created_at', { ascending: false }),
    admin.from('project_members')
      .select('id, profile_id, role')
      .eq('project_id', id),
    admin.from('expenses')
      .select('amount')
      .eq('project_id', id)
      .eq('status', 'approved')
      .is('deleted_at', null),
  ])

  // ── Calcul financier ──────────────────────────────────────────────────────
  const budget         = project.budget ?? 0
  const totalApproved  = (approvedExpenses ?? []).reduce((s: number, e: any) => s + (e.amount ?? 0), 0)
  const remaining      = budget > 0 ? budget - totalApproved : null
  const consumedPct    = budget > 0 ? Math.min(Math.round((totalApproved / budget) * 100), 100) : null
  const budgetAlert    = consumedPct !== null && consumedPct >= 80

  // ── Profils (membres + assignés tâches) ────────────────────────────────────
  const memberProfileIds = (rawMembers ?? [])
    .map(m => m.profile_id)
    .filter((x): x is string => Boolean(x))

  const taskAssigneeIds = (tasks ?? [])
    .map(t => t.assigned_to)
    .filter((x): x is string => Boolean(x))

  const allProfileIds = [...new Set([...memberProfileIds, ...taskAssigneeIds])]

  const { data: profilesList } = allProfileIds.length
    ? await admin.from('profiles').select('id, full_name, email').in('id', allProfileIds)
    : { data: [] }

  const profileMap = Object.fromEntries((profilesList ?? []).map(p => [p.id, p]))

  // ── Membres typés ───────────────────────────────────────────────────────────
  const members: Member[] = (rawMembers ?? []).map(m => ({
    id: m.id,
    role: m.role ?? '—',
    profile: m.profile_id ? (profileMap[m.profile_id] ?? null) : null,
  }))

  // ── Stats ───────────────────────────────────────────────────────────────────
  const canEdit    = ['admin', 'directeur', 'chef_projet'].includes(profile?.role ?? '')
  const tasksDone  = tasks?.filter(t => t.status === 'done').length ?? 0
  const tasksTotal = tasks?.length ?? 0

  // completion_pct : calcul live depuis tâches si disponibles, sinon DB, sinon 0
  const completionPct = tasksTotal > 0
    ? Math.round((tasksDone / tasksTotal) * 100)
    : (project.completion_pct ?? 0)

  const byStatus = {
    todo:        tasks?.filter(t => t.status === 'todo') ?? [],
    in_progress: tasks?.filter(t => t.status === 'in_progress') ?? [],
    review:      tasks?.filter(t => t.status === 'review') ?? [],
    done:        tasks?.filter(t => t.status === 'done') ?? [],
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <BackButton />
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs text-gray-400">{project.code}</span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${projectStatusColor(project.status)}`}>
                {LABELS.project_status[project.status as keyof typeof LABELS.project_status]}
              </span>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                {LABELS.project_type[project.type as keyof typeof LABELS.project_type]}
              </span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">{project.title}</h1>
            {project.description && (
              <p className="text-gray-500 text-sm mt-1 max-w-2xl">{project.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ProjectSummaryAI
            project={{ ...project, completion_pct: completionPct }}
            tasks={tasks ?? []}
            members={members.map(m => ({ id: m.profile?.id ?? '', full_name: m.profile?.full_name ?? '' })).filter(m => m.id)}
          />
          <ProjectRisksAI
            project={{ ...project, completion_pct: completionPct }}
            tasks={tasks ?? []}
            members={members.map(m => ({ id: m.profile?.id ?? '', full_name: m.profile?.full_name ?? '' })).filter(m => m.id)}
          />
          <ProjectReportAI
            project={{ ...project, completion_pct: completionPct }}
            tasks={tasks ?? []}
            members={members.map(m => ({ id: m.profile?.id ?? '', full_name: m.profile?.full_name ?? '' })).filter(m => m.id)}
          />
          {canEdit && (<>
            <Link href={`/projects/${id}/members`}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
              <Users className="w-4 h-4" /> Membres
            </Link>
            <Link href={`/projects/${id}/edit`}
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition">
              <Edit className="w-4 h-4" /> Modifier
            </Link>
          </>)}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2"><Calendar className="w-4 h-4 text-gray-400" /><span className="text-xs text-gray-500">Période</span></div>
          <div className="text-sm font-medium text-gray-800">{formatDate(project.start_date)} → {formatDate(project.end_date)}</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2"><DollarSign className="w-4 h-4 text-gray-400" /><span className="text-xs text-gray-500">Budget</span></div>
          <div className="text-sm font-medium text-gray-800">
            {formatAmount(project.budget ?? 0, project.budget_currency ?? 'MAD')}
          </div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2"><CheckSquare className="w-4 h-4 text-gray-400" /><span className="text-xs text-gray-500">Tâches</span></div>
          <div className="text-sm font-medium text-gray-800">{tasksDone}/{tasksTotal} terminées</div>
        </div>
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
          <div className="flex items-center gap-2 mb-2"><Users className="w-4 h-4 text-gray-400" /><span className="text-xs text-gray-500">Équipe</span></div>
          <div className="text-sm font-medium text-gray-800">{members.length} membre{members.length > 1 ? 's' : ''}</div>
        </div>
      </div>

      {/* Widget financier FIN-04 */}
      {budget > 0 && (
        <div className={`bg-white rounded-xl border shadow-sm p-5 ${budgetAlert ? 'border-amber-300 bg-amber-50/40' : 'border-gray-100'}`}>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <DollarSign className={`w-4 h-4 ${budgetAlert ? 'text-amber-500' : 'text-gray-400'}`} />
              <span className="text-sm font-semibold text-gray-800">Suivi budgétaire</span>
            </div>
            {budgetAlert && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-amber-100 text-amber-700 text-xs font-semibold rounded-full border border-amber-200">
                ⚠ {consumedPct}% consommé
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Budget total</p>
              <p className="text-base font-bold text-gray-900">{formatAmount(budget, project.budget_currency ?? 'MAD')}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Dépenses approuvées</p>
              <p className={`text-base font-bold ${budgetAlert ? 'text-amber-600' : 'text-gray-900'}`}>
                {formatAmount(totalApproved, project.budget_currency ?? 'MAD')}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Budget restant</p>
              <p className={`text-base font-bold ${remaining !== null && remaining < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {remaining !== null ? formatAmount(remaining, project.budget_currency ?? 'MAD') : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">Consommé</p>
              <p className={`text-base font-bold ${budgetAlert ? 'text-amber-600' : 'text-gray-900'}`}>
                {consumedPct !== null ? `${consumedPct}%` : '—'}
              </p>
            </div>
          </div>
          {consumedPct !== null && (
            <div>
              <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className={`h-2 rounded-full transition-all ${consumedPct >= 100 ? 'bg-red-500' : consumedPct >= 80 ? 'bg-amber-400' : 'bg-green-500'}`}
                  style={{ width: `${consumedPct}%` }}
                />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Avancement */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-5 py-3">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-gray-500 shrink-0">Avancement global</span>
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${Math.min(Math.max(completionPct, 0), 100)}%` }}
            />
          </div>
          <span className="text-xs font-bold text-gray-700 shrink-0 w-9 text-right">{completionPct}%</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Tâches */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-800">Tâches ({tasksTotal})</h2>
            <div className="flex items-center gap-2">
              <BulkTaskImport
                project={{
                  id,
                  title: project.title,
                  type: project.type,
                  start_date: project.start_date,
                  end_date: project.end_date,
                  description: project.description,
                }}
                members={members
                  .map(m => ({ id: m.profile?.id ?? '', full_name: m.profile?.full_name ?? '' }))
                  .filter(m => m.id)}
                projectId={id}
              />
              {canEdit && (
                <Link href={`/projects/${id}/tasks/new`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition">
                  <Plus className="w-3.5 h-3.5" /> Ajouter
                </Link>
              )}
            </div>
          </div>

          {tasksTotal === 0 ? (
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-12 text-center">
              <CheckSquare className="w-8 h-8 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Aucune tâche</p>
              {canEdit && (
                <Link href={`/projects/${id}/tasks/new`} className="mt-2 inline-block text-xs text-blue-600 hover:underline">
                  Créer la première tâche →
                </Link>
              )}
            </div>
          ) : (
            <>
              {(['in_progress', 'todo', 'review', 'done'] as const).map(status => {
                const group = byStatus[status]
                if (!group.length) return null
                const labels: Record<string, string> = {
                  todo: '📋 À faire',
                  in_progress: '🔵 En cours',
                  review: '👁 En révision',
                  done: '✅ Terminées',
                }
                return (
                  <div key={status} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-gray-50 bg-gray-50/50">
                      <span className="text-xs font-semibold text-gray-600">{labels[status]} ({group.length})</span>
                    </div>
                    <div className="divide-y divide-gray-50">
                      {group.map(task => (
                        <TaskRow
                          key={task.id}
                          task={{ ...task, assignee: task.assigned_to ? (profileMap[task.assigned_to] ?? null) : null }}
                          projectId={id}
                          canEdit={canEdit}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </>
          )}
        </div>

        {/* Équipe */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 h-fit">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Équipe</h2>
            {canEdit && (
              <Link href={`/projects/${id}/members`} className="text-xs text-blue-600 hover:underline">Gérer</Link>
            )}
          </div>
          {members.length === 0 ? (
            <div className="py-4 text-center">
              <Users className="w-6 h-6 text-gray-200 mx-auto mb-1.5" />
              <p className="text-sm text-gray-400">Aucun membre</p>
              {canEdit && (
                <Link href={`/projects/${id}/members`} className="mt-1 inline-block text-xs text-blue-600 hover:underline">
                  Ajouter des membres →
                </Link>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {members.map(m => (
                <div key={m.id} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 text-xs font-semibold flex-shrink-0">
                    {m.profile?.full_name?.charAt(0).toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-gray-700 truncate">
                      {m.profile?.full_name ?? (
                        <span className="text-gray-400 italic text-xs">Utilisateur inconnu</span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 capitalize">{m.role}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

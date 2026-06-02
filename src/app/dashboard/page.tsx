import { createClient, createAdminClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatDate, taskPriorityColor, LABELS } from '@/lib/utils'
import {
  FolderKanban, CheckSquare, Clock,
  Plus, Upload, CreditCard, ArrowRight, Calendar,
} from 'lucide-react'
import { PopcornIcon } from '@/components/ui/PopcornIcon'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'
import AIEmailImport from '@/components/ai/AIEmailImport'
import DashboardTasksWidget from './_components/DashboardTasksWidget'

function greeting(name: string) {
  const hour = new Date().getHours()
  const prefix = hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir'
  return `${prefix}, ${name.split(' ')[0]} 👋`
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single()

  const admin = createAdminClient()
  const now = new Date()

  // ── Requêtes parallèles ───────────────────────────────────────────────────
  // completion_pct est une colonne optionnelle — si elle n'existe pas, la query
  // des projets échoue silencieusement et on retombe sur un tableau vide.
  // On la récupère séparément pour ne pas bloquer l'ensemble.

  const [
    projectsResult,
    tasksResult,
    popsResult,
    pendingExpensesResult,
  ] = await Promise.all([
    // Projets — colonnes garanties uniquement (pas completion_pct)
    admin
      .from('projects')
      .select('id, code, title, type, status, start_date, end_date')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
      .limit(8),
    // Tâches assignées — statut + priorité + échéance
    admin
      .from('tasks')
      .select('id, title, status, priority, due_date, project_id')
      .eq('assigned_to', user.id)
      .is('deleted_at', null)
      .neq('status', 'done')
      .neq('status', 'cancelled')
      .order('due_date', { ascending: true, nullsFirst: false })
      .limit(50),
    // Pops récents
    admin
      .from('pops')
      .select('id, content, created_at, author:profiles!pops_author_id_fkey(full_name)')
      .order('created_at', { ascending: false })
      .limit(5),
    // Dépenses en attente — count uniquement
    admin
      .from('expenses')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending'),
  ])

  const projects = projectsResult.data ?? []
  const tasks    = tasksResult.data ?? []
  const pops     = popsResult.data ?? []

  // ── Récupérer completion_pct séparément (optionnel, ne bloque pas) ─────────
  type CompletionMap = Record<string, number>
  let completionMap: CompletionMap = {}

  if (projects.length > 0) {
    const projectIds = projects.map(p => p.id)
    const { data: completionData } = await admin
      .from('projects')
      .select('id, completion_pct')
      .in('id', projectIds)
    if (completionData) {
      completionData.forEach(p => {
        completionMap[p.id] = p.completion_pct ?? 0
      })
    }
  }

  // ── Stats ─────────────────────────────────────────────────────────────────
  const activeProjects    = projects.filter(p => p.status === 'active')
  const completedProjects = projects.filter(p => p.status === 'completed')
  const overdueTasks      = tasks.filter(t => t.due_date && new Date(t.due_date) < now)
  const pendingCount      = (pendingExpensesResult as any)?.count ?? 0

  const kpis = [
    {
      label: 'Tâches en cours',
      value: tasks.length,
      icon: CheckSquare,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-100',
      sub: overdueTasks.length > 0 ? `${overdueTasks.length} en retard` : 'À jour',
      subColor: overdueTasks.length > 0 ? 'text-red-500' : 'text-green-500',
    },
    {
      label: 'Projets actifs',
      value: activeProjects.length,
      icon: FolderKanban,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
      border: 'border-indigo-100',
      sub: `${completedProjects.length} terminé${completedProjects.length > 1 ? 's' : ''}`,
      subColor: 'text-gray-400',
    },
    {
      label: 'Dépenses en attente',
      value: pendingCount,
      icon: CreditCard,
      color: 'text-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-100',
      sub: 'À valider',
      subColor: 'text-gray-400',
    },
    {
      label: 'Pops récents',
      value: pops.length,
      icon: PopcornIcon,
      color: 'text-amber-500',
      bg: 'bg-yellow-50',
      border: 'border-yellow-100',
      sub: 'Cette semaine',
      subColor: 'text-gray-400',
    },
  ]

  const quickActions = [
    { label: 'Mes tâches',      href: '/tasks',      icon: Plus,        color: 'bg-blue-600 hover:bg-blue-700 text-white' },
    { label: 'Upload document', href: '/documents',  icon: Upload,      color: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200' },
    { label: 'Nouvelle dépense',href: '/expenses',   icon: CreditCard,  color: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200' },
    { label: 'Créer un Pop',    href: '/pops',       icon: PopcornIcon, color: 'bg-white hover:bg-gray-50 text-gray-700 border border-gray-200' },
  ]

  const today = format(now, 'EEEE d MMMM yyyy', { locale: fr })
  const todayCapitalized = today.charAt(0).toUpperCase() + today.slice(1)

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">
            {greeting(profile?.full_name ?? 'vous')}
          </h1>
          <p className="text-sm text-gray-500 mt-1 flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5" />
            {todayCapitalized}
          </p>
        </div>
        <Link href="/projects/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition">
          <Plus className="w-4 h-4" /> Nouveau projet
        </Link>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(kpi => {
          const Icon = kpi.icon
          return (
            <div key={kpi.label} className={`bg-white rounded-xl border ${kpi.border} shadow-sm p-5`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg ${kpi.bg} flex items-center justify-center`}>
                  <Icon className={`w-4 h-4 ${kpi.color}`} />
                </div>
                <span className="text-xs text-gray-500 font-medium">{kpi.label}</span>
              </div>
              <div className="text-3xl font-bold text-gray-900 mb-1">{kpi.value}</div>
              <p className={`text-xs font-medium ${kpi.subColor}`}>{kpi.sub}</p>
            </div>
          )
        })}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Actions rapides</h2>
        <div className="flex flex-wrap gap-2">
          {quickActions.map(action => {
            const Icon = action.icon
            return (
              <Link key={action.label} href={action.href}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${action.color}`}>
                <Icon className="w-4 h-4" />
                {action.label}
              </Link>
            )
          })}
          <AIEmailImport variant="white" userId={user.id} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mes tâches — UX-07 : Voir plus */}
        <DashboardTasksWidget tasks={tasks} />

        {/* Projets actifs */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
            <h2 className="text-base font-semibold text-gray-800">Projets actifs</h2>
            <Link href="/projects" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
              Voir tout <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
          {activeProjects.length === 0 ? (
            <div className="py-12 text-center">
              <FolderKanban className="w-8 h-8 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">Aucun projet actif</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {activeProjects.slice(0, 5).map(project => {
                // completion_pct : depuis la map optionnelle, fallback 0
                const pct = Math.min(Math.max(completionMap[project.id] ?? 0, 0), 100)
                return (
                  <Link key={project.id} href={`/projects/${project.id}`}
                    className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors group">
                    <span className="font-mono text-xs text-gray-400 w-14 shrink-0">{project.code}</span>
                    <span className="text-sm text-gray-700 flex-1 truncate group-hover:text-blue-600 transition-colors">
                      {project.title}
                    </span>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                        <div className="bg-blue-500 h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs text-gray-400 w-8 text-right">{pct}%</span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Activité récente — Pops */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2">
            <PopcornIcon className="w-4 h-4 text-amber-500" />
            Activité récente — Pops
          </h2>
          <Link href="/pops" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
            Voir tout <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
        {pops.length === 0 ? (
          <div className="py-10 text-center">
            <PopcornIcon className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucun Pop récent</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {pops.map(pop => {
              const author = pop.author as any
              return (
                <div key={pop.id} className="flex items-start gap-3 px-5 py-3">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold shrink-0 mt-0.5">
                    {author?.full_name?.charAt(0)?.toUpperCase() ?? '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-semibold text-gray-800">{author?.full_name ?? 'Anonyme'} </span>
                    <span className="text-xs text-gray-600 line-clamp-1">{pop.content}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 shrink-0 mt-0.5">
                    {format(new Date(pop.created_at), 'dd MMM', { locale: fr })}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

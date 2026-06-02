import { createAdminClient, createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import {
  Layers, ArrowLeft, FolderKanban, CheckCircle2,
  Calendar, TrendingUp, ExternalLink, Edit, Lock,
  Target, Users, FileText, File,
} from 'lucide-react'
import { formatDate, projectStatusColor, LABELS } from '@/lib/utils'
import ProgramBudgetReferences from './_components/ProgramBudgetReferences'
import ProgramDeleteButton from './_components/ProgramDeleteButton'

export default async function ProgramDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: programRow } = await admin
    .from('programs')
    .select('*')
    .eq('id', id)
    .single()

  if (!programRow) notFound()

  // Si la colonne `deleted_at` existe et est non null, considérer comme supprimé
  if ('deleted_at' in programRow && programRow.deleted_at) notFound()

  // Normaliser les colonnes optionnelles
  const program = {
    ...programRow,
    is_active:       'is_active'       in programRow ? programRow.is_active       ?? true  : true,
    is_confidential: 'is_confidential' in programRow ? programRow.is_confidential ?? false : false,
    objectives:      'objectives'      in programRow ? programRow.objectives       ?? null  : null,
    start_date:      'start_date'      in programRow ? programRow.start_date       ?? null  : null,
    end_date:        'end_date'        in programRow ? programRow.end_date         ?? null  : null,
  }

  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const { data: projects } = await admin
    .from('projects')
    .select('id, code, title, type, status, completion_pct, start_date, end_date')
    .eq('program_id', id)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  // Membres du programme (table optionnelle — défensive)
  let members: Array<{ profile_id: string; role: string; profiles: { full_name: string; email: string } | null }> = []
  try {
    const { data: membersData } = await admin
      .from('program_members')
      .select('profile_id, role, profiles(full_name, email)')
      .eq('program_id', id)
      .order('joined_at', { ascending: true })
    if (membersData) members = membersData as typeof members
  } catch { /* table n'existe pas encore */ }

  // Documents liés (table optionnelle — défensive)
  let linkedDocs: Array<{ document_id: string; documents: { title: string; file_name: string } | null }> = []
  try {
    const { data: docsData } = await admin
      .from('program_documents')
      .select('document_id, documents(title, file_name)')
      .eq('program_id', id)
      .order('created_at', { ascending: true })
    if (docsData) linkedDocs = docsData as typeof linkedDocs
  } catch { /* table n'existe pas encore */ }

  const projs = projects ?? []
  const activeCount    = projs.filter(p => p.status === 'active').length
  const completedCount = projs.filter(p => p.status === 'completed').length
  const avgCompletion  = projs.length > 0
    ? Math.round(projs.reduce((acc, p) => acc + (p.completion_pct ?? 0), 0) / projs.length)
    : 0

  const ROLE_LABELS: Record<string, string> = {
    responsable: 'Responsable',
    chef_projet: 'Chef de projet',
    membre: 'Membre',
    observateur: 'Observateur',
  }

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Back */}
      <Link
        href="/programs"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Retour aux programmes
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${program.is_active ? 'bg-indigo-50' : 'bg-gray-50'}`}>
              <Layers className={`w-6 h-6 ${program.is_active ? 'text-indigo-600' : 'text-gray-400'}`} />
            </div>
            <div>
              <p className="font-mono text-xs text-gray-400 uppercase tracking-wider mb-1">{program.code}</p>
              <h1 className="text-2xl font-bold text-gray-900">{program.name}</h1>
              {program.description && (
                <p className="text-sm text-gray-500 mt-1">{program.description}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
            <span className={`text-sm font-medium px-3 py-1.5 rounded-full ${program.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {program.is_active ? 'Actif' : 'Inactif'}
            </span>
            {program.is_confidential && (
              <span className="flex items-center gap-1 text-xs font-medium px-2.5 py-1.5 rounded-full bg-amber-50 text-amber-700">
                <Lock className="w-3 h-3" /> Confidentiel
              </span>
            )}
            {profile && ['admin', 'directeur'].includes(profile.role) && (
              <>
                <Link
                  href={`/programs/${id}/edit`}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  <Edit className="w-3.5 h-3.5" /> Modifier
                </Link>
                <ProgramDeleteButton programId={id} programName={program.name} />
              </>
            )}
          </div>
        </div>

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-6 mt-6 pt-5 border-t border-gray-50 text-sm text-gray-500">
          {(program.start_date || program.end_date) && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4" />
              {formatDate(program.start_date)} → {formatDate(program.end_date)}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <FolderKanban className="w-4 h-4" />
            {projs.length} projet{projs.length !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1.5 text-green-600">
            <CheckCircle2 className="w-4 h-4" />
            {completedCount} terminé{completedCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4" />
            Progression moyenne : <strong>{avgCompletion}%</strong>
          </span>
        </div>

        {/* Global progress bar */}
        {projs.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-1.5 text-xs text-gray-500">
              <span>Avancement global</span>
              <span className="font-semibold text-gray-700">{avgCompletion}%</span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all"
                style={{ width: `${avgCompletion}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total projets',  value: projs.length,         color: 'text-gray-900',   icon: FolderKanban },
          { label: 'Actifs',         value: activeCount,          color: 'text-blue-600',   icon: TrendingUp },
          { label: 'Terminés',       value: completedCount,       color: 'text-green-600',  icon: CheckCircle2 },
          { label: 'Progression',    value: `${avgCompletion}%`,  color: 'text-indigo-600', icon: TrendingUp },
        ].map(stat => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
              <p className={`text-2xl font-bold ${stat.color} mb-0.5`}>{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          )
        })}
      </div>

      {/* Objectifs + Équipe + Documents — grille latérale */}
      {(program.objectives || members.length > 0 || linkedDocs.length > 0) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Objectifs principaux */}
          {program.objectives && (
            <div className="lg:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-4">
                <Target className="w-4 h-4 text-indigo-500" />
                <h2 className="text-sm font-semibold text-gray-800">Objectifs principaux</h2>
              </div>
              <ul className="space-y-2">
                {program.objectives
                  .split('\n')
                  .map((line: string) => line.trim())
                  .filter((line: string) => line)
                  .map((line: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
                      <span className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-400 shrink-0" />
                      <span>{line.replace(/^[-•]\s*/, '')}</span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          {/* Équipe + Documents empilés */}
          <div className={`space-y-4 ${program.objectives ? '' : 'lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-4'}`}>

            {/* Équipe */}
            {members.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Users className="w-4 h-4 text-indigo-500" />
                  <h2 className="text-sm font-semibold text-gray-800">Équipe</h2>
                  <span className="ml-auto text-xs text-gray-400">{members.length} membre{members.length > 1 ? 's' : ''}</span>
                </div>
                <div className="space-y-2">
                  {members.map(m => (
                    <div key={m.profile_id} className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                        {(m.profiles?.full_name ?? '?').charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{m.profiles?.full_name ?? '—'}</p>
                        <p className="text-xs text-gray-400 truncate">{m.profiles?.email ?? ''}</p>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">{ROLE_LABELS[m.role] ?? m.role}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Documents liés */}
            {linkedDocs.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-center gap-2 mb-4">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  <h2 className="text-sm font-semibold text-gray-800">Documents de référence</h2>
                </div>
                <div className="space-y-2">
                  {linkedDocs.map(d => (
                    <div key={d.document_id} className="flex items-center gap-2.5 px-3 py-2 bg-gray-50 rounded-lg border border-gray-100">
                      <File className="w-4 h-4 text-gray-400 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-700 truncate">{d.documents?.title ?? '—'}</p>
                        <p className="text-xs text-gray-400 truncate">{d.documents?.file_name ?? ''}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Projects list */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
          <h2 className="text-base font-semibold text-gray-800">Projets liés</h2>
          <Link
            href={`/projects?program=${id}`}
            className="text-xs text-blue-600 hover:underline"
          >
            Voir dans Projets
          </Link>
        </div>

        {projs.length === 0 ? (
          <div className="py-12 text-center">
            <FolderKanban className="w-8 h-8 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucun projet dans ce programme</p>
            <Link
              href="/projects/new"
              className="mt-3 inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              Créer un projet
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {projs.map(project => (
              <Link
                key={project.id}
                href={`/projects/${project.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors group"
              >
                <span className="font-mono text-xs text-gray-400 w-16 shrink-0">{project.code}</span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-700 transition-colors">
                    {project.title}
                  </p>
                  <p className="text-xs text-gray-400">
                    {LABELS.project_type[project.type as keyof typeof LABELS.project_type] ?? project.type}
                    {project.start_date && ` · ${formatDate(project.start_date)}`}
                  </p>
                </div>

                <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${projectStatusColor(project.status)}`}>
                  {LABELS.project_status[project.status as keyof typeof LABELS.project_status] ?? project.status}
                </span>

                <div className="flex items-center gap-2 shrink-0 w-28">
                  <div className="flex-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full"
                      style={{ width: `${project.completion_pct ?? 0}%` }}
                    />
                  </div>
                  <span className="text-xs text-gray-400 w-8 text-right">{project.completion_pct ?? 0}%</span>
                </div>

                <ExternalLink className="w-3.5 h-3.5 text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Budget references */}
      <ProgramBudgetReferences programId={id} programName={program.name} userRole={profile?.role ?? 'membre'} />
    </div>
  )
}

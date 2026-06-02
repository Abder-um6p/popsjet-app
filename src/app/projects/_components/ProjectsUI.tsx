'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import Link from 'next/link'
import {
  Plus, Search, X, ChevronDown, Filter, RefreshCw,
  Trash2, FolderKanban, MoreHorizontal, Eye, Pencil,
  Users, CheckCircle2, Archive, FileText, Trash,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatDate, projectStatusColor, LABELS } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Program = { id: string; name: string; code: string; color: string | null }

type Project = {
  id: string
  code: string
  title: string
  type: string
  status: string
  completion_pct: number
  start_date: string | null
  end_date: string | null
  budget: number | null
  created_by: string
  program_id: string
  programs: { id: string; name: string; code: string; color: string | null } | null
  responsible: { id: string; full_name: string; avatar_url: string | null } | null
}

// ─── Delete Modal ─────────────────────────────────────────────────────────────

function DeleteModal({
  project,
  onClose,
  onConfirm,
}: {
  project: Project
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Mettre à la corbeille</h3>
            <p className="text-xs text-gray-400 mt-0.5">Cette action est réversible</p>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-sm text-gray-700 font-medium">{project.title}</p>
          <p className="text-xs text-gray-400 mt-0.5 font-mono">{project.code}</p>
        </div>

        <p className="text-sm text-gray-500 leading-relaxed">
          Ce projet sera déplacé dans la corbeille. Vous pourrez le restaurer depuis{' '}
          <Link href="/projects/trash" className="text-blue-600 hover:underline" onClick={onClose}>
            Projets → Corbeille
          </Link>
          .
        </p>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
            Annuler
          </button>
          <button
            onClick={async () => { setLoading(true); await onConfirm(); setLoading(false) }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {loading ? 'Suppression…' : 'Mettre à la corbeille'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Filter Badge ─────────────────────────────────────────────────────────────

function FilterBadge({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full border border-blue-200">
      {label}
      <button onClick={onRemove} className="hover:text-blue-900 transition">
        <X className="w-3 h-3" />
      </button>
    </span>
  )
}

// ─── Actions Menu ─────────────────────────────────────────────────────────────

function ActionsMenu({
  project,
  canDelete,
  canEdit,
  onDelete,
}: {
  project: Project
  canDelete: boolean
  canEdit: boolean
  onDelete: () => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 w-48 text-sm">
            <Link
              href={`/projects/${project.id}`}
              onClick={() => setOpen(false)}
              className="flex items-center gap-2.5 px-4 py-2 text-gray-700 hover:bg-gray-50 transition"
            >
              <Eye className="w-3.5 h-3.5 text-gray-400" /> Voir le projet
            </Link>
            {canEdit && (
              <Link
                href={`/projects/${project.id}/edit`}
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-gray-700 hover:bg-gray-50 transition"
              >
                <Pencil className="w-3.5 h-3.5 text-gray-400" /> Modifier
              </Link>
            )}
            {canDelete && (
              <>
                <div className="my-1 mx-2 border-t border-gray-100" />
                <button
                  onClick={() => { setOpen(false); onDelete() }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-red-600 hover:bg-red-50 transition"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Mettre à la corbeille
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Status icon mapping ──────────────────────────────────────────────────────

const STATUS_ICONS: Record<string, React.ElementType> = {
  draft:     FileText,
  active:    CheckCircle2,
  completed: CheckCircle2,
  archived:  Archive,
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProjectsUI({
  currentUserId,
  userRole,
  programs,
  trashCount,
  canCreate,
}: {
  currentUserId: string
  userRole: string
  programs: Program[]
  trashCount: number
  canCreate: boolean
}) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [healthScores, setHealthScores] = useState<Record<string, { score: number; label: string; color: string }>>({})
  const [healthLoading, setHealthLoading] = useState(false)

  // Filters
  const [search, setSearch]         = useState('')
  const [status, setStatus]         = useState('')
  const [type, setType]             = useState('')
  const [programId, setProgramId]   = useState('')
  const [mine, setMine]             = useState(false)

  // Modal
  const [deleteTarget, setDeleteTarget] = useState<Project | null>(null)

  const isPrivileged = ['admin', 'directeur'].includes(userRole)

  const buildUrl = useCallback(() => {
    const p = new URLSearchParams()
    if (search)    p.set('search', search)
    if (status)    p.set('status', status)
    if (type)      p.set('type', type)
    if (programId) p.set('program_id', programId)
    if (mine)      p.set('mine', 'true')
    return `/api/projects?${p.toString()}`
  }, [search, status, type, programId, mine])

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    setLoadError(null)
    try {
      const res = await fetch(buildUrl())
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        const list: Project[] = Array.isArray(body) ? body : []
        setProjects(list)
        // Fetch health scores in background
        if (list.length > 0) {
          setHealthLoading(true)
          fetch('/api/ai/project-health', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projects: list.map(p => ({ id: p.id, completion_pct: p.completion_pct, status: p.status, end_date: p.end_date, start_date: p.start_date })) }),
          })
            .then(r => r.ok ? r.json() : null)
            .then(data => { if (data?.scores) setHealthScores(data.scores) })
            .catch(() => {})
            .finally(() => setHealthLoading(false))
        }
      } else {
        // Affiche l'erreur exacte renvoyée par l'API
        const msg = body?.error ?? `HTTP ${res.status}`
        console.error('[ProjectsUI] API error:', res.status, body)
        setLoadError(msg)
        toast.error(`Erreur (${res.status}) : ${msg}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau'
      console.error('[ProjectsUI] fetch error:', err)
      setLoadError(msg)
      toast.error(`Erreur réseau : ${msg}`)
    }
    setLoading(false)
    setRefreshing(false)
  }, [buildUrl])

  useEffect(() => { load() }, [load])

  async function handleDelete(project: Project) {
    const res = await fetch(`/api/projects/${project.id}/delete`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Erreur'); return }
    toast.success(`"${json.title}" déplacé à la corbeille`)
    setDeleteTarget(null)
    load(true)
  }

  function canDeleteProject(p: Project) {
    return isPrivileged || p.created_by === currentUserId
  }

  function canEditProject(p: Project) {
    return isPrivileged || p.created_by === currentUserId ||
      (p.responsible as any)?.id === currentUserId
  }

  const hasFilters = !!(search || status || type || programId || mine)

  const stats = useMemo(() => ({
    total:    projects.length,
    active:   projects.filter(p => p.status === 'active').length,
    completed: projects.filter(p => p.status === 'completed').length,
    draft:    projects.filter(p => p.status === 'draft').length,
  }), [projects])

  const STAT_CARDS = [
    { label: 'Total',      value: stats.total,     color: 'text-gray-800',   bg: 'bg-gray-50',   icon: FolderKanban },
    { label: 'Actifs',     value: stats.active,    color: 'text-blue-700',   bg: 'bg-blue-50',   icon: CheckCircle2 },
    { label: 'Terminés',   value: stats.completed, color: 'text-green-700',  bg: 'bg-green-50',  icon: CheckCircle2 },
    { label: 'Brouillons', value: stats.draft,     color: 'text-gray-600',   bg: 'bg-gray-100',  icon: FileText },
  ]

  return (
    <>
      {deleteTarget && (
        <DeleteModal
          project={deleteTarget}
          onClose={() => setDeleteTarget(null)}
          onConfirm={() => handleDelete(deleteTarget)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Projets</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {loading ? 'Chargement…' : `${projects.length} projet${projects.length > 1 ? 's' : ''}${hasFilters ? ' (filtrés)' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {(isPrivileged) && (
            <Link
              href="/projects/trash"
              className="inline-flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              <Trash className="w-4 h-4" />
              Corbeille
              {trashCount > 0 && (
                <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold">
                  {trashCount}
                </span>
              )}
            </Link>
          )}
          {canCreate && (
            <Link
              href="/projects/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              <Plus className="w-4 h-4" /> Nouveau projet
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-3">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', s.bg)}>
                  <Icon className={cn('w-4 h-4', s.color)} />
                </div>
                <div>
                  <div className={cn('text-2xl font-bold', s.color)}>{loading ? '—' : s.value}</div>
                  <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filter bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="flex-1 min-w-56 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par titre ou code…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Mes projets toggle */}
          <button
            onClick={() => setMine(v => !v)}
            className={cn(
              'inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition',
              mine
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            )}
          >
            <Users className="w-3.5 h-3.5" />
            Mes projets
          </button>

          {/* Status */}
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 min-w-36"
          >
            <option value="">Tous les statuts</option>
            <option value="draft">Brouillon</option>
            <option value="active">Actif</option>
            <option value="completed">Terminé</option>
            <option value="archived">Archivé</option>
          </select>

          {/* Type */}
          <select
            value={type}
            onChange={e => setType(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 min-w-36"
          >
            <option value="">Tous les types</option>
            <option value="workshop">Workshop</option>
            <option value="hackathon">Hackathon</option>
            <option value="structured">Projet structuré</option>
            <option value="flexible">Projet flexible</option>
          </select>

          {/* Program */}
          {programs.length > 0 && (
            <select
              value={programId}
              onChange={e => setProgramId(e.target.value)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 min-w-44"
            >
              <option value="">Tous les programmes</option>
              {programs.map(p => (
                <option key={p.id} value={p.id}>{p.code ? `[${p.code}] ` : ''}{p.name}</option>
              ))}
            </select>
          )}

          <div className="ml-auto flex items-center gap-2">
            {hasFilters && (
              <button
                onClick={() => { setSearch(''); setStatus(''); setType(''); setProgramId(''); setMine(false) }}
                className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                Réinitialiser
              </button>
            )}
            <button
              onClick={() => load(true)}
              className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              title="Rafraîchir"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Active filter badges */}
        {hasFilters && (
          <div className="flex flex-wrap gap-2 pt-1">
            {mine && <FilterBadge label="Mes projets" onRemove={() => setMine(false)} />}
            {status && <FilterBadge label={LABELS.project_status[status as keyof typeof LABELS.project_status] ?? status} onRemove={() => setStatus('')} />}
            {type && <FilterBadge label={LABELS.project_type[type as keyof typeof LABELS.project_type] ?? type} onRemove={() => setType('')} />}
            {programId && <FilterBadge label={programs.find(p => p.id === programId)?.name ?? 'Programme'} onRemove={() => setProgramId('')} />}
            {search && <FilterBadge label={`"${search}"`} onRemove={() => setSearch('')} />}
          </div>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center h-48 bg-white rounded-xl border border-gray-100 shadow-sm">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-xl border border-red-100 shadow-sm py-10 px-6 space-y-3">
          <p className="text-sm font-semibold text-red-600">Erreur lors du chargement des projets</p>
          <p className="text-xs text-red-400 font-mono break-all">{loadError}</p>
          <div className="flex items-center gap-3 pt-1">
            <button
              onClick={() => load()}
              className="text-sm text-blue-600 hover:underline"
            >
              Réessayer
            </button>
            <a
              href="/api/debug-projects"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-gray-400 hover:text-gray-600 hover:underline"
            >
              Ouvrir le diagnostic →
            </a>
          </div>
        </div>
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center space-y-3">
          <FolderKanban className="w-10 h-10 text-gray-200 mx-auto" />
          <p className="text-sm text-gray-400">
            {hasFilters ? 'Aucun projet ne correspond aux filtres sélectionnés' : 'Aucun projet pour l\'instant'}
          </p>
          {hasFilters ? (
            <button
              onClick={() => { setSearch(''); setStatus(''); setType(''); setProgramId(''); setMine(false) }}
              className="text-sm text-blue-600 hover:underline"
            >
              Effacer les filtres
            </button>
          ) : canCreate && (
            <Link href="/projects/new" className="text-sm text-blue-600 hover:underline">
              Créer le premier projet →
            </Link>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {projects.length} projet{projects.length > 1 ? 's' : ''}
              {hasFilters && <span className="text-gray-400 font-normal"> (filtrés)</span>}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/40">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider w-36">Code</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Projet</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Programme</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Statut</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Responsable</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:table-cell">Échéance</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Avancement</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden xl:table-cell">Santé IA</th>
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {projects.map(project => (
                  <tr
                    key={project.id}
                    className="hover:bg-gray-50/60 transition-colors group"
                  >
                    <td className="px-4 py-3.5">
                      <span className="font-mono text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded whitespace-nowrap">
                        {project.code}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <Link
                        href={`/projects/${project.id}`}
                        className="font-semibold text-gray-800 hover:text-blue-600 transition-colors"
                      >
                        {project.title}
                      </Link>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      {project.programs ? (
                        <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
                          {project.programs.color && (
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: project.programs.color }} />
                          )}
                          {project.programs.name}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden md:table-cell">
                      <span className="text-xs text-gray-500">
                        {LABELS.project_type[project.type as keyof typeof LABELS.project_type] ?? project.type}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', projectStatusColor(project.status))}>
                        {LABELS.project_status[project.status as keyof typeof LABELS.project_status]}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell">
                      {project.responsible ? (
                        <span className="text-xs text-gray-600">{project.responsible.full_name}</span>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 hidden lg:table-cell text-xs text-gray-400">
                      {formatDate(project.end_date)}
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={cn(
                              'h-1.5 rounded-full',
                              project.completion_pct >= 100 ? 'bg-green-500' :
                              project.completion_pct >= 50  ? 'bg-blue-500' : 'bg-blue-300'
                            )}
                            style={{ width: `${project.completion_pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-400 tabular-nums w-7">{project.completion_pct}%</span>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 hidden xl:table-cell">
                      {healthLoading ? (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-200 border-t-transparent animate-spin" />
                      ) : healthScores[project.id] ? (
                        <div className="flex items-center gap-1.5" title={healthScores[project.id].label}>
                          <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                            style={{ backgroundColor: healthScores[project.id].color }}>
                            {healthScores[project.id].score}
                          </div>
                          <span className="text-xs text-gray-500">{healthScores[project.id].label}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <ActionsMenu
                        project={project}
                        canDelete={canDeleteProject(project)}
                        canEdit={canEditProject(project)}
                        onDelete={() => setDeleteTarget(project)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </>
  )
}

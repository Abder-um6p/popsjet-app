'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Trash2, RotateCcw, RefreshCw, AlertTriangle,
  FolderKanban, Clock, User, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatDate, LABELS } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

type TrashedProject = {
  id: string
  code: string
  title: string
  type: string
  status: string
  deleted_at: string
  created_at: string
  programs: { id: string; name: string; code: string; color: string | null } | null
  deleted_by_profile: { full_name: string } | null
  creator: { full_name: string } | null
}

// ─── Permanent Delete Modal ───────────────────────────────────────────────────

function PermanentDeleteModal({
  project,
  onClose,
  onConfirm,
}: {
  project: TrashedProject
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Suppression définitive</h3>
            <p className="text-xs text-red-500 font-medium mt-0.5">Action irréversible</p>
          </div>
        </div>

        {/* Project info */}
        <div className="p-4 bg-red-50 rounded-xl border border-red-100">
          <p className="text-sm font-semibold text-gray-900">{project.title}</p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">{project.code}</p>
        </div>

        {/* Warning */}
        <div className="space-y-2 text-sm text-gray-600 leading-relaxed">
          <p>Cette action va <strong>supprimer définitivement</strong> ce projet et toutes ses données associées :</p>
          <ul className="text-xs text-gray-500 space-y-1 pl-4">
            <li>• Toutes les tâches</li>
            <li>• Tous les documents</li>
            <li>• Tous les membres</li>
            <li>• Toutes les dépenses</li>
            <li>• Tous les participants</li>
          </ul>
        </div>

        {/* Confirmation checkbox */}
        <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={e => setConfirmed(e.target.checked)}
            className="mt-0.5 w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
          />
          <span className="text-xs text-gray-600">
            Je comprends que cette action est <strong>irréversible</strong> et que toutes les données seront perdues.
          </span>
        </label>

        {/* Footer */}
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
            Annuler
          </button>
          <button
            onClick={async () => { setLoading(true); await onConfirm(); setLoading(false) }}
            disabled={loading || !confirmed}
            className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-40"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {loading ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TrashTable({ isPrivileged }: { isPrivileged: boolean }) {
  const [projects, setProjects] = useState<TrashedProject[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [permanentTarget, setPermanentTarget] = useState<TrashedProject | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/projects/trash')
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setProjects(Array.isArray(body) ? body : [])
      } else {
        const msg = body?.error ?? `HTTP ${res.status}`
        console.error('[TrashTable] API error:', res.status, body)
        setLoadError(msg)
        toast.error(`Erreur corbeille (${res.status}) : ${msg}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau'
      setLoadError(msg)
      toast.error(`Erreur réseau : ${msg}`)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleRestore(project: TrashedProject) {
    setActionLoading(project.id)
    const res = await fetch(`/api/projects/${project.id}/restore`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Erreur'); setActionLoading(null); return }
    toast.success(`"${json.title}" restauré avec succès`)
    setActionLoading(null)
    load()
  }

  async function handlePermanentDelete(project: TrashedProject) {
    const res = await fetch(`/api/projects/${project.id}/permanent`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Erreur'); return }
    toast.success(`"${json.title}" supprimé définitivement`)
    setPermanentTarget(null)
    load()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="bg-white rounded-xl border border-red-100 shadow-sm py-10 px-6 space-y-3">
        <p className="text-sm font-semibold text-red-600">Erreur lors du chargement de la corbeille</p>
        <p className="text-xs text-red-400 font-mono break-all">{loadError}</p>
        <div className="flex items-center gap-3 pt-1">
          <button onClick={load} className="text-sm text-blue-600 hover:underline">Réessayer</button>
          <a href="/api/debug-projects" target="_blank" rel="noopener noreferrer"
            className="text-sm text-gray-400 hover:text-gray-600 hover:underline">
            Diagnostic →
          </a>
        </div>
      </div>
    )
  }

  if (projects.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-20 text-center space-y-3">
        <Trash2 className="w-12 h-12 text-gray-200 mx-auto" />
        <div>
          <p className="text-sm font-medium text-gray-500">La corbeille est vide</p>
          <p className="text-xs text-gray-400 mt-1">Les projets supprimés apparaîtront ici</p>
        </div>
        <Link href="/projects" className="inline-block text-sm text-blue-600 hover:underline mt-2">
          ← Retour aux projets
        </Link>
      </div>
    )
  }

  return (
    <>
      {permanentTarget && (
        <PermanentDeleteModal
          project={permanentTarget}
          onClose={() => setPermanentTarget(null)}
          onConfirm={() => handlePermanentDelete(permanentTarget)}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {projects.length} projet{projects.length > 1 ? 's' : ''} dans la corbeille
          </span>
          <button
            onClick={load}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-gray-50">
          {projects.map(project => {
            const isActioning = actionLoading === project.id
            return (
              <div
                key={project.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                  <FolderKanban className="w-5 h-5 text-red-400" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{project.title}</span>
                    <span className="font-mono text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {project.code}
                    </span>
                    <span className="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                      {LABELS.project_type[project.type as keyof typeof LABELS.project_type] ?? project.type}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    {project.programs && (
                      <span className="flex items-center gap-1.5 text-xs text-gray-500">
                        {project.programs.color && (
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: project.programs.color }} />
                        )}
                        {project.programs.name}
                      </span>
                    )}
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      Supprimé {formatDistanceToNow(new Date(project.deleted_at), { addSuffix: true, locale: fr })}
                    </span>
                    {project.deleted_by_profile && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <User className="w-3 h-3" />
                        par {project.deleted_by_profile.full_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRestore(project)}
                    disabled={isActioning}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition disabled:opacity-50"
                    title="Restaurer le projet"
                  >
                    {isActioning
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <RotateCcw className="w-3.5 h-3.5" />
                    }
                    Restaurer
                  </button>
                  {isPrivileged && (
                    <button
                      onClick={() => setPermanentTarget(project)}
                      disabled={isActioning}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                      title="Supprimer définitivement"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Supprimer
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

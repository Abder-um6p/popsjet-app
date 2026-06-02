'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Trash2, RotateCcw, RefreshCw, AlertTriangle,
  Package, Clock, User,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

type TrashedProgram = {
  id:                 string
  code:               string
  name:               string
  description:        string | null
  is_active:          boolean
  deleted_at:         string
  deleted_by:         string | null
  deleted_by_profile: { full_name: string } | null
  creator:            { full_name: string } | null
}

// ─── Permanent Delete Modal ───────────────────────────────────────────────────

function PermanentDeleteModal({
  program,
  onClose,
  onConfirm,
}: {
  program:   TrashedProgram
  onClose:   () => void
  onConfirm: () => Promise<void>
}) {
  const [loading,   setLoading]   = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-red-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Suppression définitive</h3>
            <p className="text-xs text-red-500 font-medium mt-0.5">Action irréversible</p>
          </div>
        </div>

        <div className="p-4 bg-red-50 rounded-xl border border-red-100">
          <p className="text-sm font-semibold text-gray-900">{program.name}</p>
          <p className="text-xs text-gray-500 font-mono mt-0.5">{program.code}</p>
        </div>

        <div className="space-y-2 text-sm text-gray-600 leading-relaxed">
          <p>Cette action va <strong>supprimer définitivement</strong> ce programme et toutes ses données :</p>
          <ul className="text-xs text-gray-500 space-y-1 pl-4">
            <li>• Tous les projets liés</li>
            <li>• Toutes les références budgétaires</li>
            <li>• Toutes les tâches et documents associés</li>
          </ul>
        </div>

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

export default function ProgramsTrashTable() {
  const [programs,        setPrograms]        = useState<TrashedProgram[]>([])
  const [loading,         setLoading]         = useState(true)
  const [loadError,       setLoadError]       = useState<string | null>(null)
  const [actionLoading,   setActionLoading]   = useState<string | null>(null)
  const [permanentTarget, setPermanentTarget] = useState<TrashedProgram | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res  = await fetch('/api/programs/trash')
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setPrograms(Array.isArray(body) ? body : [])
      } else {
        const msg = body?.error ?? `HTTP ${res.status}`
        setLoadError(msg)
        toast.error(`Erreur corbeille : ${msg}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur réseau'
      setLoadError(msg)
      toast.error(`Erreur réseau : ${msg}`)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function handleRestore(program: TrashedProgram) {
    setActionLoading(program.id)
    const res  = await fetch(`/api/programs/${program.id}/restore`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? 'Erreur lors de la restauration')
    } else {
      toast.success(`« ${json.name} » restauré avec succès`)
      load()
    }
    setActionLoading(null)
  }

  async function handlePermanentDelete(program: TrashedProgram) {
    const res  = await fetch(`/api/programs/${program.id}/destroy`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? 'Erreur lors de la suppression')
    } else {
      toast.success(`« ${json.name} » supprimé définitivement`)
      setPermanentTarget(null)
      load()
    }
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
        <button onClick={load} className="text-sm text-blue-600 hover:underline">Réessayer</button>
      </div>
    )
  }

  if (programs.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-20 text-center space-y-3">
        <Trash2 className="w-12 h-12 text-gray-200 mx-auto" />
        <div>
          <p className="text-sm font-medium text-gray-500">La corbeille est vide</p>
          <p className="text-xs text-gray-400 mt-1">Les programmes supprimés apparaîtront ici</p>
        </div>
        <Link href="/programs" className="inline-block text-sm text-blue-600 hover:underline mt-2">
          ← Retour aux programmes
        </Link>
      </div>
    )
  }

  return (
    <>
      {permanentTarget && (
        <PermanentDeleteModal
          program={permanentTarget}
          onClose={() => setPermanentTarget(null)}
          onConfirm={() => handlePermanentDelete(permanentTarget)}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {programs.length} programme{programs.length > 1 ? 's' : ''} dans la corbeille
          </span>
          <button
            onClick={load}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-gray-50">
          {programs.map(program => {
            const isActioning = actionLoading === program.id
            return (
              <div
                key={program.id}
                className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition"
              >
                {/* Icon */}
                <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-red-400" />
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">{program.name}</span>
                    <span className="font-mono text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                      {program.code}
                    </span>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                      program.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {program.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                  {program.description && (
                    <p className="text-xs text-gray-400 mt-0.5 truncate max-w-md">{program.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-1 flex-wrap">
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      Supprimé {formatDistanceToNow(new Date(program.deleted_at), { addSuffix: true, locale: fr })}
                    </span>
                    {program.deleted_by_profile && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <User className="w-3 h-3" />
                        par {program.deleted_by_profile.full_name}
                      </span>
                    )}
                    {program.creator && (
                      <span className="text-xs text-gray-400">
                        Créé par {program.creator.full_name}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleRestore(program)}
                    disabled={isActioning}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition disabled:opacity-50"
                  >
                    {isActioning
                      ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      : <RotateCcw className="w-3.5 h-3.5" />
                    }
                    Restaurer
                  </button>
                  <button
                    onClick={() => setPermanentTarget(program)}
                    disabled={isActioning}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Supprimer
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}

'use client'

import { useEffect, useState, useCallback } from 'react'
import {
  Trash2, RotateCcw, AlertTriangle, Search,
  FolderOpen, ListTodo, Receipt, FileText, Zap, BookOpen,
  Clock, User, RefreshCw, Package, Filter,
} from 'lucide-react'
import { toast } from 'sonner'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'

// ─── Types ───────────────────────────────────────────────────────────────────

type Category =
  | 'all'
  | 'programs'
  | 'projects'
  | 'tasks'
  | 'expenses'
  | 'documents'
  | 'pops'
  | 'budget_references'

interface TrashItem {
  id:                 string
  category:           Exclude<Category, 'all'>
  name:               string
  deleted_at:         string
  deleted_by:         string | null
  deleted_by_profile: { id: string; full_name: string } | null
  owner_id:           string | null
  owner:              { id: string; full_name: string } | null
  meta:               Record<string, unknown>
}

interface TrashResponse {
  items:  TrashItem[]
  counts: Record<string, number>
  total:  number
}

// ─── Category config ─────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<Exclude<Category, 'all'>, {
  label:     string
  icon:      React.ElementType
  restoreOk: boolean
}> = {
  programs:          { label: 'Programmes',  icon: Package,    restoreOk: false },
  projects:          { label: 'Projets',     icon: FolderOpen, restoreOk: false },
  tasks:             { label: 'Tâches',      icon: ListTodo,   restoreOk: true  },
  expenses:          { label: 'Dépenses',    icon: Receipt,    restoreOk: true  },
  documents:         { label: 'Documents',   icon: FileText,   restoreOk: true  },
  pops:              { label: 'Pops',        icon: Zap,        restoreOk: true  },
  budget_references: { label: 'Réf. budget', icon: BookOpen,   restoreOk: false },
}

const RESTORE_URLS: Record<Exclude<Category, 'all'>, (id: string) => string> = {
  programs:          id => `/api/programs/${id}/restore`,
  projects:          id => `/api/projects/${id}/restore`,
  tasks:             id => `/api/tasks/${id}/restore`,
  expenses:          id => `/api/expenses/${id}/restore`,
  documents:         id => `/api/documents/${id}/restore`,
  pops:              id => `/api/pops/${id}/restore`,
  budget_references: id => `/api/budget-references/${id}/restore`,
}

const DESTROY_URLS: Record<Exclude<Category, 'all'>, (id: string) => string> = {
  programs:          id => `/api/programs/${id}/destroy`,
  projects:          id => `/api/projects/${id}/permanent`,
  tasks:             id => `/api/tasks/${id}/destroy`,
  expenses:          id => `/api/expenses/${id}/destroy`,
  documents:         id => `/api/documents/${id}/destroy`,
  pops:              id => `/api/pops/${id}/destroy`,
  budget_references: id => `/api/budget-references/${id}/destroy`,
}

// ─── Permanent Delete Modal ───────────────────────────────────────────────────

function PermanentDeleteModal({
  item,
  onClose,
  onConfirm,
}: {
  item:      TrashItem
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
          <p className="text-sm font-semibold text-gray-900 truncate">{item.name}</p>
          <p className="text-xs text-gray-500 mt-0.5 capitalize">{CATEGORY_CONFIG[item.category].label}</p>
        </div>

        <p className="text-sm text-gray-600 leading-relaxed">
          Cette action va <strong>supprimer définitivement</strong> cet élément et toutes ses données associées. Cette opération est <strong>irréversible</strong>.
        </p>

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
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Annuler
          </button>
          <button
            onClick={async () => { setLoading(true); await onConfirm(); setLoading(false) }}
            disabled={loading || !confirmed}
            className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-40"
          >
            {loading
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />
            }
            {loading ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  userRole: string
  userId:   string
}

export default function TrashCenter({ userRole, userId }: Props) {
  const isPrivileged = ['admin', 'directeur'].includes(userRole)

  const [data,           setData]           = useState<TrashResponse | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [loadError,      setLoadError]      = useState<string | null>(null)
  const [category,       setCategory]       = useState<Category>('all')
  const [search,         setSearch]         = useState('')
  const [actionLoading,  setActionLoading]  = useState<string | null>(null)
  const [restoreTarget,  setRestoreTarget]  = useState<TrashItem | null>(null)
  const [destroyTarget,  setDestroyTarget]  = useState<TrashItem | null>(null)

  const load = useCallback(async (cat: Category = category) => {
    setLoading(true)
    setLoadError(null)
    try {
      const url = cat === 'all' ? '/api/trash' : `/api/trash?category=${cat}`
      const res = await fetch(url)
      const body = await res.json().catch(() => ({}))
      if (res.ok) {
        setData(body)
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
  }, [category])

  useEffect(() => { load(category) }, [category])

  // ── Filtered items ─────────────────────────────────────────────────────────
  const filteredItems = (data?.items ?? []).filter(item => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      item.name.toLowerCase().includes(q) ||
      (item.owner?.full_name?.toLowerCase().includes(q) ?? false) ||
      (item.deleted_by_profile?.full_name?.toLowerCase().includes(q) ?? false)
    )
  })

  // ── Actions ────────────────────────────────────────────────────────────────
  async function handleRestore() {
    if (!restoreTarget) return
    setActionLoading(restoreTarget.id)
    const res = await fetch(RESTORE_URLS[restoreTarget.category](restoreTarget.id), { method: 'POST' })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? 'Erreur lors de la restauration')
    } else {
      toast.success(`« ${restoreTarget.name} » restauré avec succès`)
      setRestoreTarget(null)
      load(category)
    }
    setActionLoading(null)
  }

  async function handleDestroy() {
    if (!destroyTarget) return
    const res = await fetch(DESTROY_URLS[destroyTarget.category](destroyTarget.id), { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? 'Erreur lors de la suppression')
    } else {
      toast.success(`« ${destroyTarget.name} » supprimé définitivement`)
      setDestroyTarget(null)
      load(category)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {destroyTarget && (
        <PermanentDeleteModal
          item={destroyTarget}
          onClose={() => setDestroyTarget(null)}
          onConfirm={handleDestroy}
        />
      )}

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700 mb-6">
        <Trash2 className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
        <p>
          Les éléments dans la corbeille conservent toutes leurs données.{' '}
          <strong>La suppression définitive est irréversible.</strong>{' '}
          Seuls les administrateurs et directeurs peuvent supprimer définitivement.
        </p>
      </div>

      {/* Category tabs */}
      <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 flex-wrap">
        {(['all', ...Object.keys(CATEGORY_CONFIG)] as Category[]).map(cat => {
          const cfg   = cat === 'all' ? null : CATEGORY_CONFIG[cat as Exclude<Category, 'all'>]
          const Icon  = cfg?.icon ?? Filter
          const count = cat === 'all' ? (data?.total ?? 0) : (data?.counts[cat] ?? 0)
          const active = category === cat
          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition ${
                active
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {cat === 'all' ? 'Tout' : cfg!.label}
              {count > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  active
                    ? 'bg-white/20 text-white'
                    : 'bg-red-100 text-red-600'
                }`}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher par nom, auteur…"
          className="w-full pl-10 pr-4 py-2.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : loadError ? (
        <div className="bg-white rounded-xl border border-red-100 shadow-sm py-10 px-6 space-y-3">
          <p className="text-sm font-semibold text-red-600">Erreur lors du chargement</p>
          <p className="text-xs text-red-400 font-mono break-all">{loadError}</p>
          <button onClick={() => load(category)} className="text-sm text-blue-600 hover:underline">Réessayer</button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-20 text-center space-y-3">
          <Trash2 className="w-12 h-12 text-gray-200 mx-auto" />
          <div>
            <p className="text-sm font-medium text-gray-500">
              {search ? 'Aucun résultat pour cette recherche' : 'La corbeille est vide'}
            </p>
            <p className="text-xs text-gray-400 mt-1">
              {search ? 'Essayez un autre terme' : 'Les éléments supprimés apparaîtront ici'}
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">
              {filteredItems.length} élément{filteredItems.length > 1 ? 's' : ''}
              {search && ` · résultat${filteredItems.length > 1 ? 's' : ''} pour « ${search} »`}
            </span>
            <button
              onClick={() => load(category)}
              className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          <div className="divide-y divide-gray-50">
            {filteredItems.map(item => {
              const cfg     = CATEGORY_CONFIG[item.category]
              const Icon    = cfg.icon
              const isActioning = actionLoading === item.id
              const canRestore  = isPrivileged || (cfg.restoreOk && item.owner_id === userId)
              const canDestroy  = isPrivileged

              // Restore modal = inline confirm (pas de modal pour restore, juste confirmation simple)
              return (
                <div
                  key={`${item.category}-${item.id}`}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition"
                >
                  {/* Icon */}
                  <div className="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
                    <Icon className="w-5 h-5 text-red-400" />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-800 truncate max-w-xs">
                        {item.name}
                      </span>
                      <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        {cfg.label}
                      </span>
                      {item.meta.code && (
                        <span className="font-mono text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                          {String(item.meta.code)}
                        </span>
                      )}
                      {item.meta.status && (
                        <span className="text-[10px] text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full border border-gray-100">
                          {String(item.meta.status)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-4 mt-1 flex-wrap">
                      {item.owner && (
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <User className="w-3 h-3" />
                          {item.owner.full_name}
                        </span>
                      )}
                      {item.deleted_at && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          <Clock className="w-3 h-3" />
                          Supprimé {formatDistanceToNow(new Date(item.deleted_at), { addSuffix: true, locale: fr })}
                        </span>
                      )}
                      {item.deleted_by_profile && (
                        <span className="flex items-center gap-1 text-xs text-gray-400">
                          par {item.deleted_by_profile.full_name}
                        </span>
                      )}
                      {item.meta.amount !== undefined && (
                        <span className="text-xs text-gray-400">
                          {Number(item.meta.amount).toLocaleString('fr-FR')} MAD
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {canRestore && (
                      <button
                        onClick={() => setRestoreTarget(item)}
                        disabled={isActioning}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition disabled:opacity-50"
                      >
                        {isActioning
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : <RotateCcw className="w-3.5 h-3.5" />
                        }
                        Restaurer
                      </button>
                    )}
                    {canDestroy && (
                      <button
                        onClick={() => setDestroyTarget(item)}
                        disabled={isActioning}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
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
      )}

      {/* Inline restore confirm */}
      {restoreTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setRestoreTarget(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                <RotateCcw className="w-5 h-5 text-blue-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Restaurer l'élément ?</h3>
                <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{restoreTarget.name}</p>
              </div>
            </div>
            <p className="text-sm text-gray-600">
              L'élément sera retiré de la corbeille et redeviendra visible dans l'application.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setRestoreTarget(null)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Annuler
              </button>
              <button
                onClick={handleRestore}
                disabled={!!actionLoading}
                className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-40"
              >
                {actionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                Restaurer
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

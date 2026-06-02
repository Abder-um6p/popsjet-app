'use client'

import { useState, useEffect, useCallback } from 'react'
import { Search, Filter, ChevronLeft, ChevronRight, RefreshCw, Shield } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'

interface AuditEntry {
  id: string
  user_id: string | null
  user_email: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  entity_name: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  created_at: string
  user?: { full_name: string; email: string } | null
}

const ACTION_COLORS: Record<string, string> = {
  create:  'bg-green-50 text-green-700',
  update:  'bg-blue-50 text-blue-700',
  delete:  'bg-red-50 text-red-700',
  approve: 'bg-teal-50 text-teal-700',
  reject:  'bg-orange-50 text-orange-700',
  login:   'bg-purple-50 text-purple-700',
}

function actionColor(action: string) {
  const prefix = action.split('_')[0]
  return ACTION_COLORS[prefix] ?? 'bg-gray-100 text-gray-600'
}

export default function AuditTable() {
  const [logs, setLogs]         = useState<AuditEntry[]>([])
  const [total, setTotal]       = useState(0)
  const [page, setPage]         = useState(1)
  const [loading, setLoading]   = useState(false)

  // Filters
  const [search, setSearch]     = useState('')
  const [entity, setEntity]     = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo]     = useState('')

  const limit = 50

  const load = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams()
    if (search)   params.set('action',      search)
    if (entity)   params.set('entity_type', entity)
    if (dateFrom) params.set('date_from',   dateFrom)
    if (dateTo)   params.set('date_to',     dateTo)
    params.set('page', String(page))

    const res = await fetch(`/api/audit-logs?${params}`)
    if (res.ok) {
      const json = await res.json()
      setLogs(json.data ?? [])
      setTotal(json.count ?? 0)
    }
    setLoading(false)
  }, [search, entity, dateFrom, dateTo, page])

  useEffect(() => { load() }, [load])

  const totalPages = Math.max(1, Math.ceil(total / limit))

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    setPage(1)
    load()
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <form onSubmit={handleSearch} className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-48">
            <label className="text-xs text-gray-500 mb-1 block">Action / recherche</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="create_project, login…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>
          <div className="w-36">
            <label className="text-xs text-gray-500 mb-1 block">Entité</label>
            <select
              value={entity}
              onChange={e => setEntity(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">Toutes</option>
              <option value="project">Projet</option>
              <option value="task">Tâche</option>
              <option value="expense">Dépense</option>
              <option value="user">Utilisateur</option>
              <option value="document">Document</option>
              <option value="program">Program</option>
            </select>
          </div>
          <div className="w-36">
            <label className="text-xs text-gray-500 mb-1 block">Du</label>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="w-36">
            <label className="text-xs text-gray-500 mb-1 block">Au</label>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
            >
              <Filter className="w-3.5 h-3.5" />
              Filtrer
            </button>
            <button
              type="button"
              onClick={() => { setSearch(''); setEntity(''); setDateFrom(''); setDateTo(''); setPage(1) }}
              className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              Réinitialiser
            </button>
            <button
              type="button"
              onClick={load}
              className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              title="Rafraîchir"
            >
              <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
            </button>
          </div>
        </form>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {loading ? 'Chargement…' : `${total} entrée${total !== 1 ? 's' : ''}`}
          </span>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Page {page}/{totalPages}</span>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="p-1 rounded hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {logs.length === 0 && !loading ? (
          <div className="py-16 text-center">
            <Shield className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Aucune entrée trouvée</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Utilisateur</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Entité</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider">Détail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">
                      {timeAgo(log.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-xs font-medium text-gray-700">{log.user?.full_name ?? '—'}</div>
                      <div className="text-[10px] text-gray-400">{log.user_email ?? log.user?.email ?? '—'}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${actionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {log.entity_type && (
                        <span className="font-medium text-gray-700">{log.entity_type}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">
                      {log.entity_name ?? log.entity_id?.slice(0, 8) ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

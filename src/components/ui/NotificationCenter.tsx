'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Bell, CheckCheck, X, Info, AlertTriangle, CheckCircle, XCircle, Clock, ChevronDown, FileText } from 'lucide-react'
import { cn, timeAgo } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { PopcornIcon } from '@/components/ui/PopcornIcon'

interface Notif {
  id: string
  type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  related_id?: string | null
  related_type?: string | null
}

const typeIcon: Record<string, React.ReactNode> = {
  task_assigned:          <Info className="w-4 h-4 text-blue-500" />,
  task_accepted:          <CheckCircle className="w-4 h-4 text-green-500" />,
  task_refused:           <XCircle className="w-4 h-4 text-red-500" />,
  task_done:              <CheckCircle className="w-4 h-4 text-green-600" />,
  task_deleted:           <AlertTriangle className="w-4 h-4 text-orange-500" />,
  task_comment:           <Info className="w-4 h-4 text-purple-500" />,
  task_acceptance_reset:  <Clock className="w-4 h-4 text-yellow-500" />,
  task_refusal_overridden:<CheckCircle className="w-4 h-4 text-teal-500" />,
  document_uploaded:      <FileText className="w-4 h-4 text-indigo-500" />,
  expense_approved:       <CheckCircle className="w-4 h-4 text-green-500" />,
  expense_rejected:       <XCircle className="w-4 h-4 text-red-500" />,
  project_update:         <AlertTriangle className="w-4 h-4 text-yellow-500" />,
  program_request:        <Info className="w-4 h-4 text-indigo-500" />,
  deadline_warning:       <Clock className="w-4 h-4 text-orange-500" />,
  new_pop:                <PopcornIcon className="w-4 h-4 text-amber-500" />,
  pop_created:            <PopcornIcon className="w-4 h-4 text-amber-500" />,
}

function notifLink(n: Notif): string | null {
  if (n.related_type === 'task' && n.related_id)    return `/tasks/${n.related_id}`
  if (n.related_type === 'project' && n.related_id) return `/projects/${n.related_id}`
  return null
}

export default function NotificationCenter({ userId }: { userId: string }) {
  const router                    = useRouter()
  const [open, setOpen]           = useState(false)
  const [notifs, setNotifs]       = useState<Notif[]>([])
  const [loading, setLoading]     = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage]           = useState(1)
  const [hasMore, setHasMore]     = useState(false)
  const panelRef                  = useRef<HTMLDivElement>(null)

  const unread = notifs.filter(n => !n.is_read).length

  // ── Chargement via API (NT-01) ────────────────────────────────────────────
  const load = useCallback(async (p = 1, append = false) => {
    if (p === 1) setLoading(true)
    else setLoadingMore(true)

    try {
      const res  = await fetch(`/api/notifications?page=${p}`)
      const json = await res.json()
      const items: Notif[] = json.data ?? []
      const total: number  = json.count ?? 0
      const limit: number  = json.limit ?? 30

      setNotifs(prev => append ? [...prev, ...items] : items)
      setHasMore(p * limit < total)
      setPage(p)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  const loadMore = () => load(page + 1, true)

  // ── Mark all read ─────────────────────────────────────────────────────────
  async function markAllRead() {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    })
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })))
  }

  // ── Mark one read ─────────────────────────────────────────────────────────
  async function markRead(id: string) {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
  }

  // ── Dismiss ───────────────────────────────────────────────────────────────
  async function dismiss(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    await fetch('/api/notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setNotifs(prev => prev.filter(n => n.id !== id))
  }

  function handleNotifClick(n: Notif) {
    if (!n.is_read) markRead(n.id)
    const link = notifLink(n)
    if (link) { setOpen(false); router.push(link) }
  }

  // ── Chargement initial ────────────────────────────────────────────────────
  useEffect(() => { load(1) }, [userId, load])

  // ── Realtime Supabase (INSERT uniquement — lecture sécurisée via RLS) ────
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`notif-${userId}-${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        setNotifs(prev => [payload.new as Notif, ...prev])
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // ── Close on outside click ────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen(o => !o); if (!open) load(1) }}
        className={cn(
          'relative p-1.5 rounded-lg transition',
          open ? 'bg-gray-100 text-gray-700' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
        )}
        aria-label="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-0.5 leading-none">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Notifications</span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                Tout marquer lu
              </button>
            )}
          </div>

          {/* Body */}
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="py-10 text-center text-sm text-gray-400">Chargement…</div>
            ) : notifs.length === 0 ? (
              <div className="py-10 text-center">
                <Bell className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                <p className="text-sm text-gray-400">Aucune notification</p>
              </div>
            ) : (
              <>
                {notifs.map(n => (
                  <div
                    key={n.id}
                    onClick={() => handleNotifClick(n)}
                    className={cn(
                      'flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition-colors',
                      !n.is_read && 'bg-blue-50/40',
                      notifLink(n) && 'cursor-pointer'
                    )}
                  >
                    <div className="mt-0.5 shrink-0">
                      {typeIcon[n.type] ?? <Info className="w-4 h-4 text-gray-400" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={cn('text-xs font-semibold text-gray-800', !n.is_read && 'text-gray-900')}>
                        {n.title}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.created_at)}</p>
                    </div>
                    <button
                      onClick={(e) => dismiss(e, n.id)}
                      className="p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-200 transition shrink-0"
                      aria-label="Supprimer"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                {/* NT-02 : Voir plus */}
                {hasMore && (
                  <button
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="w-full flex items-center justify-center gap-1.5 py-2.5 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition font-medium"
                  >
                    {loadingMore
                      ? <span className="text-gray-400">Chargement…</span>
                      : <><ChevronDown className="w-3.5 h-3.5" />Voir plus</>
                    }
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

'use client'

import { useState, useEffect, useCallback } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { fr } from 'date-fns/locale'
import {
  Clock, CheckCircle2, XCircle, Mail, RefreshCw,
  ShieldCheck, Filter, MessageSquare,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, getInitials } from '@/lib/utils'

type ResetRequest = {
  id: string
  email: string
  status: 'pending' | 'approved' | 'rejected'
  requested_at: string
  reviewed_at: string | null
  review_note: string | null
  user_id: string
  profiles: {
    full_name: string
    role: string
    avatar_url: string | null
  } | null
  reviewer: { full_name: string } | null
}

const STATUS_LABELS = {
  pending:  { label: 'En attente',  color: 'bg-amber-50 text-amber-700 border-amber-200' },
  approved: { label: 'Approuvée',   color: 'bg-green-50 text-green-700 border-green-200' },
  rejected: { label: 'Refusée',     color: 'bg-red-50 text-red-600 border-red-200' },
}

function RejectModal({
  request,
  onClose,
  onConfirm,
}: {
  request: ResetRequest
  onClose: () => void
  onConfirm: (note: string) => void
}) {
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-red-50 flex items-center justify-center">
            <XCircle className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Refuser la demande</h3>
            <p className="text-xs text-gray-400">{request.email}</p>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Note pour l'utilisateur <span className="text-gray-400 font-normal">(optionnel)</span>
          </label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={3}
            placeholder="Raison du refus..."
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
          />
        </div>
        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
            Annuler
          </button>
          <button
            onClick={async () => {
              setLoading(true)
              await onConfirm(note)
              setLoading(false)
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition disabled:opacity-50"
          >
            <XCircle className="w-3.5 h-3.5" />
            {loading ? 'Refus en cours…' : 'Confirmer le refus'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ResetRequestsTable({ isAdmin }: { isAdmin: boolean }) {
  const [requests, setRequests] = useState<ResetRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<ResetRequest | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch(`/api/admin/reset-requests?status=${filter}`)
    const json = await res.json()
    setRequests(json.requests ?? [])
    setLoading(false)
  }, [filter])

  useEffect(() => { load() }, [load])

  async function handleApprove(req: ResetRequest) {
    setActionLoading(req.id)
    const res = await fetch(`/api/admin/reset-requests/${req.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'approve' }),
    })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? 'Erreur')
    } else {
      toast.success(`Lien de réinitialisation envoyé à ${req.email}`)
      load()
    }
    setActionLoading(null)
  }

  async function handleReject(req: ResetRequest, note: string) {
    const res = await fetch(`/api/admin/reset-requests/${req.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'reject', note }),
    })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? 'Erreur')
    } else {
      toast.success('Demande refusée')
      setRejectTarget(null)
      load()
    }
  }

  const pendingCount = requests.filter(r => r.status === 'pending').length

  return (
    <>
      {rejectTarget && (
        <RejectModal
          request={rejectTarget}
          onClose={() => setRejectTarget(null)}
          onConfirm={(note) => handleReject(rejectTarget, note)}
        />
      )}

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-700">Afficher :</span>
            <div className="flex gap-1">
              {(['pending', 'all'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={cn(
                    'px-3 py-1 text-xs font-medium rounded-lg transition',
                    filter === f
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  )}
                >
                  {f === 'pending' ? `En attente${pendingCount > 0 && filter === 'pending' ? ` (${pendingCount})` : ''}` : 'Toutes'}
                </button>
              ))}
            </div>
          </div>
          <button
            onClick={load}
            disabled={loading}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition disabled:opacity-50"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-16 space-y-2">
            <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
            <p className="text-sm font-medium text-gray-600">
              {filter === 'pending' ? 'Aucune demande en attente' : 'Aucune demande'}
            </p>
            <p className="text-xs text-gray-400">
              {filter === 'pending' ? 'Toutes les demandes ont été traitées.' : ''}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {requests.map(req => {
              const profile = req.profiles
              const statusConfig = STATUS_LABELS[req.status]
              const isActioning = actionLoading === req.id

              return (
                <div key={req.id} className="flex items-center gap-4 px-5 py-4 hover:bg-gray-50/60 transition">
                  {/* Avatar */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-sm font-bold shrink-0 overflow-hidden">
                    {profile?.avatar_url ? (
                      <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
                    ) : (
                      getInitials(profile?.full_name ?? req.email)
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-gray-900 truncate">
                        {profile?.full_name ?? '—'}
                      </span>
                      <span className={cn(
                        'inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border',
                        statusConfig.color
                      )}>
                        {statusConfig.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Mail className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-500">{req.email}</span>
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Clock className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-400">
                        Demandé {formatDistanceToNow(new Date(req.requested_at), { addSuffix: true, locale: fr })}
                      </span>
                      {req.reviewed_at && req.reviewer && (
                        <>
                          <span className="text-gray-300">·</span>
                          <span className="text-xs text-gray-400">
                            Traité par {req.reviewer.full_name}
                          </span>
                        </>
                      )}
                    </div>
                    {req.review_note && (
                      <div className="flex items-start gap-1.5 mt-1">
                        <MessageSquare className="w-3 h-3 text-gray-400 mt-0.5" />
                        <span className="text-xs text-gray-500 italic">{req.review_note}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  {req.status === 'pending' && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => setRejectTarget(req)}
                        disabled={isActioning}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition disabled:opacity-50"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        Refuser
                      </button>
                      <button
                        onClick={() => handleApprove(req)}
                        disabled={isActioning}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                      >
                        {isActioning
                          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          : <CheckCircle2 className="w-3.5 h-3.5" />
                        }
                        {isActioning ? 'Envoi…' : 'Approuver & Envoyer'}
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </>
  )
}

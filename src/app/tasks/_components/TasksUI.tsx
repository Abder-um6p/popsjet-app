'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import Link from 'next/link'
import {
  CheckSquare, Clock, AlertTriangle, Circle, Check, Eye,
  Filter, X, RefreshCw, Inbox,
  CheckCircle2, Ban, ArrowUpRight, Hourglass, RotateCcw, Trash2, Undo2, Plus,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatDate, taskStatusColor, taskPriorityColor, LABELS, timeAgo } from '@/lib/utils'
import AIEmailImport from '@/components/ai/AIEmailImport'

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = { id: string; full_name: string; email: string; avatar_url: string | null }
type Project = { id: string; code: string; title: string }

type Task = {
  id: string
  project_id: string
  title: string
  description?: string
  status: string
  priority: string
  due_date?: string | null
  pending_acceptance: boolean
  accepted_at?: string | null
  refused_at?: string | null
  refused_reason?: string | null
  refused_by?: string | null
  assigned_by?: string | null
  created_by: string
  created_at: string
  updated_at: string
  assignee?: Profile | null
  assigner?: Profile | null
  project?: Project | null
}

type TrashTask = Task & {
  deleted_at: string
  deleted_by?: string | null
  deleter?: Profile | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PRIVILEGED_ROLES = new Set(['admin', 'directeur', 'chef_projet'])
const DESTROY_ROLES    = new Set(['admin', 'directeur'])

function isOverdue(task: Task): boolean {
  return !!(task.due_date && new Date(task.due_date) < new Date()
    && !['done', 'cancelled', 'refused'].includes(task.status))
}

function dueDateInfo(task: Task): { label: string; tone: 'overdue' | 'soon' | 'normal' | 'none' } {
  if (!task.due_date) return { label: '—', tone: 'none' }
  const d = new Date(task.due_date)
  const now = new Date()
  const ms = d.getTime() - now.getTime()
  const days = Math.ceil(ms / (1000 * 60 * 60 * 24))
  if (ms < 0 && !['done', 'cancelled', 'refused'].includes(task.status)) {
    return { label: formatDate(task.due_date), tone: 'overdue' }
  }
  if (days <= 3 && !['done', 'cancelled', 'refused'].includes(task.status)) {
    return { label: formatDate(task.due_date), tone: 'soon' }
  }
  return { label: formatDate(task.due_date), tone: 'normal' }
}

function canDelete(task: Task, userId: string, role: string): boolean {
  return PRIVILEGED_ROLES.has(role) || task.created_by === userId
}

function canRestore(task: TrashTask, userId: string, role: string): boolean {
  return PRIVILEGED_ROLES.has(role) || task.created_by === userId
}

function canDestroy(role: string): boolean {
  return DESTROY_ROLES.has(role)
}

// ─── Quick Create Task Modal (UX-03) ─────────────────────────────────────────

function QuickCreateModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [projects, setProjects]   = useState<Project[]>([])
  const [projectId, setProjectId] = useState('')
  const [title, setTitle]         = useState('')
  const [priority, setPriority]   = useState('medium')
  const [dueDate, setDueDate]     = useState('')
  const [loading, setLoading]     = useState(false)
  const [loadingProjects, setLoadingProjects] = useState(true)

  useEffect(() => {
    fetch('/api/projects/list')
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setProjects(Array.isArray(data) ? data : (data.projects ?? []))
        setLoadingProjects(false)
      })
      .catch(() => setLoadingProjects(false))
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!projectId || !title.trim()) return
    setLoading(true)
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id: projectId,
        title:      title.trim(),
        priority,
        due_date:   dueDate || null,
      }),
    })
    setLoading(false)
    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      toast.error(json.error ?? 'Erreur lors de la création')
      return
    }
    toast.success('Tâche créée')
    onCreated()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Nouvelle tâche</h3>
          <button onClick={onClose} className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          {/* Projet */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Projet <span className="text-red-500">*</span></label>
            <select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              required
              disabled={loadingProjects}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="">{loadingProjects ? 'Chargement…' : '— Sélectionner un projet —'}</option>
              {projects.map(p => (
                <option key={p.id} value={p.id}>{p.code} — {p.title}</option>
              ))}
            </select>
          </div>

          {/* Titre */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Titre <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              required
              placeholder="Décrire la tâche en une phrase…"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Priorité + Échéance */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Priorité</label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                <option value="low">Faible</option>
                <option value="medium">Moyen</option>
                <option value="high">Élevé</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Échéance</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
              Annuler
            </button>
            <button
              type="submit"
              disabled={loading || !projectId || !title.trim()}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-40"
            >
              {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {loading ? 'Création…' : 'Créer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Refuse Modal ─────────────────────────────────────────────────────────────

function RefuseModal({
  task,
  onClose,
  onConfirm,
}: {
  task: Task
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <Ban className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">Refuser la tâche</h3>
            <p className="text-xs text-gray-500 truncate">{task.title}</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Raison du refus <span className="text-gray-400">(optionnel)</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Ex : Je ne suis pas disponible pour cette tâche…"
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
            Annuler
          </button>
          <button
            onClick={async () => { setLoading(true); await onConfirm(reason); setLoading(false) }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50"
          >
            <Ban className="w-3.5 h-3.5" />
            {loading ? 'Refus…' : 'Refuser'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Delete (soft) Confirmation Modal ─────────────────────────────────────────

function DeleteModal({
  task,
  onClose,
  onConfirm,
}: {
  task: Task
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-orange-500" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">Envoyer à la corbeille</h3>
            <p className="text-xs text-gray-500 truncate">{task.title}</p>
          </div>
        </div>
        <p className="text-sm text-gray-600">
          La tâche sera déplacée dans la corbeille. Vous pourrez la restaurer plus tard
          depuis l&apos;onglet <span className="font-medium text-gray-800">🗑 Corbeille</span>.
        </p>
        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
            Annuler
          </button>
          <button
            onClick={async () => { setLoading(true); await onConfirm(); setLoading(false) }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 transition disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {loading ? 'Suppression…' : 'Envoyer à la corbeille'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Destroy (permanent) Confirmation Modal ───────────────────────────────────

function DestroyModal({
  task,
  onClose,
  onConfirm,
}: {
  task: TrashTask
  onClose: () => void
  onConfirm: () => Promise<void>
}) {
  const [loading, setLoading] = useState(false)
  const [confirmText, setConfirmText] = useState('')
  const canSubmit = confirmText.trim().toUpperCase() === 'SUPPRIMER'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
            <AlertTriangle className="w-5 h-5 text-red-500" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900">Supprimer définitivement</h3>
            <p className="text-xs text-gray-500 truncate">{task.title}</p>
          </div>
        </div>

        <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 space-y-1">
          <p className="font-semibold flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" /> Cette action est irréversible
          </p>
          <p>
            La tâche, ses commentaires, ses pièces jointes et son historique d&apos;activité
            seront supprimés définitivement de la base de données.
          </p>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Pour confirmer, tapez <span className="font-mono font-bold text-red-600">SUPPRIMER</span>
          </label>
          <input
            type="text"
            value={confirmText}
            onChange={e => setConfirmText(e.target.value)}
            placeholder="SUPPRIMER"
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-300"
            autoFocus
          />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
            Annuler
          </button>
          <button
            onClick={async () => { setLoading(true); await onConfirm(); setLoading(false) }}
            disabled={loading || !canSubmit}
            className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-3.5 h-3.5" />
            {loading ? 'Suppression…' : 'Supprimer définitivement'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Quick status transitions ─────────────────────────────────────────────────

const QUICK_TRANSITIONS: Record<string, { status: string; label: string; cls: string }[]> = {
  todo:        [
    { status: 'in_progress', label: 'Démarrer',    cls: 'border-blue-200 text-blue-600 hover:bg-blue-50' },
    { status: 'done',        label: 'Terminer',     cls: 'border-green-200 text-green-600 hover:bg-green-50' },
  ],
  in_progress: [
    { status: 'review',      label: 'En révision',  cls: 'border-yellow-200 text-yellow-600 hover:bg-yellow-50' },
    { status: 'done',        label: 'Terminer',     cls: 'border-green-200 text-green-600 hover:bg-green-50' },
  ],
  review: [
    { status: 'done',        label: 'Terminer',     cls: 'border-green-200 text-green-600 hover:bg-green-50' },
    { status: 'in_progress', label: 'En cours',     cls: 'border-blue-200 text-blue-600 hover:bg-blue-50' },
  ],
  done: [
    { status: 'in_progress', label: 'Réouvrir',     cls: 'border-blue-200 text-blue-600 hover:bg-blue-50' },
    { status: 'review',      label: 'En révision',  cls: 'border-yellow-200 text-yellow-600 hover:bg-yellow-50' },
  ],
}

// ─── Task Card (active tabs) ──────────────────────────────────────────────────

function TaskCard({
  task,
  userId,
  role,
  onAccept,
  onRefuse,
  onUndoAccept,
  onUndoRefuse,
  onDelete,
  onStatusChange,
}: {
  task: Task
  userId: string
  role: string
  onAccept: (t: Task) => void
  onRefuse: (t: Task) => void
  onUndoAccept: (t: Task) => void
  onUndoRefuse: (t: Task) => void
  onDelete: (t: Task) => void
  onStatusChange: (t: Task, status: string) => void
}) {
  const due = dueDateInfo(task)
  const allowDelete = canDelete(task, userId, role)
  const showUndoAccept  = task.status === 'todo' && !!task.accepted_at
  const showUndoRefuse  = task.status === 'refused'
  const showAcceptRefuse = task.status === 'pending_acceptance'
  const quickActions    = QUICK_TRANSITIONS[task.status] ?? []

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <Link
            href={`/tasks/${task.id}`}
            className={cn(
              'block font-semibold text-sm leading-snug text-gray-900 hover:text-blue-600 transition truncate',
              task.status === 'done' && 'line-through text-gray-400'
            )}
          >
            {task.title}
          </Link>
          {task.project && (
            <p className="text-xs text-blue-500 mt-0.5 truncate">
              {task.project.code} · {task.project.title}
            </p>
          )}
        </div>
        <Link
          href={`/tasks/${task.id}`}
          className="shrink-0 p-1 text-gray-300 hover:text-blue-600 rounded-lg hover:bg-blue-50 transition"
          title="Voir le détail"
        >
          <ArrowUpRight className="w-4 h-4" />
        </Link>
      </div>

      <div className="flex items-center flex-wrap gap-2 text-xs">
        <span className={cn('px-2 py-0.5 rounded-full font-medium', taskPriorityColor(task.priority))}>
          {LABELS.task_priority[task.priority as keyof typeof LABELS.task_priority] ?? task.priority}
        </span>
        <span className={cn('px-2 py-0.5 rounded-full font-medium', taskStatusColor(task.status))}>
          {LABELS.task_status[task.status as keyof typeof LABELS.task_status] ?? task.status}
        </span>
        {due.tone !== 'none' && (
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium',
            due.tone === 'overdue' && 'bg-red-50 text-red-700',
            due.tone === 'soon'    && 'bg-orange-50 text-orange-700',
            due.tone === 'normal'  && 'bg-gray-50 text-gray-600'
          )}>
            {due.tone === 'overdue' && <AlertTriangle className="w-3 h-3" />}
            {due.label}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between text-xs text-gray-500 gap-2">
        <span className="truncate">
          {task.assigner ? <>par <span className="text-gray-700 font-medium">{task.assigner.full_name}</span></> : 'Auto-assignée'}
        </span>
        <span className="shrink-0 text-gray-400">{timeAgo(task.created_at)}</span>
      </div>

      {task.status === 'refused' && task.refused_reason && (
        <div className="p-2 bg-red-50 rounded-lg border border-red-100 text-xs text-red-700">
          <span className="font-medium">Raison : </span>{task.refused_reason}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-50">
        {showAcceptRefuse && (
          <>
            <button
              onClick={() => onAccept(task)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Accepter
            </button>
            <button
              onClick={() => onRefuse(task)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition"
            >
              <Ban className="w-3.5 h-3.5" /> Refuser
            </button>
          </>
        )}
        {showUndoAccept && (
          <button
            onClick={() => onUndoAccept(task)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Annuler l&apos;acceptation
          </button>
        )}
        {showUndoRefuse && (
          <button
            onClick={() => onUndoRefuse(task)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition"
          >
            <CheckCircle2 className="w-3.5 h-3.5" /> Accepter quand même
          </button>
        )}

        {/* Quick status actions */}
        {!showAcceptRefuse && quickActions.map(qa => (
          <button
            key={qa.status}
            onClick={() => onStatusChange(task, qa.status)}
            className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium border rounded-lg transition ${qa.cls}`}
          >
            {qa.label}
          </button>
        ))}

        {allowDelete && (
          <button
            onClick={() => onDelete(task)}
            className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
            title="Envoyer à la corbeille"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Trash Card ──────────────────────────────────────────────────────────────

function TrashCard({
  task,
  userId,
  role,
  onRestore,
  onDestroy,
}: {
  task: TrashTask
  userId: string
  role: string
  onRestore: (t: TrashTask) => void
  onDestroy: (t: TrashTask) => void
}) {
  const allowRestore = canRestore(task, userId, role)
  const allowDestroy = canDestroy(role)

  return (
    <div className="bg-white rounded-xl border border-gray-200 border-dashed shadow-sm p-4 flex flex-col gap-3 opacity-90 hover:opacity-100 transition">
      <div className="flex items-start justify-between gap-3 min-w-0">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-sm leading-snug text-gray-700 line-through truncate">
            {task.title}
          </p>
          {task.project && (
            <p className="text-xs text-blue-500 mt-0.5 truncate">
              {task.project.code} · {task.project.title}
            </p>
          )}
        </div>
        <span className="shrink-0 inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
          <Trash2 className="w-3 h-3" /> Supprimée
        </span>
      </div>

      <div className="flex items-center flex-wrap gap-2 text-xs">
        <span className={cn('px-2 py-0.5 rounded-full font-medium', taskPriorityColor(task.priority))}>
          {LABELS.task_priority[task.priority as keyof typeof LABELS.task_priority] ?? task.priority}
        </span>
        <span className={cn('px-2 py-0.5 rounded-full font-medium opacity-70', taskStatusColor(task.status))}>
          {LABELS.task_status[task.status as keyof typeof LABELS.task_status] ?? task.status}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-gray-500">
        <div>
          <p className="font-medium text-gray-700 mb-0.5">Supprimée par</p>
          <p className="truncate">{task.deleter?.full_name ?? 'Inconnu'}</p>
        </div>
        <div>
          <p className="font-medium text-gray-700 mb-0.5">Le</p>
          <p>{formatDate(task.deleted_at)} <span className="text-gray-400">· {timeAgo(task.deleted_at)}</span></p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 pt-1 border-t border-gray-100">
        {allowRestore && (
          <button
            onClick={() => onRestore(task)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Undo2 className="w-3.5 h-3.5" /> Restaurer
          </button>
        )}
        {allowDestroy && (
          <button
            onClick={() => onDestroy(task)}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition"
            title="Suppression définitive — irréversible"
          >
            <Trash2 className="w-3.5 h-3.5" /> Supprimer définitivement
          </button>
        )}
        {!allowRestore && !allowDestroy && (
          <p className="text-xs text-gray-400 italic">Aucune action autorisée pour votre rôle</p>
        )}
      </div>
    </div>
  )
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

type TabKey = 'pending_acceptance' | 'todo' | 'in_progress' | 'review' | 'done' | 'refused' | 'trash'

const TABS: { key: TabKey; label: string; icon: React.ReactNode; accent: string }[] = [
  { key: 'pending_acceptance', label: 'En attente',  icon: <Hourglass className="w-3.5 h-3.5" />, accent: 'text-purple-600 border-purple-500' },
  { key: 'todo',               label: 'À faire',     icon: <Circle className="w-3.5 h-3.5" />,    accent: 'text-gray-700 border-gray-500' },
  { key: 'in_progress',        label: 'En cours',    icon: <Clock className="w-3.5 h-3.5" />,     accent: 'text-blue-600 border-blue-500' },
  { key: 'review',             label: 'En révision', icon: <Eye className="w-3.5 h-3.5" />,       accent: 'text-yellow-600 border-yellow-500' },
  { key: 'done',               label: 'Terminées',   icon: <Check className="w-3.5 h-3.5" />,     accent: 'text-green-600 border-green-500' },
  { key: 'refused',            label: 'Refusées',    icon: <Ban className="w-3.5 h-3.5" />,       accent: 'text-red-600 border-red-500' },
  { key: 'trash',              label: 'Corbeille',   icon: <Trash2 className="w-3.5 h-3.5" />,    accent: 'text-gray-700 border-gray-500' },
]

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TasksUI({ userId, role }: { userId: string; role: string }) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [trashed, setTrashed] = useState<TrashTask[]>([])
  const [loading, setLoading] = useState(true)
  const [trashLoading, setTrashLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Filters
  const [filterProject, setFilterProject] = useState('')
  const [filterPriority, setFilterPriority] = useState('')
  const [showFilters, setShowFilters] = useState(false)

  // Active tab
  const [activeTab, setActiveTab] = useState<TabKey>('pending_acceptance')

  // Modals
  const [refuseTarget, setRefuseTarget]       = useState<Task | null>(null)
  const [deleteTarget, setDeleteTarget]       = useState<Task | null>(null)
  const [destroyTarget, setDestroyTarget]     = useState<TrashTask | null>(null)
  const [showQuickCreate, setShowQuickCreate] = useState(false)

  // ── Fetch active tasks ──
  const loadTasks = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch('/api/tasks')
      const text = await res.text()
      const body = text ? JSON.parse(text) : []
      if (res.ok) {
        setTasks(Array.isArray(body) ? body : [])
      } else {
        setLoadError(body?.error ?? `HTTP ${res.status}`)
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Erreur réseau')
    }
    setLoading(false)
  }, [])

  // ── Fetch trashed tasks (all roles — server scopes by role) ──
  const loadTrash = useCallback(async () => {
    setTrashLoading(true)
    try {
      const res = await fetch('/api/tasks/trash')
      const text = await res.text()
      const body = text ? JSON.parse(text) : []
      if (res.ok) {
        setTrashed(Array.isArray(body) ? body : [])
      } else {
        // Don't surface a global error for trash — keep main view working
        console.warn('[trash] load failed:', body?.error ?? res.status)
        setTrashed([])
      }
    } catch (e) {
      console.warn('[trash] load network error:', e)
      setTrashed([])
    }
    setTrashLoading(false)
  }, [])

  const refresh = useCallback(() => {
    loadTasks()
    loadTrash()
  }, [loadTasks, loadTrash])

  useEffect(() => { refresh() }, [refresh])

  // ── Filters applied to base list ──
  const filtered = useMemo(() => {
    return tasks.filter(t => {
      if (filterProject && t.project_id !== filterProject) return false
      if (filterPriority && t.priority !== filterPriority) return false
      return true
    })
  }, [tasks, filterProject, filterPriority])

  const filteredTrash = useMemo(() => {
    return trashed.filter(t => {
      if (filterProject && t.project_id !== filterProject) return false
      if (filterPriority && t.priority !== filterPriority) return false
      return true
    })
  }, [trashed, filterProject, filterPriority])

  // ── Counts per tab (from filtered) ──
  const counts = useMemo(() => {
    return {
      pending_acceptance: filtered.filter(t => t.status === 'pending_acceptance').length,
      todo:               filtered.filter(t => t.status === 'todo').length,
      in_progress:        filtered.filter(t => t.status === 'in_progress').length,
      review:             filtered.filter(t => t.status === 'review').length,
      done:               filtered.filter(t => t.status === 'done').length,
      refused:            filtered.filter(t => t.status === 'refused').length,
      trash:              filteredTrash.length,
    } as Record<TabKey, number>
  }, [filtered, filteredTrash])

  // Privileged roles (admin/directeur/chef_projet) always see the trash tab — even when empty.
  // A simple "membre" sees it only if they themselves have soft-deleted at least one task.
  const userCanSeeTrash =
    ['admin', 'directeur', 'chef_projet'].includes(role ?? '')
    || trashed.some(t => t.deleted_by === userId)

  const visibleTabs = useMemo(
    () => TABS.filter(t => {
      if (t.key === 'review' && counts.review === 0) return false
      if (t.key === 'trash' && !userCanSeeTrash) return false
      return true
    }),
    [counts.review, userCanSeeTrash]
  )

  // Auto-pick first non-empty tab on first load
  useEffect(() => {
    if (loading || tasks.length === 0) return
    if (activeTab === 'trash') return
    if (counts[activeTab] > 0) return
    const first = visibleTabs.find(t => t.key !== 'trash' && counts[t.key] > 0)
    if (first) setActiveTab(first.key)
  }, [loading, tasks.length, counts, activeTab, visibleTabs])

  const currentTasks = useMemo(
    () => activeTab === 'trash' ? [] : filtered.filter(t => t.status === activeTab),
    [filtered, activeTab]
  )

  // ── Header stats (independent of filters) ──
  const stats = {
    pending:    tasks.filter(t => t.status === 'pending_acceptance').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    overdue:    tasks.filter(t => isOverdue(t)).length,
    done:       tasks.filter(t => t.status === 'done').length,
  }

  // ── Project options for filter (active + trashed) ──
  const projectOptions = useMemo(() => {
    const map = new Map<string, Project>()
    tasks.forEach(t => { if (t.project) map.set(t.project.id, t.project) })
    trashed.forEach(t => { if (t.project) map.set(t.project.id, t.project) })
    return Array.from(map.values())
  }, [tasks, trashed])

  const hasFilters = !!(filterProject || filterPriority)

  // ── Optimistic helpers ──
  function patchTask(taskId: string, patch: Partial<Task>) {
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, ...patch } : t))
  }

  function moveToTrash(task: Task) {
    const nowIso = new Date().toISOString()
    const trashItem: TrashTask = {
      ...task,
      deleted_at: nowIso,
      deleted_by: userId,
      deleter: null,
    }
    setTasks(prev => prev.filter(t => t.id !== task.id))
    setTrashed(prev => [trashItem, ...prev])
  }

  function moveFromTrash(taskId: string) {
    const item = trashed.find(t => t.id === taskId)
    if (!item) return
    setTrashed(prev => prev.filter(t => t.id !== taskId))
    const { deleted_at: _da, deleted_by: _db, deleter: _de, ...rest } = item
    void _da; void _db; void _de
    setTasks(prev => [{ ...(rest as Task) }, ...prev])
  }

  function dropFromTrash(taskId: string) {
    setTrashed(prev => prev.filter(t => t.id !== taskId))
  }

  // ── Actions ──
  async function postAction(url: string, body?: unknown, init?: RequestInit): Promise<{ ok: boolean; data: { error?: string; task?: Task } }> {
    const res = await fetch(url, {
      method: init?.method ?? 'POST',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    })
    const text = await res.text()
    const data = text ? JSON.parse(text) : {}
    return { ok: res.ok, data }
  }

  async function handleAccept(task: Task) {
    const { ok, data } = await postAction(`/api/tasks/${task.id}/accept`)
    if (!ok) { toast.error(data.error ?? 'Erreur'); return }
    toast.success(`Tâche "${task.title}" acceptée`)
    patchTask(task.id, { status: 'todo', pending_acceptance: false, accepted_at: new Date().toISOString() })
    setActiveTab('todo')
  }

  function handleRefuseClick(task: Task) { setRefuseTarget(task) }

  async function handleRefuseConfirm(reason: string) {
    if (!refuseTarget) return
    const { ok, data } = await postAction(`/api/tasks/${refuseTarget.id}/refuse`, { reason: reason || null })
    if (!ok) { toast.error(data.error ?? 'Erreur'); return }
    toast.success(`Tâche refusée`)
    patchTask(refuseTarget.id, {
      status: 'refused', pending_acceptance: false,
      refused_at: new Date().toISOString(), refused_reason: reason || null, refused_by: userId,
    })
    setRefuseTarget(null)
    setActiveTab('refused')
  }

  async function handleUndoAccept(task: Task) {
    const { ok, data } = await postAction(`/api/tasks/${task.id}/undo-accept`)
    if (!ok) { toast.error(data.error ?? 'Erreur'); return }
    toast.success('Acceptation annulée')
    patchTask(task.id, { status: 'pending_acceptance', pending_acceptance: true, accepted_at: null })
    setActiveTab('pending_acceptance')
  }

  async function handleUndoRefuse(task: Task) {
    const { ok, data } = await postAction(`/api/tasks/${task.id}/undo-refuse`)
    if (!ok) { toast.error(data.error ?? 'Erreur'); return }
    toast.success(`Tâche "${task.title}" réactivée`)
    patchTask(task.id, {
      status: 'todo', pending_acceptance: false,
      refused_at: null, refused_reason: null, refused_by: null,
    })
    setActiveTab('todo')
  }

  function handleDeleteClick(task: Task) { setDeleteTarget(task) }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return
    const target = deleteTarget
    const { ok, data } = await postAction(`/api/tasks/${target.id}/delete`, undefined, { method: 'DELETE' })
    if (!ok) { toast.error(data.error ?? 'Erreur'); return }
    toast.success('Tâche envoyée à la corbeille')
    moveToTrash(target)
    setDeleteTarget(null)
    // Refresh trash to pull the enriched record (deleter profile, etc.)
    loadTrash()
  }

  async function handleRestore(task: TrashTask) {
    const { ok, data } = await postAction(`/api/tasks/${task.id}/restore`)
    if (!ok) { toast.error(data.error ?? 'Erreur'); return }
    toast.success(`Tâche "${task.title}" restaurée`)
    moveFromTrash(task.id)
    // Re-fetch active list to enrich (assigner profile etc.)
    loadTasks()
  }

  function handleDestroyClick(task: TrashTask) { setDestroyTarget(task) }

  async function handleDestroyConfirm() {
    if (!destroyTarget) return
    const target = destroyTarget
    const { ok, data } = await postAction(`/api/tasks/${target.id}/destroy`, undefined, { method: 'DELETE' })
    if (!ok) { toast.error(data.error ?? 'Erreur'); return }
    toast.success('Tâche supprimée définitivement')
    dropFromTrash(target.id)
    setDestroyTarget(null)
  }

  async function handleQuickStatus(task: Task, newStatus: string) {
    const res = await fetch(`/api/tasks/${task.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    })
    const text = await res.text()
    const data = text ? JSON.parse(text) : {}
    if (!res.ok) { toast.error(data.error ?? 'Erreur'); return }
    patchTask(task.id, { status: newStatus })
    toast.success(`Statut mis à jour : ${LABELS.task_status[newStatus as keyof typeof LABELS.task_status] ?? newStatus}`)
    // If the new status matches a different tab, switch to it
    const newTab = newStatus as TabKey
    if (TABS.some(t => t.key === newTab)) setActiveTab(newTab)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (loadError) return (
    <div className="bg-white rounded-xl border border-red-100 shadow-sm p-8 max-w-xl space-y-2">
      <p className="text-sm font-semibold text-red-600">Erreur lors du chargement</p>
      <p className="text-xs text-red-400 font-mono">{loadError}</p>
      <button onClick={refresh} className="text-sm text-blue-600 hover:underline">Réessayer</button>
    </div>
  )

  const showEmptyGlobal = tasks.length === 0 && trashed.length === 0

  return (
    <>
      {showQuickCreate && (
        <QuickCreateModal onClose={() => setShowQuickCreate(false)} onCreated={loadTasks} />
      )}
      {refuseTarget && (
        <RefuseModal task={refuseTarget} onClose={() => setRefuseTarget(null)} onConfirm={handleRefuseConfirm} />
      )}
      {deleteTarget && (
        <DeleteModal task={deleteTarget} onClose={() => setDeleteTarget(null)} onConfirm={handleDeleteConfirm} />
      )}
      {destroyTarget && (
        <DestroyModal task={destroyTarget} onClose={() => setDestroyTarget(null)} onConfirm={handleDestroyConfirm} />
      )}

      <div className="space-y-6 max-w-6xl">
        {/* Header */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">Mes tâches</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {tasks.length} tâche{tasks.length > 1 ? 's' : ''} active{tasks.length > 1 ? 's' : ''}
              {trashed.length > 0 && (
                <> · <span className="text-gray-400">{trashed.length} dans la corbeille</span></>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowQuickCreate(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium"
            >
              <Plus className="w-3.5 h-3.5" /> Nouvelle tâche
            </button>
            <AIEmailImport defaultMode="task" userId={userId} />
            <button
              onClick={() => setShowFilters(f => !f)}
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border transition',
                showFilters || hasFilters
                  ? 'bg-blue-50 text-blue-700 border-blue-200'
                  : 'text-gray-600 border-gray-200 hover:bg-gray-50'
              )}
            >
              <Filter className="w-3.5 h-3.5" /> Filtres
              {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />}
            </button>
            <button onClick={refresh} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition" title="Rafraîchir">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'En attente', value: stats.pending,    color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'En cours',   value: stats.inProgress, color: 'text-blue-600',   bg: 'bg-blue-50' },
            { label: 'En retard',  value: stats.overdue,    color: 'text-red-600',    bg: 'bg-red-50' },
            { label: 'Terminées',  value: stats.done,       color: 'text-green-600',  bg: 'bg-green-50' },
          ].map(s => (
            <div key={s.label} className={cn('rounded-xl p-4 flex items-center gap-3', s.bg)}>
              <div>
                <div className={cn('text-2xl font-bold', s.color)}>{s.value}</div>
                <div className="text-xs text-gray-600 mt-0.5">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 flex flex-wrap gap-3 items-end">
            <div className="flex-1 min-w-[180px]">
              <label className="block text-xs font-medium text-gray-600 mb-1">Projet</label>
              <select
                value={filterProject}
                onChange={e => setFilterProject(e.target.value)}
                className="w-full text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Tous les projets</option>
                {projectOptions.map(p => (
                  <option key={p.id} value={p.id}>{p.code} · {p.title}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Priorité</label>
              <select
                value={filterPriority}
                onChange={e => setFilterPriority(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-300"
              >
                <option value="">Toutes</option>
                {Object.entries(LABELS.task_priority).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            {hasFilters && (
              <button
                onClick={() => { setFilterProject(''); setFilterPriority('') }}
                className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 pb-1.5"
              >
                <X className="w-3 h-3" /> Effacer
              </button>
            )}
          </div>
        )}

        {/* Empty global */}
        {showEmptyGlobal && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-20 text-center">
            <CheckSquare className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-500 font-medium">Aucune tâche assignée</p>
            <p className="text-xs text-gray-400 mt-1">Les tâches qui vous sont assignées apparaîtront ici</p>
          </div>
        )}

        {/* Tabs + content */}
        {!showEmptyGlobal && (
          <>
            <div className="border-b border-gray-200 -mx-1 px-1 overflow-x-auto">
              <div className="flex items-center gap-1 min-w-max">
                {visibleTabs.map(tab => {
                  const isActive = tab.key === activeTab
                  const count = counts[tab.key]
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={cn(
                        'inline-flex items-center gap-2 px-3 sm:px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition whitespace-nowrap',
                        isActive
                          ? tab.accent
                          : 'text-gray-500 border-transparent hover:text-gray-800 hover:border-gray-300'
                      )}
                    >
                      {tab.icon}
                      <span>{tab.label}</span>
                      <span className={cn(
                        'text-[10px] sm:text-xs px-1.5 py-0.5 rounded-full font-semibold',
                        isActive ? 'bg-current/10 text-current' : 'bg-gray-100 text-gray-600',
                      )}>
                        {count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* TRASH TAB */}
            {activeTab === 'trash' ? (
              trashLoading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : filteredTrash.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
                  <Trash2 className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">Corbeille vide</p>
                  <p className="text-xs text-gray-400 mt-1">Les tâches supprimées apparaîtront ici</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {filteredTrash.map(t => (
                    <TrashCard
                      key={t.id}
                      task={t}
                      userId={userId}
                      role={role}
                      onRestore={handleRestore}
                      onDestroy={handleDestroyClick}
                    />
                  ))}
                </div>
              )
            ) : (
              // ACTIVE TABS
              currentTasks.length === 0 ? (
                <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-16 text-center">
                  <Inbox className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-sm text-gray-500 font-medium">Aucune tâche dans cet onglet</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  {currentTasks.map(t => (
                    <TaskCard
                      key={t.id}
                      task={t}
                      userId={userId}
                      role={role}
                      onAccept={handleAccept}
                      onRefuse={handleRefuseClick}
                      onUndoAccept={handleUndoAccept}
                      onUndoRefuse={handleUndoRefuse}
                      onDelete={handleDeleteClick}
                      onStatusChange={handleQuickStatus}
                    />
                  ))}
                </div>
              )
            )}
          </>
        )}
      </div>
    </>
  )
}

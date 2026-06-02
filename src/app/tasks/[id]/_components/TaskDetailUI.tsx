'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter as useNextRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Clock, Check, Eye, Circle, Inbox, Pause, Ban,
  AlertTriangle, CheckCircle2, Send, Trash2, RefreshCw,
  FolderKanban, User, Calendar, Hourglass, ChevronDown, BookMarked,
  Sparkles, ListTodo, FileText, MessageSquareText, KeyRound, ChevronRight,
  Pencil, X,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatDate, taskStatusColor, taskPriorityColor, LABELS, timeAgo } from '@/lib/utils'
import TaskDocumentsPanel from './TaskDocumentsPanel'
import { getLabelMeta } from '@/app/projects/[id]/tasks/new/page'

// ─── Label badge ──────────────────────────────────────────────────────────────
function TaskLabelBadge({ labelId }: { labelId: string }) {
  const meta = getLabelMeta(labelId)
  if (!meta) return null
  const colorMap: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-700 border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border-purple-200',
    orange: 'bg-orange-50 text-orange-700 border-orange-200',
  }
  return (
    <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${colorMap[meta.color] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
      {meta.emoji} {meta.label}
    </span>
  )
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = { id: string; full_name: string; email: string; avatar_url: string | null }
type Project = { id: string; code: string; title: string; status: string; type: string }

type Comment = {
  id: string
  task_id: string
  author_id: string
  content: string
  created_at: string
  updated_at: string
  author?: Profile | null
}

type ActivityLog = {
  id: string
  task_id: string
  user_id: string | null
  action: string
  old_value?: string | null
  new_value?: string | null
  note?: string | null
  created_at: string
  user?: Profile | null
}

type Task = {
  id: string
  project_id: string
  title: string
  description?: string | null
  status: string
  priority: string
  due_date?: string | null
  estimated_hours?: number | null
  actual_hours?: number | null
  pending_acceptance: boolean
  accepted_at?: string | null
  refused_at?: string | null
  refused_reason?: string | null
  refused_by?: string | null
  assigned_by?: string | null
  created_by: string
  created_at: string
  updated_at: string
  assigned_to?: string | null
  assignee?: Profile | null
  assigner?: Profile | null
  creator?: Profile | null
  refuser?: Profile | null
  project?: Project | null
  budget_reference?: { id: string; code: string; designation: string } | null
  comments?: Comment[]
  activity?: ActivityLog[]
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_ICON: Record<string, React.ReactNode> = {
  pending_acceptance: <Inbox className="w-4 h-4 text-purple-500" />,
  todo:               <Circle className="w-4 h-4 text-gray-400" />,
  in_progress:        <Clock className="w-4 h-4 text-blue-500" />,
  review:             <Eye className="w-4 h-4 text-yellow-500" />,
  done:               <Check className="w-4 h-4 text-green-500" />,
  blocked:            <Pause className="w-4 h-4 text-orange-500" />,
  cancelled:          <Ban className="w-4 h-4 text-gray-400" />,
  refused:            <Ban className="w-4 h-4 text-red-400" />,
}

const ACTION_LABEL: Record<string, string> = {
  created:           'Tâche créée',
  assigned:          'Tâche assignée',
  accepted:          'Tâche acceptée',
  refused:           'Tâche refusée',
  status_change:     'Statut modifié',
  comment:           'Commentaire ajouté',
  upload:            'Fichier joint',
  document_uploaded: 'Document joint',
  document_deleted:  'Document supprimé',
}

function isOverdue(task: Task): boolean {
  return !!(task.due_date && new Date(task.due_date) < new Date() && !['done', 'cancelled', 'refused'].includes(task.status))
}

function getInitials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Avatar ───────────────────────────────────────────────────────────────────

function Avatar({ profile, size = 'sm' }: { profile: Profile | null | undefined; size?: 'sm' | 'md' }) {
  if (!profile) return null
  const sizeClass = size === 'md' ? 'w-8 h-8 text-sm' : 'w-6 h-6 text-xs'
  return (
    <div className={cn('rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold shrink-0', sizeClass)}>
      {getInitials(profile.full_name)}
    </div>
  )
}

// ─── Reassign Modal (WF-05) ──────────────────────────────────────────────────

function ReassignModal({
  projectId,
  onClose,
  onConfirm,
}: {
  projectId: string
  onClose:   () => void
  onConfirm: (newAssigneeId: string, note: string) => Promise<void>
}) {
  const [members,     setMembers]     = useState<Profile[]>([])
  const [assigneeId,  setAssigneeId]  = useState('')
  const [note,        setNote]        = useState('')
  const [loading,     setLoading]     = useState(false)
  const [loadingMems, setLoadingMems] = useState(true)

  useEffect(() => {
    fetch(`/api/projects/${projectId}/members`)
      .then(r => r.ok ? r.json() : [])
      .then((data: any[]) => {
        const profiles = data.map((m: any) => m.profile).filter(Boolean) as Profile[]
        setMembers(profiles)
        setLoadingMems(false)
      })
      .catch(() => setLoadingMems(false))
  }, [projectId])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-blue-500" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Réassigner la tâche</h3>
            <p className="text-xs text-gray-500">La tâche sera envoyée au nouvel assigné pour acceptation</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Nouvel assigné <span className="text-red-500">*</span></label>
          <select
            value={assigneeId}
            onChange={e => setAssigneeId(e.target.value)}
            disabled={loadingMems}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          >
            <option value="">{loadingMems ? 'Chargement…' : '— Sélectionner —'}</option>
            {members.map(m => (
              <option key={m.id} value={m.id}>{m.full_name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Note <span className="text-gray-400">(optionnel)</span></label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Ex : Merci de traiter en priorité…"
            rows={2}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
            Annuler
          </button>
          <button
            onClick={async () => { setLoading(true); await onConfirm(assigneeId, note); setLoading(false) }}
            disabled={loading || !assigneeId}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            {loading ? 'Réassignation…' : 'Réassigner'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Refuse Modal ─────────────────────────────────────────────────────────────

function RefuseModal({
  onClose,
  onConfirm,
}: {
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
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Refuser la tâche</h3>
            <p className="text-xs text-gray-500">Vous pouvez expliquer la raison</p>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">
            Raison <span className="text-gray-400">(optionnel)</span>
          </label>
          <textarea
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder="Ex : Pas disponible, hors de mes compétences…"
            rows={3}
            autoFocus
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-red-300"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Annuler</button>
          <button
            onClick={async () => { setLoading(true); await onConfirm(reason); setLoading(false) }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-50"
          >
            {loading ? 'Refus…' : 'Confirmer le refus'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Status Picker ────────────────────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  todo:        ['in_progress', 'review', 'done', 'blocked', 'cancelled'],
  in_progress: ['review', 'blocked', 'done', 'cancelled'],
  review:      ['done', 'in_progress', 'cancelled'],
  blocked:     ['in_progress', 'cancelled'],
  done:        ['review', 'in_progress', 'todo'],
  cancelled:   [],
  refused:     [],
  pending_acceptance: [],
}

function StatusPicker({ task, onStatusChange }: { task: Task; onStatusChange: (s: string) => Promise<void> }) {
  const [open, setOpen] = useState(false)
  const options = ALLOWED_TRANSITIONS[task.status] ?? []
  if (options.length === 0) return null

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
      >
        Changer le statut <ChevronDown className="w-3.5 h-3.5" />
      </button>
      {open && (
        <div className="absolute top-full mt-1 left-0 bg-white rounded-xl shadow-lg border border-gray-100 z-20 min-w-[200px] overflow-hidden">
          {options.map(s => (
            <button
              key={s}
              onClick={async () => { setOpen(false); await onStatusChange(s) }}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition text-left"
            >
              {STATUS_ICON[s]}
              {LABELS.task_status[s as keyof typeof LABELS.task_status] ?? s}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Comment Item ─────────────────────────────────────────────────────────────

function CommentItem({
  comment,
  userId,
  onDelete,
}: {
  comment: Comment
  userId: string
  onDelete: (id: string) => void
}) {
  const isOwn = comment.author_id === userId

  return (
    <div className="flex gap-3 group">
      <Avatar profile={comment.author} size="md" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline gap-2">
          <span className="text-xs font-semibold text-gray-800">
            {comment.author?.full_name ?? 'Utilisateur'}
          </span>
          <span className="text-[10px] text-gray-400">{timeAgo(comment.created_at)}</span>
        </div>
        <div className="mt-1 text-sm text-gray-700 bg-gray-50 rounded-xl px-3 py-2 leading-relaxed">
          {comment.content}
        </div>
      </div>
      {isOwn && (
        <button
          onClick={() => onDelete(comment.id)}
          className="opacity-0 group-hover:opacity-100 p-1 text-gray-300 hover:text-red-500 transition self-start mt-1"
          title="Supprimer"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}

// ─── Activity Item ────────────────────────────────────────────────────────────

function ActivityItem({ log }: { log: ActivityLog }) {
  const label = ACTION_LABEL[log.action] ?? log.action

  return (
    <div className="flex gap-3 text-xs text-gray-500">
      <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
        {log.user ? (
          <span className="font-bold text-[9px] text-gray-600">{getInitials(log.user.full_name)}</span>
        ) : (
          <User className="w-3 h-3 text-gray-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <span className="font-medium text-gray-700">{log.user?.full_name ?? 'Système'}</span>
        {' '}{label.toLowerCase()}
        {log.action === 'status_change' && log.old_value && log.new_value && (
          <span>
            {' '}({LABELS.task_status[log.old_value as keyof typeof LABELS.task_status] ?? log.old_value} → {LABELS.task_status[log.new_value as keyof typeof LABELS.task_status] ?? log.new_value})
          </span>
        )}
        {log.note && log.action !== 'status_change' && (
          <span className="text-gray-400"> — {log.note.slice(0, 80)}</span>
        )}
        <span className="ml-2 text-gray-400">{timeAgo(log.created_at)}</span>
      </div>
    </div>
  )
}

// ─── Edit Modal ──────────────────────────────────────────────────────────────

function EditTaskModal({
  task,
  projectMembers,
  onClose,
  onSave,
}: {
  task: Task
  projectMembers: Profile[]
  onClose: () => void
  onSave: (updates: Partial<Task>) => Promise<void>
}) {
  const [assignedTo,      setAssignedTo]      = useState(task.assigned_to ?? '')
  const [priority,        setPriority]        = useState(task.priority)
  const [dueDate,         setDueDate]         = useState(task.due_date ? task.due_date.slice(0, 10) : '')
  const [estimatedHours,  setEstimatedHours]  = useState(task.estimated_hours?.toString() ?? '')
  const [saving,          setSaving]          = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    await onSave({
      assigned_to:     assignedTo || null,
      priority,
      due_date:        dueDate || null,
      estimated_hours: estimatedHours ? parseFloat(estimatedHours) : null,
    } as Partial<Task>)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Modifier la tâche</h3>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Assigné à */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">Assigné à</label>
            <select
              value={assignedTo}
              onChange={e => setAssignedTo(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">— Non assigné —</option>
              {projectMembers.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          {/* Priorité */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">Priorité</label>
            <select
              value={priority}
              onChange={e => setPriority(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="low">Faible</option>
              <option value="medium">Moyen</option>
              <option value="high">Élevé</option>
              <option value="critical">Critique</option>
            </select>
          </div>

          {/* Échéance */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">Échéance</label>
            <input
              type="date"
              value={dueDate}
              onChange={e => setDueDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Heures estimées */}
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">Heures estimées</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={estimatedHours}
              onChange={e => setEstimatedHours(e.target.value)}
              placeholder="Ex: 8"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
              {saving ? 'Enregistrement…' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function TaskDetailUI({
  taskId,
  userId,
  role,
}: {
  taskId: string
  userId: string
  role: string
}) {
  const navRouter = useNextRouter()
  const [task, setTask] = useState<Task | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [showRefuseModal,   setShowRefuseModal]   = useState(false)
  const [showReassignModal, setShowReassignModal] = useState(false)
  const [showEditModal,   setShowEditModal]   = useState(false)
  const [projectMembers,  setProjectMembers]  = useState<Profile[]>([])
  const [accepting, setAccepting] = useState(false)
  const [comment, setComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const commentsEndRef = useRef<HTMLDivElement>(null)

  // ── AI state ──
  const [aiDescLoading,    setAiDescLoading]    = useState(false)
  const [aiDescResult,     setAiDescResult]      = useState<string | null>(null)
  const [aiStepsLoading,   setAiStepsLoading]   = useState(false)
  const [aiSteps,          setAiSteps]          = useState<string[] | null>(null)
  const [aiChecked,        setAiChecked]        = useState<boolean[]>([])
  const [aiSummaryLoading, setAiSummaryLoading] = useState(false)
  const [aiSummary,        setAiSummary]        = useState<string | null>(null)
  const [aiCommentLoading, setAiCommentLoading] = useState(false)
  const [aiNoKey,          setAiNoKey]          = useState(false)
  const [aiApiError,       setAiApiError]       = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const res = await fetch(`/api/tasks/${taskId}`)
      const body = await res.json()
      if (res.ok) {
        setTask(body)
      } else {
        setLoadError(body?.error ?? `HTTP ${res.status}`)
      }
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Erreur réseau')
    }
    setLoading(false)
  }, [taskId])

  useEffect(() => { load() }, [load])

  const isAssignee   = task?.assignee?.id === userId || task?.assigned_to === userId
  // Also check via task fields directly since assignee might be a sub-object
  const isCreator    = task?.created_by === userId
  const isPrivileged = ['admin', 'directeur', 'chef_projet'].includes(role)
  const canAct       = isAssignee || isCreator || isPrivileged
  const overdue      = task ? isOverdue(task) : false

  // ── Reassign (WF-05) ──
  async function handleReassign(newAssigneeId: string, note: string) {
    if (!task || !newAssigneeId) return
    const res  = await fetch(`/api/tasks/${task.id}/reassign`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ new_assignee_id: newAssigneeId, note: note || null }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Erreur lors de la réassignation'); return }
    toast.success('Tâche réassignée — en attente d\'acceptation')
    setShowReassignModal(false)
    load()
  }

  // ── Accept ──
  async function handleAccept() {
    if (!task) return
    setAccepting(true)
    const res = await fetch(`/api/tasks/${task.id}/accept`, { method: 'POST' })
    const json = await res.json()
    setAccepting(false)
    if (!res.ok) { toast.error(json.error ?? 'Erreur'); return }
    toast.success('Tâche acceptée !')
    load()
  }

  // ── Refuse ──
  async function handleRefuse(reason: string) {
    if (!task) return
    const res = await fetch(`/api/tasks/${task.id}/refuse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason || null }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Erreur'); return }
    toast.success('Tâche refusée')
    setShowRefuseModal(false)
    load()
  }

  // ── Status ──
  async function handleStatusChange(status: string) {
    if (!task) return
    const res = await fetch(`/api/tasks/${task.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Erreur'); return }
    toast.success('Statut mis à jour')
    load()
  }

  // ── Comment ──
  async function handleComment(e: React.FormEvent) {
    e.preventDefault()
    if (!comment.trim() || !task) return
    setSubmittingComment(true)
    const res = await fetch(`/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: comment.trim() }),
    })
    const json = await res.json()
    setSubmittingComment(false)
    if (!res.ok) { toast.error(json.error ?? 'Erreur'); return }
    setComment('')
    load()
    setTimeout(() => commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 200)
  }

  // ── Delete comment ──
  async function handleDeleteComment(commentId: string) {
    if (!task) return
    const res = await fetch(`/api/tasks/${task.id}/comments`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comment_id: commentId }),
    })
    if (!res.ok) { toast.error('Impossible de supprimer'); return }
    toast.success('Commentaire supprimé')
    load()
  }

  // ── Edit ──
  async function openEditModal() {
    if (!task) return
    // Charge les membres du projet pour la liste d'assignation
    if (projectMembers.length === 0) {
      try {
        const res = await fetch(`/api/projects/${task.project_id}/members`)
        if (res.ok) {
          const members = await res.json()
          const profiles = members.map((m: { profile: Profile }) => m.profile).filter(Boolean)
          setProjectMembers(profiles)
        }
      } catch { /* swallow */ }
    }
    setShowEditModal(true)
  }

  async function handleSaveEdit(updates: Partial<Task>) {
    if (!task) return
    const res = await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const json = await res.json()
    if (!res.ok) { toast.error(json.error ?? 'Erreur'); return }
    toast.success('Tâche mise à jour')
    setShowEditModal(false)
    load()
  }

  // ── AI handlers ──
  async function aiGenerateDescription() {
    if (!task) return
    setAiDescLoading(true)
    setAiDescResult(null)
    const res = await fetch('/api/ai/task-description', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: task.title, description: task.description, project: task.project, assignee: task.assignee?.full_name }),
    })
    const json = await res.json()
    setAiDescLoading(false)
    if (json.noKey) { setAiNoKey(true); setAiApiError(false) }
    else if (json.apiError) { setAiApiError(true); setAiNoKey(false) }
    setAiDescResult(json.description ?? null)
  }

  async function aiGenerateSteps() {
    if (!task) return
    setAiStepsLoading(true)
    setAiSteps(null)
    const res = await fetch('/api/ai/task-steps', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: task.title, description: task.description, project: task.project }),
    })
    const json = await res.json()
    setAiStepsLoading(false)
    if (json.noKey) { setAiNoKey(true); setAiApiError(false) }
    else if (json.apiError) { setAiApiError(true); setAiNoKey(false) }
    if (json.steps) { setAiSteps(json.steps); setAiChecked(json.steps.map(() => false)) }
  }

  async function aiSummarizeDiscussion() {
    if (!task) return
    setAiSummaryLoading(true)
    setAiSummary(null)
    const res = await fetch('/api/ai/task-discussion-summary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: task.title, comments: task.comments ?? [] }),
    })
    const json = await res.json()
    setAiSummaryLoading(false)
    if (json.noKey) { setAiNoKey(true); setAiApiError(false) }
    else if (json.apiError) { setAiApiError(true); setAiNoKey(false) }
    setAiSummary(json.summary ?? null)
  }

  async function aiImproveComment(action: 'improve' | 'generate_update') {
    if (!task) return
    setAiCommentLoading(true)
    const res = await fetch('/api/ai/task-comment-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft: comment, task, action }),
    })
    const json = await res.json()
    setAiCommentLoading(false)
    if (json.noKey || json.error === 'NO_KEY') { setAiNoKey(true); setAiApiError(false); return }
    if (json.apiError) { setAiApiError(true); setAiNoKey(false); return }
    if (json.comment) setComment(json.comment)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (loadError || !task) return (
    <div className="max-w-xl space-y-3">
      <button onClick={() => navRouter.back()} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800">
        <ArrowLeft className="w-4 h-4" /> Retour
      </button>
      <div className="bg-white rounded-xl border border-red-100 shadow-sm p-8 space-y-2">
        <p className="text-sm font-semibold text-red-600">{loadError ?? 'Tâche introuvable'}</p>
        <button onClick={load} className="text-sm text-blue-600 hover:underline">Réessayer</button>
      </div>
    </div>
  )

  const comments  = task.comments ?? []
  const activity  = task.activity ?? []

  return (
    <>
      {showRefuseModal && (
        <RefuseModal onClose={() => setShowRefuseModal(false)} onConfirm={handleRefuse} />
      )}
      {showReassignModal && task?.project && (
        <ReassignModal
          projectId={task.project.id}
          onClose={() => setShowReassignModal(false)}
          onConfirm={handleReassign}
        />
      )}

      {showEditModal && task && (
        <EditTaskModal
          task={task}
          projectMembers={projectMembers}
          onClose={() => setShowEditModal(false)}
          onSave={handleSaveEdit}
        />
      )}

      <div className="flex gap-5 items-start max-w-5xl">
        {/* ── Colonne principale ── */}
        <div className="flex-1 min-w-0 space-y-6">

        {/* Back */}
        <div className="flex items-center justify-between">
          <button onClick={() => navRouter.back()} className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition">
            <ArrowLeft className="w-4 h-4" /> Retour
          </button>
          <div className="flex items-center gap-2">
            {canAct && (
              <button
                onClick={openEditModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              >
                <Pencil className="w-3.5 h-3.5" /> Modifier
              </button>
            )}
            <button onClick={load} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition">
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Main card */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 pt-6 pb-4 border-b border-gray-50">
            <div className="flex items-start gap-3">
              <div className="mt-1">{STATUS_ICON[task.status] ?? <Circle className="w-4 h-4 text-gray-300" />}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  {task.ref_number && (
                    <span className="text-[11px] font-mono text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                      {task.ref_number}
                    </span>
                  )}
                  {task.is_draft && (
                    <span className="text-[11px] font-semibold px-2 py-0.5 bg-amber-100 text-amber-700 rounded-full">
                      ✏️ Brouillon — à compléter
                    </span>
                  )}
                </div>
                <h1 className={cn(
                  'text-xl font-bold text-gray-900 leading-snug',
                  task.status === 'done' && 'line-through text-gray-400'
                )}>
                  {task.title}
                </h1>
                {task.project && (
                  <Link href={`/projects/${task.project.id}`} className="inline-flex items-center gap-1.5 text-sm text-blue-500 hover:underline mt-1">
                    <FolderKanban className="w-3.5 h-3.5" />
                    {task.project.code} · {task.project.title}
                  </Link>
                )}
              </div>
            </div>

            {/* Badges */}
            <div className="flex flex-wrap items-center gap-2 mt-3">
              <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', taskStatusColor(task.status))}>
                {LABELS.task_status[task.status as keyof typeof LABELS.task_status] ?? task.status}
              </span>
              <span className={cn('text-xs px-2.5 py-1 rounded-full font-medium', taskPriorityColor(task.priority))}>
                {LABELS.task_priority[task.priority as keyof typeof LABELS.task_priority] ?? task.priority}
              </span>
              {overdue && (
                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-700">
                  <AlertTriangle className="w-3 h-3" /> En retard
                </span>
              )}
              {task.label && <TaskLabelBadge labelId={task.label as string} />}
            </div>
          </div>

          {/* Accept/Refuse banner */}
          {task.pending_acceptance && task.status === 'pending_acceptance' && isAssignee && (
            <div className="px-6 py-4 bg-purple-50 border-b border-purple-100 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-purple-800">
                <Inbox className="w-4 h-4 text-purple-500 shrink-0" />
                <span>
                  <strong>{task.assigner?.full_name ?? 'Quelqu\'un'}</strong> vous a assigné cette tâche. Acceptez-vous de la prendre en charge ?
                </span>
              </div>
              <div className="flex gap-2 shrink-0">
                <button
                  onClick={handleAccept}
                  disabled={accepting}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  {accepting ? 'Acceptation…' : 'Accepter'}
                </button>
                <button
                  onClick={() => setShowRefuseModal(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 border border-red-300 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition"
                >
                  <Ban className="w-4 h-4" /> Refuser
                </button>
              </div>
            </div>
          )}

          {/* Refused banner + bouton Réassigner (WF-05) */}
          {task.status === 'refused' && (
            <div className="px-6 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between gap-4 flex-wrap">
              <div className="text-sm text-red-700">
                {task.refused_reason
                  ? <><span className="font-semibold">Raison du refus : </span>{task.refused_reason}</>
                  : <span className="font-semibold">Tâche refusée par l&apos;assigné</span>
                }
              </div>
              {(isCreator || isPrivileged) && (
                <button
                  onClick={() => setShowReassignModal(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white border border-red-200 text-red-700 rounded-lg hover:bg-red-100 transition shrink-0"
                >
                  <RefreshCw className="w-3.5 h-3.5" /> Réassigner
                </button>
              )}
            </div>
          )}

          {/* Body */}
          <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Description */}
            <div className="md:col-span-2 space-y-4">
              {task.description ? (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</p>
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{task.description}</p>
                </div>
              ) : (
                <p className="text-sm text-gray-400 italic">Aucune description</p>
              )}

              {/* Status actions */}
              {canAct && task.status !== 'pending_acceptance' && (
                <div>
                  <StatusPicker task={task} onStatusChange={handleStatusChange} />
                </div>
              )}
            </div>

            {/* Meta sidebar */}
            <div className="space-y-4 text-sm">
              {[
                {
                  label: 'Assigné à',
                  icon: <User className="w-3.5 h-3.5 text-gray-400" />,
                  value: task.assignee ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar profile={task.assignee} size="sm" />
                      <span>{task.assignee.full_name}</span>
                    </div>
                  ) : <span className="text-gray-400">—</span>,
                },
                {
                  label: 'Assigné par',
                  icon: <User className="w-3.5 h-3.5 text-gray-400" />,
                  value: task.assigner ? (
                    <div className="flex items-center gap-1.5">
                      <Avatar profile={task.assigner} size="sm" />
                      <span>{task.assigner.full_name}</span>
                    </div>
                  ) : <span className="text-gray-400">—</span>,
                },
                {
                  label: 'Créé par',
                  icon: <User className="w-3.5 h-3.5 text-gray-400" />,
                  value: task.creator?.full_name ?? <span className="text-gray-400">—</span>,
                },
                {
                  label: 'Échéance',
                  icon: <Calendar className="w-3.5 h-3.5 text-gray-400" />,
                  value: task.due_date
                    ? <span className={cn(overdue ? 'text-red-600 font-semibold' : '')}>{formatDate(task.due_date)}</span>
                    : <span className="text-gray-400">—</span>,
                },
                {
                  label: 'Heures estimées',
                  icon: <Hourglass className="w-3.5 h-3.5 text-gray-400" />,
                  value: task.estimated_hours ? `${task.estimated_hours}h` : <span className="text-gray-400">—</span>,
                },
                {
                  label: 'Heures réelles',
                  icon: <Clock className="w-3.5 h-3.5 text-gray-400" />,
                  value: task.actual_hours ? `${task.actual_hours}h` : <span className="text-gray-400">—</span>,
                },
                {
                  label: 'Créée',
                  icon: <Calendar className="w-3.5 h-3.5 text-gray-400" />,
                  value: timeAgo(task.created_at),
                },
                {
                  label: 'Acceptée',
                  icon: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
                  value: task.accepted_at ? formatDate(task.accepted_at) : null,
                },
                {
                  label: 'Réf. budgétaire',
                  icon: <BookMarked className="w-3.5 h-3.5 text-indigo-400" />,
                  value: task.budget_reference
                    ? (
                      <span className="inline-flex items-center gap-1.5">
                        <span className="font-mono text-[11px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded">
                          {task.budget_reference.code}
                        </span>
                        <span className="text-gray-600 text-xs">{task.budget_reference.designation}</span>
                      </span>
                    )
                    : null,
                },
              ]
                .filter(m => m.value !== null)
                .map(meta => (
                  <div key={meta.label}>
                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium mb-0.5">
                      {meta.icon} {meta.label}
                    </div>
                    <div className="text-sm text-gray-800">{meta.value}</div>
                  </div>
                ))
              }
            </div>
          </div>
        </div>

        {/* Comments */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-gray-50">
            <h2 className="text-sm font-semibold text-gray-700">Commentaires ({comments.length})</h2>
          </div>

          <div className="px-5 py-4 space-y-4">
            {comments.length === 0 ? (
              <p className="text-sm text-gray-400 py-2">Aucun commentaire pour l&apos;instant</p>
            ) : (
              comments.map(c => (
                <CommentItem key={c.id} comment={c} userId={userId} onDelete={handleDeleteComment} />
              ))
            )}
            <div ref={commentsEndRef} />
          </div>

          {/* Comment form */}
          <div className="px-5 pb-5">
            <form onSubmit={handleComment} className="flex gap-2">
              <input
                value={comment}
                onChange={e => setComment(e.target.value)}
                placeholder="Ajouter un commentaire…"
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-300"
                maxLength={5000}
              />
              <button
                type="submit"
                disabled={!comment.trim() || submittingComment}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-40"
              >
                <Send className="w-3.5 h-3.5" />
                {submittingComment ? '…' : 'Envoyer'}
              </button>
            </form>
          </div>
        </div>

        {/* Documents */}
        <TaskDocumentsPanel
          taskId={task.id}
          projectId={task.project_id}
          userId={userId}
          role={role}
          taskStatus={task.status}
          assignedTo={task.assignee?.id ?? task.assigned_to ?? null}
          createdBy={task.created_by}
        />

        {/* Activity Timeline */}
        {activity.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-50">
              <h2 className="text-sm font-semibold text-gray-700">Historique</h2>
            </div>
            <div className="px-5 py-4 space-y-3">
              {activity.map(log => <ActivityItem key={log.id} log={log} />)}
            </div>
          </div>
        )}

        </div>{/* fin colonne principale */}

        {/* ── Bloc IA — colonne droite ── */}
        <div className="w-64 shrink-0 sticky top-6">
          <div className="bg-white rounded-2xl border border-violet-100 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-violet-50 flex items-center gap-2 bg-gradient-to-r from-violet-50 to-white">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center shrink-0">
                <Sparkles className="w-3.5 h-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-gray-800">Assistant IA</span>
            </div>

            <div className="p-3 space-y-2.5">
              {/* Description */}
              <div>
                <button
                  type="button"
                  onClick={aiGenerateDescription}
                  disabled={aiDescLoading}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-50 border border-violet-100 text-xs text-gray-700 hover:border-violet-300 hover:bg-violet-100 transition disabled:opacity-50 text-left"
                >
                  <FileText className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <span className="flex-1">
                    {aiDescLoading
                      ? <span className="flex items-center gap-1 text-violet-600"><RefreshCw className="w-3 h-3 animate-spin" /> Génération…</span>
                      : 'Générer une description'
                    }
                  </span>
                </button>
                {aiDescResult && (
                  <div className="mt-1.5 text-[11px] text-gray-600 leading-relaxed bg-gray-50 rounded-xl border border-gray-100 p-2.5">
                    {aiDescResult}
                  </div>
                )}
              </div>

              {/* Sous-étapes */}
              <div>
                <button
                  type="button"
                  onClick={aiGenerateSteps}
                  disabled={aiStepsLoading}
                  className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-50 border border-violet-100 text-xs text-gray-700 hover:border-violet-300 hover:bg-violet-100 transition disabled:opacity-50 text-left"
                >
                  <ListTodo className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <span className="flex-1">
                    {aiStepsLoading
                      ? <span className="flex items-center gap-1 text-violet-600"><RefreshCw className="w-3 h-3 animate-spin" /> Décomposition…</span>
                      : 'Décomposer en étapes'
                    }
                  </span>
                </button>
                {aiSteps && (
                  <div className="mt-1.5 space-y-1">
                    {aiSteps.map((step, i) => (
                      <label key={i} className={cn(
                        'flex items-start gap-2 px-2.5 py-1.5 rounded-lg border cursor-pointer transition',
                        aiChecked[i] ? 'border-green-200 bg-green-50' : 'border-gray-100 bg-gray-50 hover:border-violet-200'
                      )}>
                        <input
                          type="checkbox"
                          checked={aiChecked[i] ?? false}
                          onChange={() => setAiChecked(c => c.map((v, j) => j === i ? !v : v))}
                          className="mt-0.5 accent-violet-600 shrink-0"
                        />
                        <span className={cn('text-[11px] leading-relaxed', aiChecked[i] ? 'line-through text-gray-400' : 'text-gray-700')}>
                          {step}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              {/* Résumé discussions */}
              {(task.comments?.length ?? 0) >= 2 && (
                <div>
                  <button
                    type="button"
                    onClick={aiSummarizeDiscussion}
                    disabled={aiSummaryLoading}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl bg-violet-50 border border-violet-100 text-xs text-gray-700 hover:border-violet-300 hover:bg-violet-100 transition disabled:opacity-50 text-left"
                  >
                    <MessageSquareText className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                    <span className="flex-1">
                      {aiSummaryLoading
                        ? <span className="flex items-center gap-1 text-violet-600"><RefreshCw className="w-3 h-3 animate-spin" /> Résumé…</span>
                        : 'Résumer les discussions'
                      }
                    </span>
                  </button>
                  {aiSummary && (
                    <div className="mt-1.5 text-[11px] text-gray-600 leading-relaxed bg-gray-50 rounded-xl border border-gray-100 p-2.5">
                      {aiSummary}
                    </div>
                  )}
                </div>
              )}

              {/* Séparateur — assistant commentaire */}
              <div className="border-t border-gray-100 pt-2.5">
                <p className="text-[10px] text-gray-400 font-medium uppercase tracking-wide mb-1.5">Commentaire</p>
                <div className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => aiImproveComment('improve')}
                    disabled={aiCommentLoading || !comment.trim()}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-50 border border-violet-100 text-xs text-gray-700 hover:border-violet-300 hover:bg-violet-100 transition disabled:opacity-40 text-left"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    {aiCommentLoading ? <span className="flex items-center gap-1 text-violet-600"><RefreshCw className="w-3 h-3 animate-spin" /> …</span> : 'Améliorer mon brouillon'}
                  </button>
                  <button
                    type="button"
                    onClick={() => aiImproveComment('generate_update')}
                    disabled={aiCommentLoading}
                    className="w-full flex items-center gap-2 px-3 py-2 rounded-xl bg-violet-50 border border-violet-100 text-xs text-gray-700 hover:border-violet-300 hover:bg-violet-100 transition disabled:opacity-40 text-left"
                  >
                    <MessageSquareText className="w-3.5 h-3.5 text-violet-400 shrink-0" />
                    {aiCommentLoading ? <span className="flex items-center gap-1 text-violet-600"><RefreshCw className="w-3 h-3 animate-spin" /> …</span> : 'Générer une mise à jour'}
                  </button>
                </div>
              </div>

              {/* Bandeau clé manquante */}
              {aiNoKey && (
                <div className="flex items-start gap-1.5 px-2.5 py-2 bg-amber-50 rounded-xl border border-amber-100">
                  <KeyRound className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-amber-700 leading-tight">
                    Mode règles.{' '}
                    <Link href="/profile" className="underline font-medium hover:text-amber-900">Configurer ma clé IA</Link>
                  </p>
                </div>
              )}
              {aiApiError && (
                <div className="flex items-start gap-1.5 px-2.5 py-2 bg-red-50 rounded-xl border border-red-100">
                  <KeyRound className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-red-700 leading-tight">
                    Erreur API — vérifiez votre clé.{' '}
                    <Link href="/profile" className="underline font-medium hover:text-red-900">Paramètres IA</Link>
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>{/* fin flex layout */}
    </>
  )
}

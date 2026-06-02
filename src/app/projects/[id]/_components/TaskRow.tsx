'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { formatDate, taskPriorityColor, LABELS } from '@/lib/utils'
import { CheckCircle2, Circle, Loader2, ExternalLink } from 'lucide-react'
import { toast } from 'sonner'
import { getLabelMeta } from '@/app/projects/[id]/tasks/new/page'

function LabelBadge({ labelId }: { labelId: string }) {
  const meta = getLabelMeta(labelId)
  if (!meta) return null
  const colorMap: Record<string, string> = {
    blue:   'bg-blue-50 text-blue-700',
    purple: 'bg-purple-50 text-purple-700',
    orange: 'bg-orange-50 text-orange-700',
  }
  return (
    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${colorMap[meta.color] ?? 'bg-gray-100 text-gray-600'}`}>
      {meta.emoji} {meta.label}
    </span>
  )
}

export default function TaskRow({ task, projectId, canEdit }: {
  task: any
  projectId: string
  canEdit: boolean
}) {
  const router = useRouter()
  const [status, setStatus] = useState(task.status)
  const [updating, setUpdating] = useState(false)
  const isOverdue = task.due_date && new Date(task.due_date) < new Date() && status !== 'done'
  const isDone = status === 'done'

  async function toggleDone(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (!canEdit || updating) return
    const next = isDone ? 'todo' : 'done'
    setUpdating(true)
    const res = await fetch(`/api/tasks/${task.id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      toast.error(data.error ?? 'Erreur lors de la mise à jour')
      setUpdating(false)
      return
    }
    setStatus(next)
    setUpdating(false)
    router.refresh()
  }

  return (
    <Link
      href={`/tasks/${task.id}`}
      className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition group"
    >
      {/* Icône cocher/décocher */}
      <button
        onClick={toggleDone}
        disabled={!canEdit || updating}
        className={`flex-shrink-0 transition-transform ${canEdit ? 'hover:scale-110' : 'cursor-default'}`}
        title={canEdit ? (isDone ? 'Rouvrir la tâche' : 'Marquer comme terminée') : undefined}
      >
        {updating ? (
          <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />
        ) : isDone ? (
          <CheckCircle2 className="w-4 h-4 text-green-500" />
        ) : (
          <Circle className={`w-4 h-4 transition ${canEdit ? 'text-gray-300 group-hover:text-blue-400' : 'text-gray-300'}`} />
        )}
      </button>

      {/* Titre + assigné + badges */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          {task.ref_number && (
            <span className="text-[10px] font-mono text-gray-400 flex-shrink-0">{task.ref_number}</span>
          )}
          <p className={`text-sm truncate transition ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
            {task.title}
          </p>
          {task.is_draft && (
            <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded flex-shrink-0">
              Brouillon
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {(task.assignee as any)?.full_name && (
            <p className="text-xs text-gray-400">{(task.assignee as any).full_name}</p>
          )}
          {task.label && <LabelBadge labelId={task.label as string} />}
        </div>
      </div>

      {/* Priorité */}
      <span className={`text-xs px-2 py-0.5 rounded-full hidden sm:inline flex-shrink-0 ${taskPriorityColor(task.priority)}`}>
        {LABELS.task_priority[task.priority as keyof typeof LABELS.task_priority]}
      </span>

      {/* Date d'échéance */}
      {task.due_date && (
        <span className={`text-xs flex-shrink-0 hidden md:block ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
          {isOverdue ? '⚠ ' : ''}{formatDate(task.due_date)}
        </span>
      )}

      {/* Flèche détail */}
      <ExternalLink className="w-3.5 h-3.5 text-gray-300 opacity-0 group-hover:opacity-100 transition flex-shrink-0" />
    </Link>
  )
}

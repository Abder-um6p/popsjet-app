'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckSquare, Clock, ArrowRight, ChevronDown } from 'lucide-react'
import { formatDate, taskPriorityColor, LABELS } from '@/lib/utils'

interface Task {
  id: string
  title: string
  status: string
  priority: string
  due_date?: string | null
  project_id: string
}

const INITIAL_VISIBLE = 10

export default function DashboardTasksWidget({ tasks }: { tasks: Task[] }) {
  const [showAll, setShowAll] = useState(false)
  const now = new Date()

  const visible = showAll ? tasks : tasks.slice(0, INITIAL_VISIBLE)
  const hidden  = tasks.length - INITIAL_VISIBLE

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <h2 className="text-base font-semibold text-gray-800">
          Mes tâches
          {tasks.length > 0 && (
            <span className="ml-2 text-xs font-normal text-gray-400">({tasks.length})</span>
          )}
        </h2>
        <Link href="/tasks" className="text-xs text-blue-600 hover:underline flex items-center gap-1">
          Voir tout <ArrowRight className="w-3 h-3" />
        </Link>
      </div>

      {tasks.length === 0 ? (
        <div className="py-12 text-center">
          <CheckSquare className="w-8 h-8 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">Aucune tâche assignée</p>
        </div>
      ) : (
        <>
          <div className="divide-y divide-gray-50">
            {visible.map(task => {
              const isOverdue = task.due_date && new Date(task.due_date) < now
              return (
                <Link key={task.id} href={`/tasks/${task.id}`}
                  className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50 transition-colors">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${taskPriorityColor(task.priority)}`}>
                    {LABELS.task_priority[task.priority as keyof typeof LABELS.task_priority] ?? task.priority}
                  </span>
                  <span className="text-sm text-gray-700 flex-1 truncate">{task.title}</span>
                  {task.due_date && (
                    <span className={`text-xs shrink-0 font-medium flex items-center gap-1 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}>
                      <Clock className="w-3 h-3" />
                      {isOverdue ? 'En retard' : formatDate(task.due_date)}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>

          {/* Bouton Voir plus — UX-07 */}
          {!showAll && hidden > 0 && (
            <button
              onClick={() => setShowAll(true)}
              className="w-full flex items-center justify-center gap-1.5 py-3 text-xs text-blue-600 hover:text-blue-700 hover:bg-blue-50 transition border-t border-gray-50 font-medium"
            >
              <ChevronDown className="w-3.5 h-3.5" />
              Voir {hidden} tâche{hidden > 1 ? 's' : ''} de plus
            </button>
          )}
        </>
      )}
    </div>
  )
}

import Link from 'next/link'
import { FolderKanban, ArrowRight, Calendar, CheckCircle2 } from 'lucide-react'
import { formatDate } from '@/lib/utils'
import ProgramActions from './ProgramActions'

interface ProgramCardProps {
  program: {
    id: string
    code: string
    name: string
    description?: string | null
    is_active: boolean
    start_date?: string | null
    end_date?: string | null
    projectCount: number
    activeCount: number
    completedCount: number
    avgCompletion: number
  }
  canDelete?: boolean
}

export default function ProgramCard({ program, canDelete }: ProgramCardProps) {
  return (
    <div className="group relative bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all duration-200">
      <Link
        href={`/programs/${program.id}`}
        className="flex flex-col gap-4 p-5"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${program.is_active ? 'bg-blue-50' : 'bg-gray-50'}`}>
              <FolderKanban className={`w-5 h-5 ${program.is_active ? 'text-blue-600' : 'text-gray-400'}`} />
            </div>
            <div className="min-w-0">
              <p className="font-mono text-[10px] text-gray-400 uppercase tracking-wider">{program.code}</p>
              <h3 className="text-sm font-semibold text-gray-900 truncate group-hover:text-blue-700 transition-colors">
                {program.name}
              </h3>
            </div>
          </div>
          <span className={`shrink-0 text-xs font-medium px-2.5 py-1 rounded-full ${program.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {program.is_active ? 'Actif' : 'Inactif'}
          </span>
        </div>

        {/* Description */}
        {program.description && (
          <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">{program.description}</p>
        )}

        {/* Progress */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-gray-500">Avancement moyen</span>
            <span className="text-xs font-semibold text-gray-700">{program.avgCompletion}%</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all"
              style={{ width: `${program.avgCompletion}%` }}
            />
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <FolderKanban className="w-3.5 h-3.5" />
            {program.projectCount} projet{program.projectCount !== 1 ? 's' : ''}
          </span>
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle2 className="w-3.5 h-3.5" />
            {program.completedCount} terminé{program.completedCount !== 1 ? 's' : ''}
          </span>
          {(program.start_date || program.end_date) && (
            <span className="flex items-center gap-1 ml-auto">
              <Calendar className="w-3.5 h-3.5" />
              {formatDate(program.start_date)} → {formatDate(program.end_date)}
            </span>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center text-xs text-blue-600 font-medium gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          Voir les détails <ArrowRight className="w-3.5 h-3.5" />
        </div>
      </Link>

      {/* Trash button — bas droite, visible au survol uniquement */}
      {canDelete && (
        <div className="absolute bottom-3 right-3">
          <ProgramActions programId={program.id} programName={program.name} />
        </div>
      )}
    </div>
  )
}

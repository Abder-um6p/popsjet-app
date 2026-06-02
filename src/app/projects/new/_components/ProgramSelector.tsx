'use client'

import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface Program {
  id: string
  name: string
  description?: string | null
  color?: string | null
}

interface ProgramSelectorProps {
  programs: Program[]
  value: string
  onChange: (id: string) => void
  error?: string
}

const PALETTE = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#14b8a6']

function colorForName(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return PALETTE[Math.abs(hash) % PALETTE.length]
}

export default function ProgramSelector({ programs, value, onChange, error }: ProgramSelectorProps) {
  if (!programs.length) {
    return (
      <div className="rounded-xl border-2 border-dashed border-gray-200 py-10 text-center">
        <p className="text-sm text-gray-400">Aucun programme disponible.</p>
        <p className="text-xs text-gray-400 mt-1">Demandez à un administrateur de créer des programmes.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {programs.map((prog) => {
          const isSelected = value === prog.id
          const color = prog.color ?? colorForName(prog.name)
          const initials = prog.name.slice(0, 2).toUpperCase()

          return (
            <button
              key={prog.id}
              type="button"
              onClick={() => onChange(prog.id)}
              className={cn(
                'relative text-left rounded-xl border-2 p-4 transition-all',
                isSelected
                  ? 'border-blue-500 shadow-md ring-2 ring-blue-100'
                  : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              )}
            >
              {isSelected && (
                <div className="absolute top-3 right-3 w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              )}
              <div
                className="w-8 h-8 rounded-lg mb-3 flex items-center justify-center text-white text-xs font-bold"
                style={{ backgroundColor: color }}
              >
                {initials}
              </div>
              <p className="text-sm font-semibold text-gray-900 pr-6">{prog.name}</p>
              {prog.description && (
                <p className="text-xs text-gray-500 mt-1 line-clamp-2">{prog.description}</p>
              )}
            </button>
          )
        })}
      </div>

      {error && (
        <p className="text-xs text-red-500 mt-1">⚠ {error}</p>
      )}
    </div>
  )
}

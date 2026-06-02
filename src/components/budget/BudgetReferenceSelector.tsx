'use client'

import { useEffect, useRef, useState } from 'react'
import { Search, Tag, X, ChevronDown, AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BudgetRef {
  id: string
  code: string
  designation: string
  is_active: boolean
}

interface Props {
  programId: string | null
  value: string | null
  onChange: (id: string | null) => void
  disabled?: boolean
  placeholder?: string
  className?: string
}

export default function BudgetReferenceSelector({
  programId,
  value,
  onChange,
  disabled = false,
  placeholder = 'Sélectionner une référence budgétaire…',
  className,
}: Props) {
  const [refs, setRefs] = useState<BudgetRef[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!programId) return
    let cancelled = false
    setLoading(true)
    // FIN-05 : charger TOUTES les refs (actives + inactives) pour afficher le badge
    fetch(`/api/budget-references?program_id=${encodeURIComponent(programId)}`)
      .then(r => r.ok ? r.json() : [])
      .then((data: BudgetRef[]) => { if (!cancelled) setRefs(Array.isArray(data) ? data : []) })
      .catch(() => { if (!cancelled) setRefs([]) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [programId])

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setSearch('')
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  const selected         = value ? refs.find(r => r.id === value) ?? null : null
  const selectedInactive = selected && !selected.is_active

  const filtered = search.trim()
    ? refs.filter(r => {
        const q = search.toLowerCase()
        return r.code.toLowerCase().includes(q) || r.designation.toLowerCase().includes(q)
      })
    : refs

  if (!programId) {
    return (
      <div className={cn('relative', className)}>
        <div className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-400 bg-gray-50 cursor-not-allowed flex items-center gap-2">
          <Tag className="w-3.5 h-3.5" />
          Sélectionnez d&apos;abord un programme
        </div>
      </div>
    )
  }

  const isDisabled = disabled || loading

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      {/* Champ déclencheur */}
      {!open ? (
        <div
          role="button"
          tabIndex={isDisabled ? -1 : 0}
          onClick={() => { if (!isDisabled) setOpen(true) }}
          onKeyDown={e => { if (!isDisabled && (e.key === 'Enter' || e.key === ' ')) setOpen(true) }}
          className={cn(
            'w-full px-3 py-2 border rounded-lg text-sm text-left flex items-center gap-2 transition select-none',
            'border-gray-200 bg-white hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500',
            isDisabled ? 'opacity-50 cursor-not-allowed hover:border-gray-200' : 'cursor-pointer',
            selected ? 'text-gray-900' : 'text-gray-400'
          )}
        >
          {selectedInactive
            ? <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-amber-500" />
            : <Tag className="w-3.5 h-3.5 shrink-0 text-gray-400" />
          }
          {selected ? (
            <span className="flex-1 min-w-0 truncate">
              <span className={cn(
                'font-mono text-xs px-1.5 py-0.5 rounded mr-2',
                selectedInactive ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'
              )}>
                {selected.code}
              </span>
              <span className="text-gray-700">{selected.designation}</span>
              {selectedInactive && (
                <span className="ml-2 text-[10px] font-medium px-1.5 py-0.5 bg-red-50 text-red-500 border border-red-100 rounded-full">
                  Inactive
                </span>
              )}
            </span>
          ) : (
            <span className="flex-1 truncate">{loading ? 'Chargement…' : placeholder}</span>
          )}
          {selected && !isDisabled && (
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onChange(null) }}
              className="p-0.5 text-gray-400 hover:text-red-500 transition shrink-0"
              title="Désélectionner"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-gray-400 shrink-0" />
        </div>
      ) : (
        <div className="border border-blue-300 rounded-lg bg-white shadow-sm">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
            <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par code ou désignation…"
              className="flex-1 text-sm text-gray-900 placeholder-gray-400 bg-transparent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => { setOpen(false); setSearch('') }}
              className="p-0.5 text-gray-400 hover:text-gray-600 transition shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto">
            {loading ? (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">Chargement…</p>
            ) : filtered.length === 0 ? (
              <p className="px-3 py-4 text-xs text-gray-400 text-center">
                {refs.length === 0 ? 'Aucune référence' : 'Aucun résultat'}
              </p>
            ) : (
              filtered.map(r => {
                const isSelected  = r.id === value
                const isInactive  = !r.is_active
                return (
                  <button
                    key={r.id}
                    type="button"
                    disabled={isInactive}
                    title={isInactive ? 'Cette référence est inactive et ne peut pas être sélectionnée' : undefined}
                    onClick={() => {
                      if (isInactive) return
                      onChange(r.id); setOpen(false); setSearch('')
                    }}
                    className={cn(
                      'w-full text-left px-3 py-2 transition flex items-center gap-2 border-b border-gray-50 last:border-0',
                      isInactive
                        ? 'opacity-50 cursor-not-allowed bg-gray-50'
                        : 'hover:bg-blue-50',
                      isSelected && !isInactive && 'bg-blue-50'
                    )}
                  >
                    <span className={cn(
                      'font-mono text-xs px-1.5 py-0.5 rounded shrink-0',
                      isInactive ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-700'
                    )}>
                      {r.code}
                    </span>
                    <span className="flex-1 min-w-0 text-sm text-gray-700 truncate">
                      {r.designation}
                    </span>
                    {isInactive && (
                      <span className="text-[10px] font-medium px-1.5 py-0.5 bg-red-50 text-red-500 border border-red-100 rounded-full shrink-0">
                        Inactive
                      </span>
                    )}
                  </button>
                )
              })
            )}
          </div>
        </div>
      )}
    </div>
  )
}

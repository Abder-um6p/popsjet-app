'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, Users } from 'lucide-react'
import { getInitials } from '@/lib/utils'

interface Person {
  id:        string
  full_name: string
  role?:     string
}

interface Props {
  people:      Person[]
  value:       string[]           // array of selected IDs
  onChange:    (ids: string[]) => void
  disabled?:   boolean
  placeholder?: string
  excludeIds?: string[]           // IDs à exclure (ex: l'auteur courant)
}

export default function PeopleSearchInput({
  people,
  value,
  onChange,
  disabled,
  placeholder = 'Ajouter des personnes…',
  excludeIds = [],
}: Props) {
  const [query,   setQuery]   = useState('')
  const [open,    setOpen]    = useState(false)
  const [focused, setFocused] = useState(-1)
  const inputRef     = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery('')
        setFocused(-1)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const available = people.filter(p => !excludeIds.includes(p.id))

  const filtered = query.trim().length === 0
    ? [] // rien tant qu'on n'a pas tapé
    : available.filter(p => {
        const q = query.toLowerCase()
        return p.full_name.toLowerCase().includes(q) && !value.includes(p.id)
      }).slice(0, 8) // max 8 suggestions

  const selectedPeople = people.filter(p => value.includes(p.id))

  function toggle(id: string) {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id))
    } else {
      onChange([...value, id])
    }
    setQuery('')
    inputRef.current?.focus()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') setFocused(f => Math.min(f + 1, filtered.length - 1))
    else if (e.key === 'ArrowUp') setFocused(f => Math.max(f - 1, 0))
    else if (e.key === 'Enter' && focused >= 0 && filtered[focused]) {
      e.preventDefault()
      toggle(filtered[focused].id)
    } else if (e.key === 'Escape') { setOpen(false); setQuery('') }
    else if (e.key === 'Backspace' && query === '' && selectedPeople.length > 0) {
      onChange(value.slice(0, -1))
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex flex-wrap items-center gap-1.5 w-full px-3 py-2 border rounded-lg bg-white text-sm transition min-h-[38px]
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'cursor-text'}
          ${open ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-gray-200 hover:border-gray-300'}
        `}
        onClick={() => { if (!disabled) { setOpen(true); inputRef.current?.focus() } }}
      >
        {/* Tags sélectionnés */}
        {selectedPeople.map(p => (
          <span key={p.id}
            className="inline-flex items-center gap-1 pl-1.5 pr-1 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 rounded-md text-xs font-medium">
            <span className="w-4 h-4 rounded-full bg-blue-200 flex items-center justify-center text-[9px] font-bold shrink-0">
              {getInitials(p.full_name)}
            </span>
            {p.full_name}
            <button
              type="button"
              onClick={e => { e.stopPropagation(); toggle(p.id) }}
              className="ml-0.5 hover:text-blue-900 transition"
              tabIndex={-1}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}

        {/* Input de recherche */}
        <div className="flex items-center gap-1.5 flex-1 min-w-[120px]">
          <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); setFocused(-1) }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={selectedPeople.length === 0 ? placeholder : ''}
            className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-400 text-sm"
          />
        </div>
      </div>

      {/* Dropdown */}
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full bg-white rounded-xl border border-gray-100 shadow-lg overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {query.trim().length === 0 ? (
              <div className="px-4 py-5 text-center text-sm text-gray-400">
                Tapez un nom pour rechercher…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-5 text-center text-sm text-gray-400">
                Aucun résultat pour « {query} »
              </div>
            ) : (
              filtered.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseEnter={() => setFocused(i)}
                  onClick={() => toggle(p.id)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition
                    ${i === focused ? 'bg-blue-50' : 'hover:bg-gray-50'}`}
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                    {getInitials(p.full_name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.full_name}</p>
                    {p.role && <p className="text-[10px] text-gray-400 capitalize">{p.role.replace('_', ' ')}</p>}
                  </div>
                </button>
              ))
            )}
          </div>
          {selectedPeople.length > 0 && (
            <div className="border-t border-gray-50 px-4 py-2">
              <p className="text-[10px] text-gray-400">{selectedPeople.length} personne{selectedPeople.length > 1 ? 's' : ''} sélectionnée{selectedPeople.length > 1 ? 's' : ''}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

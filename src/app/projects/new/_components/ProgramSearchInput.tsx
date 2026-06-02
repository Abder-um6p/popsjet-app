'use client'

import { useState, useRef, useEffect } from 'react'
import { Search, X, Layers, ChevronDown } from 'lucide-react'

interface Program {
  id:           string
  name:         string
  description?: string | null
  color?:       string | null
}

interface Props {
  programs:  Program[]
  value:     string
  onChange:  (id: string) => void
  error?:    string
  disabled?: boolean
}

export default function ProgramSearchInput({ programs, value, onChange, error, disabled }: Props) {
  const selected     = programs.find(p => p.id === value) ?? null
  const [query,     setQuery]     = useState('')
  const [open,      setOpen]      = useState(false)
  const [focused,   setFocused]   = useState(-1)
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

  const filtered = query.trim().length === 0
    ? []
    : programs.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).slice(0, 8)

  function handleSelect(p: Program) {
    onChange(p.id)
    setQuery('')
    setOpen(false)
    setFocused(-1)
  }

  function handleClear(e: React.MouseEvent) {
    e.stopPropagation()
    onChange('')
    setQuery('')
    setOpen(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return }
    if (e.key === 'ArrowDown') setFocused(f => Math.min(f + 1, filtered.length - 1))
    else if (e.key === 'ArrowUp') setFocused(f => Math.max(f - 1, 0))
    else if (e.key === 'Enter' && focused >= 0 && filtered[focused]) handleSelect(filtered[focused])
    else if (e.key === 'Escape') { setOpen(false); setQuery('') }
  }

  return (
    <div ref={containerRef} className="relative">
      <div
        className={`flex items-center gap-2 w-full px-3 py-2 border rounded-lg bg-white text-sm transition cursor-text
          ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50' : 'hover:border-gray-300'}
          ${open ? 'border-blue-500 ring-2 ring-blue-500/20' : error ? 'border-red-400' : 'border-gray-200'}
        `}
        onClick={() => {
          if (disabled) return
          setOpen(true)
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
      >
        <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />

        {selected && !open ? (
          <div className="flex-1 flex items-center gap-2 min-w-0">
            <div className="w-5 h-5 rounded flex items-center justify-center shrink-0 bg-indigo-100">
              <Layers className="w-3 h-3 text-indigo-600" />
            </div>
            <span className="text-gray-900 truncate">{selected.name}</span>
          </div>
        ) : (
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); setFocused(-1) }}
            onFocus={() => setOpen(true)}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={selected ? selected.name : 'Tapez un programme pour rechercher…'}
            className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-400 min-w-0"
          />
        )}

        <div className="flex items-center gap-1 shrink-0">
          {selected && !open && (
            <button type="button" onClick={handleClear}
              className="p-0.5 rounded text-gray-400 hover:text-gray-600 transition" tabIndex={-1}>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
        </div>
      </div>

      {/* Dropdown */}
      {open && !disabled && (
        <div className="absolute z-30 mt-1 w-full bg-white rounded-xl border border-gray-100 shadow-lg overflow-hidden">
          {selected && (
            <div className="px-3 py-2 border-b border-gray-50">
              <div className="flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={e => { setQuery(e.target.value); setFocused(-1) }}
                  onKeyDown={handleKeyDown}
                  placeholder="Rechercher un programme…"
                  className="flex-1 text-sm outline-none text-gray-900 placeholder-gray-400"
                  autoFocus
                />
              </div>
            </div>
          )}

          <div className="max-h-56 overflow-y-auto">
            {query.trim().length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                Tapez un programme pour rechercher…
              </div>
            ) : filtered.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-gray-400">
                Aucun résultat pour « {query} »
              </div>
            ) : (
              filtered.map((p, i) => (
                <button
                  key={p.id}
                  type="button"
                  onMouseEnter={() => setFocused(i)}
                  onClick={() => handleSelect(p)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition
                    ${i === focused ? 'bg-blue-50' : 'hover:bg-gray-50'}
                    ${p.id === value ? 'bg-blue-50/60' : ''}
                  `}
                >
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0
                    ${p.id === value ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                    <Layers className={`w-3.5 h-3.5 ${p.id === value ? 'text-indigo-600' : 'text-gray-500'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                    {p.description && (
                      <p className="text-[10px] text-gray-400 truncate">{p.description}</p>
                    )}
                  </div>
                  {p.id === value && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-1">⚠ {error}</p>}
    </div>
  )
}

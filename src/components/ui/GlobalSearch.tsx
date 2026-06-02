'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Search, FolderKanban, CheckSquare, FileText, User, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

type ResultType = 'project' | 'task' | 'document' | 'member'

interface SearchResult {
  type:     ResultType
  id:       string
  title:    string
  subtitle?: string
  status?:  string
  priority?: string
  role?:    string
  mime?:    string
  href:     string
}

const TYPE_ICON: Record<ResultType, React.ReactNode> = {
  project:  <FolderKanban className="w-4 h-4 text-blue-500" />,
  task:     <CheckSquare className="w-4 h-4 text-purple-500" />,
  document: <FileText className="w-4 h-4 text-orange-500" />,
  member:   <User className="w-4 h-4 text-green-500" />,
}

const TYPE_LABEL: Record<ResultType, string> = {
  project:  'Projet',
  task:     'Tâche',
  document: 'Document',
  member:   'Membre',
}

const STATUS_BADGE: Record<string, string> = {
  draft:       'bg-gray-100 text-gray-600',
  active:      'bg-green-100 text-green-700',
  completed:   'bg-blue-100 text-blue-700',
  archived:    'bg-gray-100 text-gray-500',
  todo:        'bg-gray-100 text-gray-600',
  in_progress: 'bg-blue-100 text-blue-700',
  review:      'bg-yellow-100 text-yellow-700',
  done:        'bg-green-100 text-green-700',
  refused:     'bg-red-100 text-red-700',
  cancelled:   'bg-gray-100 text-gray-400',
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function GlobalSearch() {
  const router                      = useRouter()
  const [open, setOpen]             = useState(false)
  const [query, setQuery]           = useState('')
  const [results, setResults]       = useState<SearchResult[]>([])
  const [loading, setLoading]       = useState(false)
  const [selectedIdx, setSelectedIdx] = useState(0)
  const inputRef                    = useRef<HTMLInputElement>(null)
  const debouncedQuery              = useDebounce(query, 220)

  // ── Cmd+K / Ctrl+K ────────────────────────────────────────────────────────
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50)
      setQuery('')
      setResults([])
      setSelectedIdx(0)
    }
  }, [open])

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchResults = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setLoading(true)
    try {
      const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`)
      const json = await res.json()
      setResults(json.results ?? [])
      setSelectedIdx(0)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchResults(debouncedQuery) }, [debouncedQuery, fetchResults])

  // ── Navigation clavier ────────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent) {
    if (!results.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)) }
    if (e.key === 'Enter') {
      e.preventDefault()
      const r = results[selectedIdx]
      if (r) { router.push(r.href); setOpen(false) }
    }
  }

  function handleSelect(r: SearchResult) {
    router.push(r.href)
    setOpen(false)
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="hidden sm:flex items-center gap-2 px-3 py-1.5 text-sm text-gray-400 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition w-48"
        aria-label="Recherche globale"
      >
        <Search className="w-3.5 h-3.5 shrink-0" />
        <span className="flex-1 text-left text-xs">Rechercher…</span>
        <kbd className="text-[10px] bg-white border border-gray-200 rounded px-1 text-gray-400">⌘K</kbd>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden border border-gray-100">
        {/* Input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          {loading
            ? <Loader2 className="w-4 h-4 text-gray-400 shrink-0 animate-spin" />
            : <Search className="w-4 h-4 text-gray-400 shrink-0" />
          }
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Rechercher projets, tâches, documents, membres…"
            className="flex-1 text-sm text-gray-900 placeholder-gray-400 focus:outline-none bg-transparent"
            autoComplete="off"
          />
          <button onClick={() => setOpen(false)} className="p-1 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto">
          {query.length >= 2 && !loading && results.length === 0 && (
            <div className="py-10 text-center text-sm text-gray-400">
              Aucun résultat pour « {query} »
            </div>
          )}
          {query.length < 2 && (
            <div className="py-8 text-center text-xs text-gray-400">
              Tapez au moins 2 caractères pour rechercher
            </div>
          )}
          {results.map((r, i) => (
            <button
              key={`${r.type}-${r.id}`}
              onClick={() => handleSelect(r)}
              onMouseEnter={() => setSelectedIdx(i)}
              className={cn(
                'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                i === selectedIdx ? 'bg-blue-50' : 'hover:bg-gray-50'
              )}
            >
              <span className="shrink-0">{TYPE_ICON[r.type]}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{r.title}</p>
                {r.subtitle && <p className="text-xs text-gray-400 truncate">{r.subtitle}</p>}
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {(r.status) && (
                  <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-600')}>
                    {r.status}
                  </span>
                )}
                <span className="text-[10px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
                  {TYPE_LABEL[r.type]}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 border-t border-gray-100 flex items-center gap-3 text-[10px] text-gray-400">
          <span><kbd className="bg-gray-100 border border-gray-200 rounded px-1">↑↓</kbd> naviguer</span>
          <span><kbd className="bg-gray-100 border border-gray-200 rounded px-1">↵</kbd> ouvrir</span>
          <span><kbd className="bg-gray-100 border border-gray-200 rounded px-1">Esc</kbd> fermer</span>
        </div>
      </div>
    </div>
  )
}

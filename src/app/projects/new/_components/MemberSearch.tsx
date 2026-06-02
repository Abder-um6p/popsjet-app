'use client'

import { useState } from 'react'
import { Search, X } from 'lucide-react'
import { cn, getInitials, LABELS } from '@/lib/utils'

interface Profile {
  id: string
  full_name: string
  email: string
  role: string
  avatar_url?: string | null
}

interface MemberSearchProps {
  profiles: Profile[]
  value: string[]
  onChange: (ids: string[]) => void
  excludeIds?: string[]
  label?: string
  single?: boolean
}

export default function MemberSearch({
  profiles,
  value,
  onChange,
  excludeIds = [],
  label = 'Rechercher un membre',
  single = false,
}: MemberSearchProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const available = profiles.filter(
    (p) =>
      !excludeIds.includes(p.id) &&
      (single ? !value.includes(p.id) : true) &&
      (query === '' ||
        p.full_name.toLowerCase().includes(query.toLowerCase()) ||
        p.email.toLowerCase().includes(query.toLowerCase()))
  )

  const selected = profiles.filter((p) => value.includes(p.id))

  function toggleProfile(id: string) {
    if (single) {
      onChange(value.includes(id) ? [] : [id])
      setOpen(false)
      setQuery('')
    } else {
      onChange(
        value.includes(id) ? value.filter((v) => v !== id) : [...value, id]
      )
    }
  }

  function remove(id: string) {
    onChange(value.filter((v) => v !== id))
  }

  return (
    <div className="space-y-2">
      {/* Selected members */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selected.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-200 rounded-full text-sm"
            >
              <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                {getInitials(p.full_name)}
              </div>
              <span className="text-blue-800 font-medium text-xs">{p.full_name}</span>
              <button
                type="button"
                onClick={() => remove(p.id)}
                className="text-blue-400 hover:text-blue-600"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          placeholder={label}
          className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Dropdown */}
      {open && (
        <div className="border border-gray-200 rounded-xl shadow-md bg-white overflow-hidden max-h-56 overflow-y-auto">
          {available.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-6">
              {query ? 'Aucun résultat' : 'Tous les membres ont été ajoutés'}
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {available.map((p) => {
                const isSelected = value.includes(p.id)
                return (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={() => toggleProfile(p.id)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-gray-50 transition',
                      isSelected && 'bg-blue-50'
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                      {getInitials(p.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{p.full_name}</p>
                      <p className="text-xs text-gray-400 truncate">{p.email}</p>
                    </div>
                    <span className="text-xs text-gray-400 flex-shrink-0">
                      {LABELS.user_role[p.role as keyof typeof LABELS.user_role] ?? p.role}
                    </span>
                    {isSelected && (
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

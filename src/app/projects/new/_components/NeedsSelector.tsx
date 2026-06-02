'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface NeedsSelectorProps {
  value: {
    logistique: string[]
    communication: string[]
    administratif: string[]
  }
  onChange: (value: { logistique: string[]; communication: string[]; administratif: string[] }) => void
}

const CATEGORIES = [
  {
    key: 'logistique' as const,
    label: 'Logistique',
    emoji: '🏨',
    color: 'blue',
    items: [
      { id: 'hebergement', label: 'Hébergement' },
      { id: 'parking', label: 'Parking' },
      { id: 'transport', label: 'Transport' },
      { id: 'catering', label: 'Catering' },
      { id: 'billets_avion', label: 'Billets avion' },
      { id: 'salle', label: 'Réservation salle' },
      { id: 'materiel', label: 'Matériel' },
      { id: 'autre_log', label: 'Autre…' },
    ],
  },
  {
    key: 'communication' as const,
    label: 'Communication',
    emoji: '📢',
    color: 'purple',
    items: [
      { id: 'design', label: 'Design / Visuels' },
      { id: 'presentation', label: 'Présentation' },
      { id: 'formulaire', label: 'Formulaire' },
      { id: 'reseaux', label: 'Réseaux sociaux' },
      { id: 'email', label: 'Campagne email' },
      { id: 'video', label: 'Vidéo / Photo' },
      { id: 'site_web', label: 'Page web' },
      { id: 'autre_com', label: 'Autre…' },
    ],
  },
  {
    key: 'administratif' as const,
    label: 'Administratif',
    emoji: '📋',
    color: 'orange',
    items: [
      { id: 'demande_achat', label: 'Demande d\'achat' },
      { id: 'validation_docs', label: 'Validation docs' },
      { id: 'factures', label: 'Factures / BC' },
      { id: 'contrats', label: 'Contrats' },
      { id: 'rapport', label: 'Rapport final' },
      { id: 'certificats', label: 'Certificats' },
      { id: 'autre_adm', label: 'Autre…' },
    ],
  },
]

const COLOR_MAP: Record<string, { header: string; chip: string; chipActive: string; check: string }> = {
  blue: {
    header: 'text-blue-700',
    chip: 'bg-gray-50 border-gray-200 text-gray-600 hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700',
    chipActive: 'bg-blue-100 border-blue-400 text-blue-800',
    check: 'text-blue-600',
  },
  purple: {
    header: 'text-purple-700',
    chip: 'bg-gray-50 border-gray-200 text-gray-600 hover:border-purple-300 hover:bg-purple-50 hover:text-purple-700',
    chipActive: 'bg-purple-100 border-purple-400 text-purple-800',
    check: 'text-purple-600',
  },
  orange: {
    header: 'text-orange-700',
    chip: 'bg-gray-50 border-gray-200 text-gray-600 hover:border-orange-300 hover:bg-orange-50 hover:text-orange-700',
    chipActive: 'bg-orange-100 border-orange-400 text-orange-800',
    check: 'text-orange-600',
  },
}

export default function NeedsSelector({ value, onChange }: NeedsSelectorProps) {
  // Per-category "autre" text inputs
  const [autreText, setAutreText] = useState<Record<string, string>>({
    autre_log: '',
    autre_com: '',
    autre_adm: '',
  })

  function toggle(category: keyof typeof value, itemId: string) {
    const current = value[category]
    const updated = current.includes(itemId)
      ? current.filter((id) => id !== itemId)
      : [...current, itemId]
    onChange({ ...value, [category]: updated })
  }

  const totalSelected =
    value.logistique.length + value.communication.length + value.administratif.length

  return (
    <div className="space-y-4">
      {/* Selected summary pills */}
      {totalSelected > 0 && (
        <div className="flex flex-wrap gap-1.5 p-2.5 bg-gray-50 rounded-lg border border-gray-200">
          <span className="text-xs text-gray-400 font-medium self-center mr-1">
            {totalSelected} sélectionné{totalSelected > 1 ? 's' : ''}
          </span>
          {CATEGORIES.map((cat) =>
            value[cat.key].map((id) => {
              const item = cat.items.find((i) => i.id === id)
              const label = id.startsWith('autre_') ? (autreText[id] || 'Autre') : item?.label
              return label ? (
                <button
                  key={`${cat.key}-${id}`}
                  type="button"
                  onClick={() => toggle(cat.key, id)}
                  className={cn(
                    'text-xs px-2 py-0.5 rounded-full border transition flex items-center gap-1',
                    COLOR_MAP[cat.color].chipActive
                  )}
                >
                  {label} ×
                </button>
              ) : null
            })
          )}
        </div>
      )}

      {/* Category columns — compact chip layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {CATEGORIES.map((cat) => {
          const colors = COLOR_MAP[cat.color]
          const selected = value[cat.key]

          return (
            <div key={cat.key} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 bg-gray-50/60">
                <span className={cn('text-xs font-semibold uppercase tracking-wide', colors.header)}>
                  {cat.emoji} {cat.label}
                </span>
                <span className="text-xs text-gray-400">
                  {selected.length > 0 ? `${selected.length} ✓` : ''}
                </span>
              </div>

              {/* Chip grid */}
              <div className="p-2.5 flex flex-wrap gap-1.5">
                {cat.items.map((item) => {
                  const isAutre = item.id.startsWith('autre_')
                  const checked = selected.includes(item.id)

                  return (
                    <div key={item.id} className="contents">
                      <button
                        type="button"
                        onClick={() => toggle(cat.key, item.id)}
                        className={cn(
                          'flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border font-medium transition-all',
                          checked ? colors.chipActive : colors.chip
                        )}
                      >
                        {checked && <Check className={cn('w-3 h-3 flex-shrink-0', colors.check)} />}
                        {isAutre ? '+ Autre' : item.label}
                      </button>

                      {/* Inline text input when "Autre" is checked */}
                      {isAutre && checked && (
                        <input
                          type="text"
                          value={autreText[item.id]}
                          onChange={(e) => setAutreText((p) => ({ ...p, [item.id]: e.target.value }))}
                          placeholder="Précisez…"
                          className="w-full mt-1 px-2.5 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

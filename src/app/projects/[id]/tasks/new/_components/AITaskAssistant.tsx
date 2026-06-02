'use client'

import { useState, useEffect, useRef } from 'react'
import { Sparkles, RefreshCw, CheckCircle2, Lightbulb, ChevronDown, ChevronUp, Check } from 'lucide-react'

interface Suggestion {
  description: string
  priority:    'low' | 'medium' | 'high' | 'urgent'
  subtasks:    string[]
  tips:        string[]
  label?:      string | null  // id d'étiquette (ex: 'transport', 'design')
}

interface Props {
  title:       string
  projectTitle?: string
  onApply: (fields: {
    description?: string
    priority?:    string
    subtasks?:    string[]
    label?:       string
  }) => void
}

const PRIORITY_LABELS: Record<string, { label: string; cls: string }> = {
  low:    { label: 'Faible',  cls: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Moyen',   cls: 'bg-yellow-100 text-yellow-700' },
  high:   { label: 'Élevé',   cls: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent',  cls: 'bg-red-100 text-red-700' },
}

export default function AITaskAssistant({ title, projectTitle, onApply }: Props) {
  const [suggestion,  setSuggestion]  = useState<Suggestion | null>(null)
  const [loading,     setLoading]     = useState(false)
  const [open,        setOpen]        = useState(false)
  const [applied,     setApplied]     = useState<Set<string>>(new Set())
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const prevTitle   = useRef('')

  // Déclencher auto quand le titre change (debounce 800ms, min 5 chars)
  useEffect(() => {
    if (title.trim().length < 5) return
    if (title.trim() === prevTitle.current) return

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      prevTitle.current = title.trim()
      generate()
    }, 800)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [title])

  async function generate() {
    setLoading(true)
    setOpen(true)
    setApplied(new Set())
    try {
      const res = await fetch('/api/ai/task-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), projectTitle }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSuggestion(data)
    } catch {
      setSuggestion(null)
    } finally {
      setLoading(false)
    }
  }

  function markApplied(key: string) {
    setApplied(prev => new Set([...prev, key]))
  }

  if (title.trim().length < 5 && !suggestion && !loading) return null

  const priorityMeta = suggestion ? PRIORITY_LABELS[suggestion.priority] : null

  return (
    <div className={`rounded-xl border transition-all ${open ? 'border-blue-200 bg-blue-50/40' : 'border-gray-200 bg-white'}`}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2.5 px-4 py-3 text-left"
      >
        <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shrink-0">
          {loading
            ? <RefreshCw className="w-3.5 h-3.5 text-white animate-spin" />
            : <Sparkles className="w-3.5 h-3.5 text-white" />
          }
        </div>
        <span className="text-sm font-semibold text-gray-800 flex-1">
          {loading ? 'Analyse en cours…' : 'Assistant IA'}
        </span>
        {!loading && suggestion && (
          <span className="text-[10px] text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full font-medium">
            Suggestions disponibles
          </span>
        )}
        {open
          ? <ChevronUp className="w-4 h-4 text-gray-400" />
          : <ChevronDown className="w-4 h-4 text-gray-400" />
        }
      </button>

      {/* Body */}
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-blue-100">
          {loading && (
            <div className="pt-3 flex items-center gap-2 text-sm text-gray-500">
              <RefreshCw className="w-3.5 h-3.5 animate-spin text-blue-500" />
              Génération des suggestions…
            </div>
          )}

          {!loading && suggestion && (
            <>
              {/* Priorité */}
              <div className="pt-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Priorité recommandée</p>
                <div className="flex items-center justify-between">
                  <span className={`text-xs font-semibold px-3 py-1 rounded-full ${priorityMeta?.cls}`}>
                    {priorityMeta?.label}
                  </span>
                  {!applied.has('priority') ? (
                    <button
                      type="button"
                      onClick={() => { onApply({ priority: suggestion.priority }); markApplied('priority') }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium transition flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Appliquer
                    </button>
                  ) : (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Appliqué
                    </span>
                  )}
                </div>
              </div>

              {/* Description */}
              <div className="border-t border-blue-100 pt-3">
                <p className="text-xs font-medium text-gray-500 mb-2">Description suggérée</p>
                <p className="text-xs text-gray-600 leading-relaxed bg-white rounded-lg border border-gray-100 p-2.5 line-clamp-3">
                  {suggestion.description}
                </p>
                <div className="flex justify-end mt-1.5">
                  {!applied.has('description') ? (
                    <button
                      type="button"
                      onClick={() => { onApply({ description: suggestion.description }); markApplied('description') }}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium transition flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" /> Utiliser cette description
                    </button>
                  ) : (
                    <span className="text-xs text-green-600 flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" /> Appliqué
                    </span>
                  )}
                </div>
              </div>

              {/* Sous-tâches */}
              {suggestion.subtasks.length > 0 && (
                <div className="border-t border-blue-100 pt-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs font-medium text-gray-500">Étapes suggérées</p>
                    {!applied.has('subtasks') ? (
                      <button
                        type="button"
                        onClick={() => { onApply({ subtasks: suggestion.subtasks }); markApplied('subtasks') }}
                        className="text-xs text-blue-600 hover:text-blue-800 font-medium transition flex items-center gap-1"
                      >
                        <Check className="w-3 h-3" /> Ajouter à la description
                      </button>
                    ) : (
                      <span className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ajouté
                      </span>
                    )}
                  </div>
                  <ul className="space-y-1">
                    {suggestion.subtasks.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                        <span className="w-4 h-4 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-[9px] font-bold shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Conseil */}
              {suggestion.tips.length > 0 && (
                <div className="border-t border-blue-100 pt-3">
                  {suggestion.tips.map((tip, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <Lightbulb className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                      <p className="text-xs text-gray-600">{tip}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Regénérer */}
              <div className="border-t border-blue-100 pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={generate}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-600 transition"
                >
                  <RefreshCw className="w-3 h-3" /> Regénérer
                </button>
              </div>
            </>
          )}

          {!loading && !suggestion && (
            <div className="pt-3 text-xs text-gray-400">
              Tapez un titre pour obtenir des suggestions.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

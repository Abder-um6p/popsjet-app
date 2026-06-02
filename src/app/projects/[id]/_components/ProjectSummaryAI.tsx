'use client'

import { useState } from 'react'
import { Sparkles, RefreshCw, X, KeyRound } from 'lucide-react'
import Link from 'next/link'

interface Props {
  project:   Record<string, any>
  tasks:     { status: string; due_date?: string | null }[]
  members:   { id: string; full_name: string }[]
}

export default function ProjectSummaryAI({ project, tasks, members }: Props) {
  const [summary,  setSummary]  = useState<string | null>(null)
  const [noKey,    setNoKey]    = useState(false)
  const [loading,  setLoading]  = useState(false)
  const [open,     setOpen]     = useState(false)

  async function generate() {
    setLoading(true)
    setOpen(true)
    try {
      const res = await fetch('/api/ai/project-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, tasks, members }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setSummary(data.summary ?? null)
      setNoKey(!!data.noKey)
    } catch {
      setSummary('Impossible de générer le résumé pour le moment.')
      setNoKey(false)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={open ? () => setOpen(false) : generate}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-violet-200 bg-violet-50 text-violet-700 text-xs font-medium rounded-lg hover:bg-violet-100 transition"
      >
        {loading
          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          : <Sparkles className="w-3.5 h-3.5" />
        }
        Résumé IA
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-30 w-80 bg-white rounded-xl border border-violet-100 shadow-lg p-4">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                <Sparkles className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-semibold text-gray-800">Résumé IA</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={generate}
                disabled={loading}
                className="p-1 text-gray-400 hover:text-violet-600 transition disabled:opacity-50"
                title="Regénérer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
              <RefreshCw className="w-3 h-3 animate-spin text-violet-400" />
              Génération en cours…
            </div>
          ) : summary ? (
            <>
              <p className="text-xs text-gray-700 leading-relaxed">{summary}</p>
              {noKey && (
                <div className="mt-3 flex items-center gap-2 px-2.5 py-2 bg-amber-50 rounded-lg border border-amber-100">
                  <KeyRound className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <p className="text-[11px] text-amber-700 leading-tight">
                    Analyse basée sur des règles.{' '}
                    <Link href="/profile" className="underline hover:text-amber-900 font-medium">Ajoutez votre clé IA</Link>
                    {' '}pour de meilleurs résultats.
                  </p>
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </div>
  )
}

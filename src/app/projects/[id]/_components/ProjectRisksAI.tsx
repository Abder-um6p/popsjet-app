'use client'

import { useState } from 'react'
import { ShieldAlert, RefreshCw, X, AlertTriangle, AlertCircle, CheckCircle2, KeyRound } from 'lucide-react'
import Link from 'next/link'

interface Risk {
  level:  'low' | 'medium' | 'high'
  title:  string
  detail: string
}

interface Props {
  project: Record<string, any>
  tasks:   { status: string; due_date?: string | null; assigned_to?: string | null }[]
  members: { id: string; full_name: string }[]
}

const LEVEL_META = {
  high:   { label: 'Élevé',  cls: 'bg-red-50 border-red-200 text-red-700',     icon: AlertCircle,    dot: 'bg-red-500' },
  medium: { label: 'Moyen',  cls: 'bg-orange-50 border-orange-200 text-orange-700', icon: AlertTriangle, dot: 'bg-orange-400' },
  low:    { label: 'Faible', cls: 'bg-green-50 border-green-200 text-green-700', icon: CheckCircle2,  dot: 'bg-green-400' },
}

export default function ProjectRisksAI({ project, tasks, members }: Props) {
  const [risks,   setRisks]   = useState<Risk[] | null>(null)
  const [noKey,   setNoKey]   = useState(false)
  const [loading, setLoading] = useState(false)
  const [open,    setOpen]    = useState(false)

  async function analyze() {
    setLoading(true)
    setOpen(true)
    try {
      const res = await fetch('/api/ai/project-risks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, tasks, members }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setRisks(data.risks ?? [])
      setNoKey(!!data.noKey)
    } catch {
      setRisks([{ level: 'medium', title: 'Analyse indisponible', detail: 'Impossible de récupérer l\'analyse pour le moment.' }])
      setNoKey(false)
    } finally {
      setLoading(false)
    }
  }

  const highCount = risks?.filter(r => r.level === 'high').length ?? 0

  return (
    <div className="relative">
      <button
        type="button"
        onClick={open ? () => setOpen(false) : analyze}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-orange-200 bg-orange-50 text-orange-700 text-xs font-medium rounded-lg hover:bg-orange-100 transition"
      >
        {loading
          ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          : <ShieldAlert className="w-3.5 h-3.5" />
        }
        Risques
        {!loading && highCount > 0 && (
          <span className="ml-0.5 w-4 h-4 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
            {highCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-9 z-30 w-88 bg-white rounded-xl border border-orange-100 shadow-lg p-4" style={{ width: '22rem' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-1.5">
              <div className="w-5 h-5 rounded-md bg-gradient-to-br from-orange-400 to-red-500 flex items-center justify-center">
                <ShieldAlert className="w-3 h-3 text-white" />
              </div>
              <span className="text-xs font-semibold text-gray-800">Analyse des risques</span>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={analyze} disabled={loading}
                className="p-1 text-gray-400 hover:text-orange-600 transition disabled:opacity-50" title="Relancer">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button type="button" onClick={() => setOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-600 transition">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 text-xs text-gray-400 py-2">
              <RefreshCw className="w-3 h-3 animate-spin text-orange-400" />
              Analyse en cours…
            </div>
          ) : risks ? (
            <div className="space-y-2">
              {risks.map((r, i) => {
                const meta = LEVEL_META[r.level]
                const Icon = meta.icon
                return (
                  <div key={i} className={`rounded-lg border p-2.5 ${meta.cls}`}>
                    <div className="flex items-start gap-2">
                      <Icon className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold">{r.title}</p>
                        <p className="text-[11px] mt-0.5 opacity-80">{r.detail}</p>
                      </div>
                    </div>
                  </div>
                )
              })}
              {noKey && (
                <div className="flex items-center gap-2 px-2.5 py-2 bg-amber-50 rounded-lg border border-amber-100 mt-1">
                  <KeyRound className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                  <p className="text-[11px] text-amber-700 leading-tight">
                    Détection par règles.{' '}
                    <Link href="/profile" className="underline hover:text-amber-900 font-medium">Ajoutez votre clé IA</Link>
                    {' '}pour une analyse approfondie.
                  </p>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

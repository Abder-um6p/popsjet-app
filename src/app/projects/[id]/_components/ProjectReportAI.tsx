'use client'

import { useState } from 'react'
import { FileDown, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  project: Record<string, any>
  tasks:   any[]
  members: { id: string; full_name: string }[]
}

export default function ProjectReportAI({ project, tasks, members }: Props) {
  const [loading, setLoading] = useState(false)

  async function download() {
    setLoading(true)
    try {
      const res = await fetch('/api/ai/project-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ project, tasks, members }),
      })
      if (!res.ok) throw new Error('Génération échouée')

      const blob = await res.blob()
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      const filename = match?.[1] ?? 'rapport-projet.docx'

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Rapport téléchargé')
    } catch {
      toast.error('Impossible de générer le rapport')
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      type="button"
      onClick={download}
      disabled={loading}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-green-200 bg-green-50 text-green-700 text-xs font-medium rounded-lg hover:bg-green-100 transition disabled:opacity-60"
    >
      {loading
        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        : <FileDown className="w-3.5 h-3.5" />
      }
      {loading ? 'Génération…' : 'Rapport'}
    </button>
  )
}

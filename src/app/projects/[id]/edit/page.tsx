'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'

export default function EditProjectPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [loading, setLoading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [form, setForm] = useState({
    title: '', description: '', type: 'structured',
    status: 'draft', start_date: '', end_date: '',
    budget: '', completion_pct: '0',
  })

  useEffect(() => {
    async function load() {
      const res = await fetch(`/api/projects/${id}`)
      if (!res.ok) { router.push('/projects'); return }
      const data = await res.json()
      setForm({
        title: data.title ?? '',
        description: data.description ?? '',
        type: data.type ?? 'structured',
        status: data.status ?? 'draft',
        start_date: data.start_date ?? '',
        end_date: data.end_date ?? '',
        budget: data.budget?.toString() ?? '0',
        completion_pct: data.completion_pct?.toString() ?? '0',
      })
    }
    load()
  }, [id, router])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await fetch(`/api/projects/${id}`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:          form.title.trim(),
        description:    form.description.trim() || null,
        type:           form.type,
        status:         form.status,
        start_date:     form.start_date || null,
        end_date:       form.end_date || null,
        budget:         parseFloat(form.budget) || 0,
        completion_pct: parseInt(form.completion_pct) || 0,
      }),
    })
    const json = await res.json().catch(() => ({}))
    const error = res.ok ? null : json

    if (error) { toast.error(json.error ?? 'Erreur de mise à jour'); setLoading(false); return }
    toast.success('Projet mis à jour')
    router.push(`/projects/${id}`)
  }

  async function handleDelete() {
    if (!confirm('Archiver ce projet ? Il ne sera plus visible dans la liste.')) return
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('projects').update({ deleted_at: new Date().toISOString() }).eq('id', id)
    toast.success('Projet archivé')
    router.push('/projects')
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={`/projects/${id}`} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Modifier le projet</h1>
            <p className="text-sm text-gray-500 mt-0.5">Mettre à jour les informations</p>
          </div>
        </div>
        <button onClick={handleDelete} disabled={deleting}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50">
          <Trash2 className="w-4 h-4" />
          Archiver
        </button>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select value={form.type} onChange={e => set('type', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="structured">Projet structuré</option>
              <option value="flexible">Projet flexible</option>
              <option value="workshop">Workshop</option>
              <option value="hackathon">Hackathon</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="draft">Brouillon</option>
              <option value="active">Actif</option>
              <option value="on_hold">En pause</option>
              <option value="completed">Terminé</option>
              <option value="cancelled">Annulé</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de début</label>
            <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin</label>
            <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Budget (MAD)</label>
            <input type="number" value={form.budget} onChange={e => set('budget', e.target.value)} min="0"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Avancement (%)</label>
            <input type="number" value={form.completion_pct} onChange={e => set('completion_pct', e.target.value)} min="0" max="100"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={`/projects/${id}`} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">Annuler</Link>
          <button type="submit" disabled={loading || !form.title.trim()}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
            {loading ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </form>
    </div>
  )
}

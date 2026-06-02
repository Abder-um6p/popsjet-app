'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Tag, Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import BulkBudgetImport from './BulkBudgetImport'

interface BudgetRef {
  id: string
  program_id: string
  code: string
  designation: string
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface Props {
  programId: string
  programName: string
  userRole: string
}

const WRITE_ROLES = ['admin', 'directeur', 'chef_projet']
const DELETE_ROLES = ['admin', 'directeur']

export default function ProgramBudgetReferences({ programId, programName, userRole }: Props) {
  const canWrite = WRITE_ROLES.includes(userRole)
  const canDelete = DELETE_ROLES.includes(userRole)

  const [refs, setRefs] = useState<BudgetRef[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [addForm, setAddForm] = useState({ code: '', designation: '', notes: '', is_active: true })
  const [submitting, setSubmitting] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<{ designation: string; notes: string; is_active: boolean }>({
    designation: '', notes: '', is_active: true,
  })
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const r = await fetch(`/api/budget-references?program_id=${encodeURIComponent(programId)}`)
      if (!r.ok) {
        const body = await r.json().catch(() => ({}))
        toast.error(body?.error ?? 'Chargement échoué')
        setRefs([])
        return
      }
      const data: BudgetRef[] = await r.json()
      setRefs(Array.isArray(data) ? data : [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur réseau')
      setRefs([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [programId])

  async function handleBulkImport(lines: Array<{ code: string; designation: string; notes: string }>) {
    if (lines.length === 0) return
    setImporting(true)
    const results = await Promise.allSettled(
      lines.map(l =>
        fetch('/api/budget-references', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            program_id: programId,
            code: l.code.trim().toUpperCase(),
            designation: l.designation.trim(),
            notes: l.notes.trim() || null,
            is_active: true,
          }),
        })
      )
    )
    const created = results.filter(r => r.status === 'fulfilled').length
    const failed  = results.length - created
    if (created > 0) toast.success(`${created} ligne${created > 1 ? 's' : ''} importée${created > 1 ? 's' : ''}`)
    if (failed  > 0) toast.error(`${failed} ligne${failed > 1 ? 's' : ''} non importée${failed > 1 ? 's' : ''} (code déjà existant ?)`)
    await load()
    setImporting(false)
  }

  function resetAdd() {
    setAddForm({ code: '', designation: '', notes: '', is_active: true })
    setShowAdd(false)
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    const code = addForm.code.trim().toUpperCase()
    const designation = addForm.designation.trim()
    if (!code || !designation) {
      toast.error('Code et désignation requis')
      return
    }
    setSubmitting(true)
    try {
      const r = await fetch('/api/budget-references', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          program_id: programId,
          code,
          designation,
          notes: addForm.notes.trim() || null,
          is_active: addForm.is_active,
        }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        toast.error(body?.error ?? 'Création échouée')
        return
      }
      toast.success('Référence ajoutée')
      resetAdd()
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  function startEdit(ref: BudgetRef) {
    setEditingId(ref.id)
    setEditForm({
      designation: ref.designation,
      notes: ref.notes ?? '',
      is_active: ref.is_active,
    })
    setConfirmDeleteId(null)
  }

  function cancelEdit() {
    setEditingId(null)
  }

  async function saveEdit(id: string) {
    const designation = editForm.designation.trim()
    if (!designation) {
      toast.error('La désignation ne peut pas être vide')
      return
    }
    setBusyId(id)
    try {
      const r = await fetch(`/api/budget-references/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          designation,
          notes: editForm.notes.trim() || null,
          is_active: editForm.is_active,
        }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        toast.error(body?.error ?? 'Mise à jour échouée')
        return
      }
      toast.success('Référence mise à jour')
      setEditingId(null)
      await load()
    } finally {
      setBusyId(null)
    }
  }

  async function toggleActive(ref: BudgetRef) {
    setBusyId(ref.id)
    try {
      const r = await fetch(`/api/budget-references/${ref.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !ref.is_active }),
      })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        toast.error(body?.error ?? 'Mise à jour échouée')
        return
      }
      setRefs(prev => prev.map(p => p.id === ref.id ? { ...p, is_active: !ref.is_active } : p))
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete(id: string) {
    setBusyId(id)
    try {
      const r = await fetch(`/api/budget-references/${id}`, { method: 'DELETE' })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) {
        toast.error(body?.error ?? 'Suppression échouée')
        return
      }
      toast.success('Référence supprimée')
      setConfirmDeleteId(null)
      setRefs(prev => prev.filter(p => p.id !== id))
    } finally {
      setBusyId(null)
    }
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-50">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-blue-500" />
          <h2 className="text-base font-semibold text-gray-800">Références budgétaires</h2>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-50 text-blue-700">
            {loading ? '—' : refs.length}
          </span>
        </div>
        {canWrite && !showAdd && (
          <div className="flex items-center gap-2">
            <BulkBudgetImport
              programName={programName}
              onImport={handleBulkImport}
            />
            <button
              type="button"
              onClick={() => setShowAdd(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
            >
              <Plus className="w-3.5 h-3.5" />
              Ajouter une référence
            </button>
          </div>
        )}
      </div>

      {/* Inline add form */}
      {canWrite && showAdd && (
        <form onSubmit={handleAdd} className="px-5 py-4 border-b border-gray-50 bg-blue-50/30 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[140px_1fr] gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Code *</label>
              <input
                type="text"
                value={addForm.code}
                onChange={e => setAddForm(f => ({ ...f, code: e.target.value.toUpperCase() }))}
                placeholder="EX-001"
                className={cn(inputCls, 'font-mono')}
                required
                autoFocus
                disabled={submitting}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Désignation *</label>
              <input
                type="text"
                value={addForm.designation}
                onChange={e => setAddForm(f => ({ ...f, designation: e.target.value }))}
                placeholder="Ex : Équipement workshop"
                className={inputCls}
                required
                disabled={submitting}
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optionnel)</label>
            <textarea
              value={addForm.notes}
              onChange={e => setAddForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Précisions, contraintes…"
              rows={2}
              className={cn(inputCls, 'resize-none')}
              disabled={submitting}
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="inline-flex items-center gap-2 text-xs text-gray-700">
              <input
                type="checkbox"
                checked={addForm.is_active}
                onChange={e => setAddForm(f => ({ ...f, is_active: e.target.checked }))}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                disabled={submitting}
              />
              Active dès maintenant
            </label>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={resetAdd}
                disabled={submitting}
                className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {submitting && <Loader2 className="w-3 h-3 animate-spin" />}
                Ajouter
              </button>
            </div>
          </div>
        </form>
      )}

      {/* List */}
      {loading ? (
        <div className="px-5 py-8 space-y-2">
          {[0, 1, 2].map(i => (
            <div key={i} className="h-10 bg-gray-50 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : refs.length === 0 ? (
        <div className="px-5 py-10 text-center">
          <Tag className="w-7 h-7 text-gray-200 mx-auto mb-2" />
          <p className="text-sm text-gray-400">
            Aucune référence budgétaire
            {canWrite && ' — ajoutez-en une pour standardiser la saisie.'}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-gray-50">
          {refs.map(ref => {
            const isEditing = editingId === ref.id
            const isConfirming = confirmDeleteId === ref.id
            const isBusy = busyId === ref.id

            return (
              <li key={ref.id} className={cn('px-5 py-3', !ref.is_active && 'opacity-60')}>
                {isEditing ? (
                  <div className="space-y-2">
                    <div className="flex items-start gap-3">
                      <span className="font-mono text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 shrink-0 mt-1">
                        {ref.code}
                      </span>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          value={editForm.designation}
                          onChange={e => setEditForm(f => ({ ...f, designation: e.target.value }))}
                          className={inputCls}
                          placeholder="Désignation"
                          disabled={isBusy}
                        />
                        <textarea
                          value={editForm.notes}
                          onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))}
                          placeholder="Notes"
                          rows={2}
                          className={cn(inputCls, 'resize-none')}
                          disabled={isBusy}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between pl-12">
                      <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={editForm.is_active}
                          onChange={e => setEditForm(f => ({ ...f, is_active: e.target.checked }))}
                          disabled={isBusy}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                        Active
                      </label>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={isBusy}
                          className="px-2.5 py-1 text-xs text-gray-600 hover:text-gray-800 transition"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          onClick={() => saveEdit(ref.id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
                        >
                          {isBusy && <Loader2 className="w-3 h-3 animate-spin" />}
                          Enregistrer
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-xs px-2 py-1 rounded bg-blue-50 text-blue-700 shrink-0">
                      {ref.code}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">{ref.designation}</p>
                      {ref.notes && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{ref.notes}</p>
                      )}
                    </div>

                    {canWrite ? (
                      <button
                        type="button"
                        onClick={() => toggleActive(ref)}
                        disabled={isBusy}
                        className={cn(
                          'text-[11px] font-medium px-2 py-0.5 rounded-full transition shrink-0',
                          ref.is_active
                            ? 'bg-green-50 text-green-700 hover:bg-green-100'
                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                        )}
                      >
                        {ref.is_active ? 'Actif' : 'Inactif'}
                      </button>
                    ) : (
                      <span className={cn(
                        'text-[11px] font-medium px-2 py-0.5 rounded-full shrink-0',
                        ref.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                      )}>
                        {ref.is_active ? 'Actif' : 'Inactif'}
                      </span>
                    )}

                    {canWrite && !isConfirming && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(ref)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition"
                          title="Modifier"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(ref.id)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                            title="Supprimer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}

                    {isConfirming && (
                      <div className="flex items-center gap-2 text-xs shrink-0">
                        <span className="text-red-600 font-medium">Supprimer ?</span>
                        <button
                          type="button"
                          onClick={() => handleDelete(ref.id)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50 transition"
                        >
                          {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                          Oui
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(null)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 transition"
                        >
                          <X className="w-3 h-3" />
                          Non
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

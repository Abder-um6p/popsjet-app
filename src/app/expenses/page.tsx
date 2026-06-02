'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate, LABELS, getInitials } from '@/lib/utils'
import { Wallet, Plus, Check, X, Clock, Trash2, RefreshCw, AlertTriangle, Archive, FileCheck, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import BudgetReferenceSelector from '@/components/budget/BudgetReferenceSelector'
import ProjectSearchInput from '@/components/ui/ProjectSearchInput'
import PeopleSearchInput from '@/components/ui/PeopleSearchInput'

const EXPENSE_CATEGORIES = Object.entries(LABELS.expense_category).map(([value, label]) => ({ value, label }))

// L'API IA renvoie des catégories plus granulaires (avec accents) que le dropdown.
// On mappe la valeur retournée vers l'option réellement présente dans le select.
const AI_CATEGORY_TO_DROPDOWN: Record<string, keyof typeof LABELS.expense_category> = {
  transport:       'transport',
  hébergement:     'hebergement',
  hebergement:     'hebergement',
  restauration:    'restauration',
  fournitures:     'materiel',
  équipement:      'materiel',
  equipement:      'materiel',
  materiel:        'materiel',
  prestation:      'autre',
  formation:       'formation',
  communication:   'communication',
  événement:       'autre',
  evenement:       'autre',
  logiciel:        'logiciel',
  impression:      'communication',
  frais_bancaires: 'autre',
  autre:           'autre',
}

const EMPTY_FORM = {
  project_id:          '',
  title:               '',
  amount:              '',
  category:            'materiel',
  expense_date:        '',
  notes:               '',
  budget_reference_id: null as string | null,
  mode:                'approval' as 'approval' | 'archive', // nouveau
  assignees:           [] as string[],                        // nouveau
}

const STATUS_STYLE: Record<string, { cls: string; label: string; icon: React.ReactNode }> = {
  pending:  { cls: 'bg-yellow-50 text-yellow-700',  label: 'En attente', icon: <Clock className="w-3 h-3" /> },
  approved: { cls: 'bg-green-50 text-green-700',    label: 'Approuvée',  icon: <Check className="w-3 h-3" /> },
  rejected: { cls: 'bg-red-50 text-red-700',        label: 'Refusée',    icon: <X className="w-3 h-3" /> },
}

function DeleteConfirmModal({
  expense, onClose, onConfirm, loading,
}: { expense: any; onClose: () => void; onConfirm: () => void; loading: boolean }) {
  const isApproved = expense.status === 'approved'
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Mettre à la corbeille ?</h3>
            <p className="text-xs text-gray-500 mt-0.5">Peut être restauré depuis la corbeille</p>
          </div>
        </div>
        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100 space-y-1">
          <p className="text-sm font-semibold text-gray-900">{expense.title}</p>
          <p className="text-xs text-gray-500">{(expense.amount ?? 0).toLocaleString('fr-MA')} MAD · {STATUS_STYLE[expense.status]?.label}</p>
        </div>
        {isApproved && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            Cette dépense est approuvée. La suppression est réservée aux administrateurs et directeurs.
          </p>
        )}
        <div className="flex justify-end gap-3 pt-1">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Annuler</button>
          <button onClick={onConfirm} disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-40">
            {loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            {loading ? 'Suppression…' : 'Mettre à la corbeille'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ExpensesPage() {
  const [expenses,       setExpenses]       = useState<any[]>([])
  const [projects,       setProjects]       = useState<any[]>([])
  const [members,        setMembers]        = useState<any[]>([])
  const [profile,        setProfile]        = useState<{ id: string; role: string; full_name: string } | null>(null)
  const [showForm,       setShowForm]       = useState(false)
  const [loading,        setLoading]        = useState(false)
  const [form,           setForm]           = useState(EMPTY_FORM)
  const [confirmExpense, setConfirmExpense] = useState<any>(null)
  const [deleting,       setDeleting]       = useState(false)
  const [aiSuggesting,   setAiSuggesting]   = useState(false)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: prof }, projectsRes, expensesRes, { data: membersData }] = await Promise.all([
      supabase.from('profiles').select('role, full_name').eq('id', user.id).single(),
      fetch('/api/projects/list'),
      supabase
        .from('expenses')
        .select('*, submitted_by_profile:profiles!expenses_submitted_by_fkey(full_name)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, full_name, role').order('full_name'),
    ])

    setProfile(prof ? { ...prof, id: user.id } : null)
    if (projectsRes.ok) setProjects(await projectsRes.json())
    if (expensesRes.data) setExpenses(expensesRes.data)
    setMembers(membersData ?? [])
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.project_id || !form.title || !form.amount || !form.expense_date) return
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const isSelfReported = form.mode === 'archive'

    // FIN-05 — création via API pour valider budget_reference_id actif côté serveur
    const res = await fetch('/api/expenses', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        project_id:          form.project_id,
        title:               form.title.trim(),
        amount:              parseFloat(form.amount),
        category:            form.category,
        expense_date:        form.expense_date,
        notes:               form.notes.trim() || null,
        mode:                form.mode,
        assignees:           form.assignees.length > 0 ? form.assignees : undefined,
        budget_reference_id: form.budget_reference_id ?? null,
      }),
    })
    const json = await res.json().catch(() => ({}))

    setLoading(false)
    if (!res.ok) { toast.error(json.error ?? 'Erreur lors de la création'); return }

    toast.success(isSelfReported ? 'Dépense archivée avec succès' : 'Demande d\'approbation soumise')
    setShowForm(false)
    setForm(EMPTY_FORM)
    await load()
  }

  async function suggestCategory() {
    if (!form.title.trim() || form.title.trim().length < 3) return
    setAiSuggesting(true)
    try {
      const res = await fetch('/api/ai/expense-category', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: form.title }),
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      if (data.category) {
        const mapped = AI_CATEGORY_TO_DROPDOWN[data.category] ?? 'autre'
        setForm(f => ({ ...f, category: mapped }))
        toast.success(`Catégorie suggérée : ${data.label}`)
      }
    } catch {
      toast.error('Suggestion indisponible')
    } finally {
      setAiSuggesting(false)
    }
  }

  async function handleApprove(expenseId: string, approve: boolean) {
    const route = approve ? 'approve' : 'reject'
    const res  = await fetch(`/api/expenses/${expenseId}/${route}`, { method: 'POST' })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? `Erreur lors de l'${approve ? 'approbation' : 'rejet'}`)
      return
    }
    if (approve && json.budget_warning) {
      toast.warning(`Dépense approuvée — ⚠️ ${json.budget_warning}`, { duration: 8000 })
    } else {
      toast.success(approve ? 'Dépense approuvée' : 'Dépense rejetée')
    }
    await load()
  }

  async function handleDelete() {
    if (!confirmExpense) return
    setDeleting(true)
    const res  = await fetch(`/api/expenses/${confirmExpense.id}/delete`, { method: 'DELETE' })
    const json = await res.json()
    setDeleting(false)
    if (!res.ok) {
      toast.error(json.error ?? 'Erreur lors de la suppression')
    } else {
      toast.success(`« ${json.title} » déplacé dans la corbeille`)
      setConfirmExpense(null)
      setExpenses(prev => prev.filter(e => e.id !== confirmExpense.id))
    }
  }

  function canDelete(expense: any) {
    if (!profile) return false
    const isPrivileged = ['admin', 'directeur'].includes(profile.role)
    const isOwner      = expense.submitted_by === profile.id
    if (expense.status === 'approved') return isPrivileged
    return isPrivileged || isOwner
  }

  const isAdmin       = ['admin', 'directeur'].includes(profile?.role ?? '')
  // Devise d'affichage : MAD par défaut (les dépenses n'ont pas leur propre devise)
  const totalPending  = expenses.filter(e => e.status === 'pending').reduce((s, e) => s + (e.amount ?? 0), 0)
  const totalApproved = expenses.filter(e => e.status === 'approved').reduce((s, e) => s + (e.amount ?? 0), 0)
  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <div className="space-y-8 max-w-5xl">
      {confirmExpense && (
        <DeleteConfirmModal
          expense={confirmExpense}
          onClose={() => setConfirmExpense(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Dépenses</h1>
          <p className="text-sm text-gray-500 mt-0.5">Suivi des dépenses et justificatifs</p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
          <Plus className="w-4 h-4" /> Nouvelle dépense
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'En attente',  value: `${totalPending.toLocaleString('fr-MA')} MAD`,  cls: 'text-yellow-600' },
          { label: 'Approuvées',  value: `${totalApproved.toLocaleString('fr-MA')} MAD`, cls: 'text-green-600' },
          { label: 'Total',       value: `${expenses.length} dépense${expenses.length > 1 ? 's' : ''}`, cls: 'text-gray-900' },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className={`text-xl font-bold ${s.cls}`}>{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Modal formulaire */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-lg p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900">Nouvelle dépense</h3>

            {/* ── Mode selector ─────────────────────────────── */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, mode: 'archive' }))}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-left transition ${
                  form.mode === 'archive'
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <Archive className={`w-5 h-5 ${form.mode === 'archive' ? 'text-green-600' : 'text-gray-400'}`} />
                <div>
                  <p className={`text-xs font-semibold ${form.mode === 'archive' ? 'text-green-700' : 'text-gray-700'}`}>Déjà réalisée</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Archivage direct, sans validation</p>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setForm(f => ({ ...f, mode: 'approval' }))}
                className={`flex flex-col items-center gap-2 p-3 rounded-xl border-2 text-left transition ${
                  form.mode === 'approval'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
              >
                <FileCheck className={`w-5 h-5 ${form.mode === 'approval' ? 'text-blue-600' : 'text-gray-400'}`} />
                <div>
                  <p className={`text-xs font-semibold ${form.mode === 'approval' ? 'text-blue-700' : 'text-gray-700'}`}>Demande d'approbation</p>
                  <p className="text-[10px] text-gray-400 mt-0.5">Envoyée pour validation</p>
                </div>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Projet *</label>
                <ProjectSearchInput
                  projects={projects}
                  value={form.project_id}
                  onChange={(id) => setForm(f => ({
                    ...f,
                    project_id: id,
                    budget_reference_id: id !== f.project_id ? null : f.budget_reference_id,
                  }))}
                  disabled={loading}
                />
                <input type="text" required value={form.project_id} onChange={() => {}} className="sr-only" tabIndex={-1} aria-hidden />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
                <input className={inputCls} value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Ex : Billet de train Rabat–Casa" required />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Montant (MAD) *</label>
                  <input type="number" min="0" step="0.01" className={inputCls} value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} required />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                  <input type="date" className={inputCls} value={form.expense_date}
                    onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} required />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Catégorie</label>
                  <button
                    type="button"
                    onClick={suggestCategory}
                    disabled={aiSuggesting || !form.title.trim()}
                    className="inline-flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 font-medium transition disabled:opacity-40"
                  >
                    {aiSuggesting
                      ? <RefreshCw className="w-3 h-3 animate-spin" />
                      : <Sparkles className="w-3 h-3" />
                    }
                    {aiSuggesting ? 'Suggestion…' : 'Suggérer via IA'}
                  </button>
                </div>
                <select className={inputCls} value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                  {EXPENSE_CATEGORIES.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Référence budgétaire <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <BudgetReferenceSelector
                  programId={projects.find(p => p.id === form.project_id)?.program_id ?? null}
                  value={form.budget_reference_id}
                  onChange={id => setForm(f => ({ ...f, budget_reference_id: id }))}
                  disabled={loading || !form.project_id}
                />
              </div>

              {/* ── Personnes concernées ────────────────────── */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Personnes concernées <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <PeopleSearchInput
                  people={members}
                  value={form.assignees}
                  onChange={ids => setForm(f => ({ ...f, assignees: ids }))}
                  disabled={loading}
                  excludeIds={profile ? [profile.id] : []}
                  placeholder="À la demande de… / Concerne…"
                />
                {form.assignees.length > 0 && (
                  <p className="text-[10px] text-gray-400 mt-1">
                    Ces personnes seront associées à la dépense
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea className={inputCls + ' resize-none'} rows={2} value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Détails supplémentaires…" />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setForm(EMPTY_FORM) }}
                  className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
                  Annuler
                </button>
                <button type="submit" disabled={loading}
                  className={`inline-flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg disabled:opacity-50 transition ${
                    form.mode === 'archive' ? 'bg-green-600 hover:bg-green-700' : 'bg-blue-600 hover:bg-blue-700'
                  }`}>
                  {loading
                    ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    : form.mode === 'archive' ? <Archive className="w-3.5 h-3.5" /> : <FileCheck className="w-3.5 h-3.5" />
                  }
                  {loading ? 'Envoi…' : form.mode === 'archive' ? 'Archiver' : 'Soumettre'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Liste */}
      {expenses.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-20 text-center">
          <Wallet className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Aucune dépense enregistrée</p>
          <button onClick={() => setShowForm(true)} className="mt-3 text-sm text-blue-600 hover:underline">
            Soumettre la première dépense →
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Titre</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden md:table-cell">Catégorie</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Soumis par</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide hidden lg:table-cell">Date</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Montant</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Statut</th>
                <th className="px-4 py-3 w-28" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {expenses.map(e => {
                const s = STATUS_STYLE[e.status] ?? STATUS_STYLE.pending
                const catLabel = LABELS.expense_category[e.category as keyof typeof LABELS.expense_category] ?? e.category
                const assigneeProfiles = members.filter(m => (e.assignees ?? []).includes(m.id))
                return (
                  <tr key={e.id} className="group hover:bg-gray-50/50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-start gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="font-medium text-gray-800">{e.title}</p>
                            {e.is_self_reported && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-600 font-medium border border-green-100">
                                <Archive className="w-2.5 h-2.5" /> Archivée
                              </span>
                            )}
                          </div>
                          {e.notes && <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{e.notes}</p>}
                          {/* Assignés */}
                          {assigneeProfiles.length > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <div className="flex -space-x-1">
                                {assigneeProfiles.slice(0, 3).map(p => (
                                  <div key={p.id} title={p.full_name}
                                    className="w-4 h-4 rounded-full bg-blue-200 border border-white flex items-center justify-center text-[8px] font-bold text-blue-700">
                                    {getInitials(p.full_name)}
                                  </div>
                                ))}
                              </div>
                              <span className="text-[10px] text-gray-400">
                                {assigneeProfiles.length === 1
                                  ? assigneeProfiles[0].full_name
                                  : `${assigneeProfiles.length} personnes concernées`}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-gray-500 text-xs">{catLabel}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-500 text-xs">
                      {e.submitted_by_profile?.full_name ?? '—'}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-gray-400 text-xs">{formatDate(e.expense_date)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {(e.amount ?? 0).toLocaleString('fr-MA')} MAD
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${s.cls}`}>
                        {s.icon}{s.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        {isAdmin && e.status === 'pending' && !e.is_self_reported && (
                          <>
                            <button onClick={() => handleApprove(e.id, true)}
                              className="p-1.5 rounded-lg text-green-600 hover:bg-green-50 transition" title="Approuver">
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleApprove(e.id, false)}
                              className="p-1.5 rounded-lg text-red-500 hover:bg-red-50 transition" title="Refuser">
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {canDelete(e) && (
                          <button onClick={() => setConfirmExpense(e)}
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 transition opacity-0 group-hover:opacity-100"
                            title="Mettre à la corbeille">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}

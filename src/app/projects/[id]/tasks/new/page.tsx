'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ArrowLeft, Paperclip, Upload, X, Sparkles, RefreshCw, Tag, Info } from 'lucide-react'
import Link from 'next/link'
import { cn, formatFileSize } from '@/lib/utils'
import BudgetReferenceSelector from '@/components/budget/BudgetReferenceSelector'
import AITaskAssistant from './_components/AITaskAssistant'

// ─── Types ────────────────────────────────────────────────────────────────────

type PendingFile = {
  id: string
  file: File
  tag: string
}

const MAX_SIZE = 20 * 1024 * 1024
const ALLOWED_EXT = /\.(pdf|docx?|xlsx?|png|jpe?g|gif|webp|zip|txt)$/i

const TAG_OPTIONS: { value: string; label: string }[] = [
  { value: 'proof',       label: 'Preuve' },
  { value: 'invoice',     label: 'Facture' },
  { value: 'deliverable', label: 'Livrable' },
  { value: 'report',      label: 'Rapport' },
  { value: 'screenshot',  label: 'Capture' },
  { value: 'other',       label: 'Autre' },
]

// ─── Étiquettes Besoins (même structure que NeedsSelector) ───────────────────

export const LABEL_CATEGORIES = [
  {
    key: 'logistique',
    emoji: '🏨',
    label: 'Logistique',
    color: 'blue',
    bgSelected: 'bg-blue-600 text-white border-blue-600',
    bgHover: 'hover:bg-blue-50 hover:border-blue-300',
    items: [
      { id: 'hebergement',   label: 'Hébergement' },
      { id: 'parking',       label: 'Parking' },
      { id: 'transport',     label: 'Transport' },
      { id: 'catering',      label: 'Catering' },
      { id: 'billets_avion', label: 'Billets avion' },
      { id: 'salle',         label: 'Réservation salle' },
      { id: 'materiel',      label: 'Matériel' },
      { id: 'autre_log',     label: 'Autre…' },
    ],
  },
  {
    key: 'communication',
    emoji: '📢',
    label: 'Communication',
    color: 'purple',
    bgSelected: 'bg-purple-600 text-white border-purple-600',
    bgHover: 'hover:bg-purple-50 hover:border-purple-300',
    items: [
      { id: 'design',       label: 'Design / Visuels' },
      { id: 'presentation', label: 'Présentation' },
      { id: 'formulaire',   label: 'Formulaire' },
      { id: 'reseaux',      label: 'Réseaux sociaux' },
      { id: 'email',        label: 'Campagne email' },
      { id: 'video',        label: 'Vidéo / Photo' },
      { id: 'site_web',     label: 'Page web' },
      { id: 'autre_com',    label: 'Autre…' },
    ],
  },
  {
    key: 'administratif',
    emoji: '📋',
    label: 'Administratif',
    color: 'orange',
    bgSelected: 'bg-orange-600 text-white border-orange-600',
    bgHover: 'hover:bg-orange-50 hover:border-orange-300',
    items: [
      { id: 'demande_achat',   label: "Demande d'achat" },
      { id: 'validation_docs', label: 'Validation docs' },
      { id: 'factures',        label: 'Factures / BC' },
      { id: 'contrats',        label: 'Contrats' },
      { id: 'rapport',         label: 'Rapport final' },
      { id: 'certificats',     label: 'Certificats' },
      { id: 'autre_adm',       label: 'Autre…' },
    ],
  },
]

export function getLabelMeta(labelId: string) {
  for (const cat of LABEL_CATEGORIES) {
    const item = cat.items.find(i => i.id === labelId)
    if (item) return { label: item.label, emoji: cat.emoji, category: cat.key, bgSelected: cat.bgSelected, color: cat.color }
  }
  return null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function validate(f: File): string | null {
  if (f.size === 0) return `${f.name} est vide`
  if (f.size > MAX_SIZE) return `${f.name} dépasse 20 Mo`
  if (!ALLOWED_EXT.test(f.name)) return `${f.name} : type non autorisé`
  return null
}

function makeId() { return Math.random().toString(36).slice(2) }

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewTaskPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()

  const [loading, setLoading] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [members, setMembers] = useState<{ id: string; full_name: string }[]>([])
  const [programId, setProgramId] = useState<string | null>(null)
  const [projectTitle, setProjectTitle] = useState<string>('')

  const [form, setForm] = useState({
    title: '', description: '', priority: 'medium',
    due_date: '', assigned_to: '',
  })

  // Étiquette
  const [selectedLabel, setSelectedLabel] = useState<string | null>(null)
  const [showLabelSelector, setShowLabelSelector] = useState(false)

  // Budget IA
  const [budgetReferenceId, setBudgetReferenceId] = useState<string | null>(null)
  const [budgetSuggestion, setBudgetSuggestion] = useState<{
    id: string; code: string; designation: string; confidence: string
  } | null>(null)
  const [budgetSuggesting, setBudgetSuggesting] = useState(false)
  const budgetDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Pièces jointes
  const [pending, setPending] = useState<PendingFile[]>([])
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Suggestion assignation IA
  const [assignSuggestion, setAssignSuggestion] = useState<{
    memberId: string; full_name: string; reason: string
  } | null>(null)
  const [assignSuggesting, setAssignSuggesting] = useState(false)

  useEffect(() => {
    async function init() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) setCurrentUserId(user.id)
      try {
        const res = await fetch(`/api/projects/${id}/members`)
        if (res.ok) {
          const data = await res.json()
          setMembers(data.map((m: { profile?: { id: string; full_name: string } }) => m.profile).filter(Boolean))
        }
      } catch { /* ignorer */ }
      try {
        const { data } = await supabase.from('projects').select('program_id, title').eq('id', id).single()
        if (data?.program_id) setProgramId(data.program_id)
        if (data?.title) setProjectTitle(data.title)
      } catch { /* ignorer */ }
    }
    init()
  }, [id])

  // ── Suggestion budget IA ────────────────────────────────────────────────
  const suggestBudget = useCallback(async (title: string) => {
    if (!title || title.length < 4) return
    setBudgetSuggesting(true)
    setBudgetSuggestion(null)
    try {
      const res = await fetch('/api/ai/task-budget-suggest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, projectId: id }),
      })
      if (!res.ok) return
      const data = await res.json()
      if (data?.id) setBudgetSuggestion(data)
    } catch { /* silencieux */ }
    finally { setBudgetSuggesting(false) }
  }, [id])

  useEffect(() => {
    if (budgetDebounceRef.current) clearTimeout(budgetDebounceRef.current)
    if (form.title.length >= 4 && programId && !budgetReferenceId) {
      budgetDebounceRef.current = setTimeout(() => suggestBudget(form.title), 700)
    }
    return () => { if (budgetDebounceRef.current) clearTimeout(budgetDebounceRef.current) }
  }, [form.title, programId, budgetReferenceId, suggestBudget])

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function suggestAssign() {
    if (members.length === 0) return
    setAssignSuggesting(true)
    setAssignSuggestion(null)
    try {
      const res = await fetch('/api/ai/task-assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: form.title, tasks: [], members }),
      })
      if (!res.ok) throw new Error()
      setAssignSuggestion(await res.json())
    } catch { toast.error('Suggestion indisponible') }
    finally { setAssignSuggesting(false) }
  }

  function handleFiles(files: FileList | File[]) {
    const next: PendingFile[] = []
    for (const f of Array.from(files)) {
      const err = validate(f)
      if (err) { toast.error(err); continue }
      next.push({ id: makeId(), file: f, tag: 'other' })
    }
    if (next.length > 0) setPending(p => [...p, ...next])
  }

  function removePending(pid: string) { setPending(p => p.filter(x => x.id !== pid)) }
  function setPendingTag(pid: string, tag: string) { setPending(p => p.map(x => x.id === pid ? { ...x, tag } : x)) }
  function onDragOver(e: React.DragEvent) { e.preventDefault(); setDragOver(true) }
  function onDragLeave(e: React.DragEvent) { e.preventDefault(); setDragOver(false) }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files)
  }

  // ── Dérivés ─────────────────────────────────────────────────────────────
  const isAssignedToOther = !!form.assigned_to && form.assigned_to !== currentUserId
  const selectedLabelMeta = selectedLabel ? getLabelMeta(selectedLabel) : null

  // ── Soumission — utilise /api/tasks pour activer le hook Drive ───────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) return
    setLoading(true)

    const payload: Record<string, unknown> = {
      project_id: id,
      title: form.title.trim(),
      description: form.description.trim() || null,
      priority: form.priority,
      due_date: form.due_date || null,
      assigned_to: form.assigned_to || null,
      label: selectedLabel ?? null,
      budget_reference_id: budgetReferenceId ?? null,
    }
    // Le statut est géré côté serveur (pending_acceptance si assigned_to !== user)

    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      toast.error(body?.error ?? 'Création échouée')
      setLoading(false)
      return
    }

    const created = await res.json()
    const taskId = created.id

    // Upload des pièces jointes
    if (pending.length > 0) {
      let uploaded = 0
      for (let i = 0; i < pending.length; i++) {
        const item = pending[i]
        toast.message(`Upload ${i + 1}/${pending.length}…`, { description: item.file.name })
        try {
          const fd = new FormData()
          fd.append('file', item.file)
          fd.append('document_tag', item.tag)
          const r = await fetch(`/api/tasks/${taskId}/documents`, { method: 'POST', body: fd })
          if (r.ok) uploaded++
          else {
            const b = await r.json().catch(() => ({}))
            toast.error(`${item.file.name} : ${b?.error ?? 'échec'}`)
          }
        } catch (err) {
          toast.error(`${item.file.name} : ${err instanceof Error ? err.message : 'erreur'}`)
        }
      }
      if (uploaded > 0) toast.success(`${uploaded}/${pending.length} document(s) joint(s)`)
    }

    toast.success(created.ref_number ? `Tâche ${created.ref_number} créée` : 'Tâche créée')
    router.push(`/projects/${id}`)
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/projects/${id}`} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nouvelle tâche</h1>
          <p className="text-sm text-gray-500 mt-0.5">Ajouter une tâche au projet</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">

        {/* Titre */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Titre *</label>
          <input type="text" value={form.title} onChange={e => set('title', e.target.value)}
            placeholder="Ex: Préparer le support de présentation"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={form.description} onChange={e => set('description', e.target.value)}
            placeholder="Détails, contexte, critères d'acceptation..."
            rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {/* Assistant IA */}
        <AITaskAssistant
          title={form.title}
          projectTitle={projectTitle}
          onApply={({ description, priority, subtasks, label: suggestedLabel }) => {
            if (description) set('description', description)
            if (priority)    set('priority', priority)
            if (suggestedLabel && !selectedLabel) setSelectedLabel(suggestedLabel)
            if (subtasks && subtasks.length > 0) {
              const checklist = '\n\n**Étapes :**\n' + subtasks.map((s, i) => `${i + 1}. ${s}`).join('\n')
              setForm(f => ({ ...f, description: (f.description || '') + checklist }))
            }
          }}
        />

        {/* ── Étiquette Besoin ─────────────────────────────────────────────── */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-700 flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-gray-400" />
              Étiquette <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            {selectedLabel && (
              <button type="button" onClick={() => { setSelectedLabel(null); setShowLabelSelector(false) }}
                className="text-xs text-red-500 hover:text-red-700 transition flex items-center gap-1">
                <X className="w-3 h-3" /> Retirer
              </button>
            )}
          </div>

          {selectedLabel && selectedLabelMeta ? (
            <div onClick={() => setShowLabelSelector(v => !v)}
              className="cursor-pointer flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 hover:border-gray-300 transition">
              <span>{selectedLabelMeta.emoji}</span>
              <span className="text-sm font-medium text-gray-800">{selectedLabelMeta.label}</span>
              <span className="ml-auto text-xs text-gray-400">Changer</span>
            </div>
          ) : (
            <button type="button" onClick={() => setShowLabelSelector(v => !v)}
              className="w-full px-3 py-2 border border-dashed border-gray-300 rounded-lg text-sm text-gray-500 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition text-left">
              + Choisir une étiquette
            </button>
          )}

          {showLabelSelector && (
            <div className="mt-2 border border-gray-200 rounded-xl p-3 bg-gray-50 space-y-3">
              {LABEL_CATEGORIES.map(cat => (
                <div key={cat.key}>
                  <p className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    {cat.emoji} {cat.label}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {cat.items.map(item => (
                      <button key={item.id} type="button"
                        onClick={() => { setSelectedLabel(item.id); setShowLabelSelector(false) }}
                        className={cn(
                          'px-2.5 py-1 rounded-full border text-xs font-medium transition',
                          selectedLabel === item.id
                            ? cat.bgSelected
                            : `border-gray-200 bg-white text-gray-700 ${cat.bgHover}`
                        )}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Priorité + Assignation */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priorité</label>
            <select value={form.priority} onChange={e => set('priority', e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="low">Faible</option>
              <option value="medium">Moyen</option>
              <option value="high">Élevé</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Assigné à</label>
              {members.length > 0 && (
                <button type="button" onClick={suggestAssign} disabled={assignSuggesting}
                  className="inline-flex items-center gap-1 text-[11px] text-violet-600 hover:text-violet-800 font-medium transition disabled:opacity-40">
                  {assignSuggesting ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  {assignSuggesting ? 'Analyse…' : 'Suggérer via IA'}
                </button>
              )}
            </div>
            <select value={form.assigned_to}
              onChange={e => { set('assigned_to', e.target.value); setAssignSuggestion(null) }}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Non assigné</option>
              {members.map(m => <option key={m.id} value={m.id}>{m.full_name}</option>)}
            </select>
            {assignSuggestion && (
              <div className="mt-1.5 flex items-start gap-2 p-2 bg-violet-50 rounded-lg border border-violet-100">
                <Sparkles className="w-3 h-3 text-violet-500 mt-0.5 shrink-0" />
                <p className="flex-1 text-[11px] text-violet-700">{assignSuggestion.reason}</p>
                <button type="button"
                  onClick={() => { set('assigned_to', assignSuggestion.memberId); setAssignSuggestion(null) }}
                  className="shrink-0 text-[11px] font-medium text-violet-700 bg-violet-100 px-2 py-0.5 rounded hover:bg-violet-200 transition">
                  Appliquer
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Alerte : statut auto si assigné à une autre personne */}
        {isAssignedToOther && (
          <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-lg">
            <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              La tâche sera mise en <strong>attente d'acceptation</strong>. La personne devra l'accepter ou la refuser.
            </p>
          </div>
        )}

        {/* Échéance */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Échéance</label>
          <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        {/* Référence budgétaire */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="block text-sm font-medium text-gray-700">
              Référence budgétaire <span className="text-gray-400 font-normal">(optionnel)</span>
            </label>
            {budgetSuggesting && (
              <span className="flex items-center gap-1 text-[11px] text-violet-500">
                <RefreshCw className="w-3 h-3 animate-spin" /> Analyse…
              </span>
            )}
          </div>

          {budgetSuggestion && !budgetReferenceId && (
            <div className="mb-2 flex items-center gap-2 p-2 bg-violet-50 rounded-lg border border-violet-100">
              <Sparkles className="w-3 h-3 text-violet-500 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-violet-700 font-medium">
                  Suggéré : <strong>{budgetSuggestion.code} — {budgetSuggestion.designation}</strong>
                </p>
                <p className="text-[10px] text-violet-500">
                  {budgetSuggestion.confidence === 'high' ? 'Correspondance forte' : 'Correspondance probable'}
                </p>
              </div>
              <button type="button"
                onClick={() => { setBudgetReferenceId(budgetSuggestion.id); setBudgetSuggestion(null) }}
                className="shrink-0 text-[11px] font-medium text-violet-700 bg-violet-100 px-2 py-0.5 rounded hover:bg-violet-200 transition">
                Appliquer
              </button>
              <button type="button" onClick={() => setBudgetSuggestion(null)} className="text-gray-400 hover:text-gray-600">
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <BudgetReferenceSelector
            programId={programId}
            value={budgetReferenceId}
            onChange={setBudgetReferenceId}
            disabled={loading}
          />
        </div>

        {/* Pièces jointes */}
        <div>
          <div className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-2">
            <Paperclip className="w-3.5 h-3.5 text-gray-500" />
            <span>Pièces jointes <span className="text-gray-400 font-normal">(optionnel)</span></span>
          </div>
          <div
            onClick={() => !loading && fileInputRef.current?.click()}
            onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
            className={cn(
              'cursor-pointer rounded-lg border-2 border-dashed px-4 flex flex-col items-center justify-center text-center transition h-[100px]',
              dragOver
                ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-violet-50'
                : 'border-gray-200 hover:border-blue-300 hover:bg-blue-50/30'
            )}>
            <Upload className="w-4 h-4 text-blue-500" />
            <p className="text-xs font-medium text-gray-700 mt-1">Glissez vos fichiers ou cliquez pour parcourir</p>
            <p className="text-[10px] text-gray-400">PDF, DOCX, XLSX, images, ZIP · max 20 Mo</p>
            <input ref={fileInputRef} type="file" hidden multiple
              onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }} />
          </div>

          {pending.length > 0 && (
            <div className="mt-2 space-y-1.5">
              {pending.map(p => (
                <div key={p.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                  <Paperclip className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-gray-800 truncate">{p.file.name}</p>
                    <p className="text-[10px] text-gray-500">{formatFileSize(p.file.size)}</p>
                  </div>
                  <select value={p.tag} onChange={e => setPendingTag(p.id, e.target.value)} disabled={loading}
                    className="text-[11px] border border-gray-200 rounded px-1.5 py-0.5 bg-white focus:outline-none">
                    {TAG_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                  <button type="button" onClick={() => removePending(p.id)} disabled={loading}
                    className="p-1 text-gray-400 hover:text-red-500 transition">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link href={`/projects/${id}`} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition">
            Annuler
          </Link>
          <button type="submit" disabled={loading || !form.title.trim()}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
            {loading ? 'Création...' : 'Créer la tâche'}
          </button>
        </div>
      </form>
    </div>
  )
}

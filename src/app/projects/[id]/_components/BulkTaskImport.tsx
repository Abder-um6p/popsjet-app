'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Copy, CheckCheck, ChevronRight, ChevronLeft,
  Trash2, Check, X, RefreshCw, Users, AlertTriangle, ListChecks,
} from 'lucide-react'
import { toast } from 'sonner'

interface Member { id: string; full_name: string }

interface Project {
  id:          string
  title:       string
  type?:       string
  start_date?: string | null
  end_date?:   string | null
  description?: string | null
}

interface ParsedTask {
  _id:         string
  title:       string
  description: string
  priority:    'low' | 'medium' | 'high' | 'urgent'
  status:      'todo' | 'in_progress' | 'review' | 'done'
  due_date:    string
  assigned_to: string
  label:       string
  validated:   boolean
}

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  low:    { label: 'Faible',  cls: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Moyen',   cls: 'bg-yellow-100 text-yellow-700' },
  high:   { label: 'Élevé',   cls: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent',  cls: 'bg-red-100 text-red-700' },
}

function makeId() { return Math.random().toString(36).slice(2) }

function buildPrompt(project: Project, members: Member[]): string {
  const memberList = members.length > 0
    ? members.map(m => `- ${m.full_name} (id: ${m.id})`).join('\n')
    : '(aucun membre renseigné)'

  return `Tu es un assistant de gestion de projet pour l'I&E Lab de l'UM6P.

Contexte du projet :
- Titre : ${project.title}
${project.type ? `- Type : ${project.type}` : ''}
${project.description ? `- Description : ${project.description}` : ''}
${project.start_date ? `- Date de début : ${project.start_date}` : ''}
${project.end_date ? `- Date de fin : ${project.end_date}` : ''}

Membres disponibles pour assignation :
${memberList}

---

Je vais te décrire une série de tâches à réaliser dans ce projet.
Génère-les au format JSON strict, sans texte autour, uniquement le tableau JSON :

[
  {
    "title": "Titre court et clair de la tâche",
    "description": "Description détaillée avec contexte et critères d'acceptation",
    "priority": "low | medium | high | urgent",
    "due_date": "YYYY-MM-DD ou null",
    "assigned_to": "id du membre ou null",
    "label": "étiquette ou null"
  }
]

Règles :
- priority : urgent si délai critique, high si important, medium par défaut, low si secondaire
- due_date : estimer une date réaliste en fonction du projet, ou null
- assigned_to : utiliser l'id exact du membre si pertinent, sinon null — si assigned_to est défini, le statut sera automatiquement "pending_acceptance" (ne pas inclure status dans le JSON)
- Ne pas inventer de membres — utiliser uniquement ceux listés ci-dessus
- label : choisir parmi (ou null) : hebergement, parking, transport, catering, billets_avion, salle, materiel, autre_log, design, presentation, formulaire, reseaux, email, video, site_web, autre_com, demande_achat, validation_docs, factures, contrats, rapport, certificats, autre_adm

---

Voici mes tâches à créer :`
}

function parseTasks(raw: string): ParsedTask[] {
  // Extraire le JSON — chercher le premier [ ... ]
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Aucun tableau JSON trouvé')
  const arr = JSON.parse(match[0])
  if (!Array.isArray(arr)) throw new Error('Format invalide')

  return arr
    .filter((t: any) => t.title)
    .map((t: any): ParsedTask => {
      const assignedTo = t.assigned_to && t.assigned_to !== 'null' ? String(t.assigned_to) : ''
      return {
        _id:         makeId(),
        title:       String(t.title ?? '').trim(),
        description: String(t.description ?? '').trim(),
        priority:    ['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium',
        // Si assigné à quelqu'un → pending_acceptance, sinon todo
        status:      assignedTo ? 'pending_acceptance' as 'todo' : 'todo',
        due_date:    t.due_date && t.due_date !== 'null' ? t.due_date : '',
        assigned_to: assignedTo,
        label:       t.label && t.label !== 'null' ? String(t.label) : '',
        validated:   false,
      }
    })
}

interface Props {
  project:  Project
  members:  Member[]
  projectId: string
}

export default function BulkTaskImport({ project, members, projectId }: Props) {
  const router = useRouter()
  const [open,      setOpen]      = useState(false)
  const [step,      setStep]      = useState<1 | 2>(1)
  const [copied,    setCopied]    = useState(false)
  const [raw,       setRaw]       = useState('')
  const [parseErr,  setParseErr]  = useState('')
  const [tasks,     setTasks]     = useState<ParsedTask[]>([])
  const [submitting, setSubmitting] = useState(false)

  const prompt = buildPrompt(project, members)

  function handleCopy() {
    navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function handleParse() {
    setParseErr('')
    try {
      const parsed = parseTasks(raw)
      if (parsed.length === 0) { setParseErr('Aucune tâche détectée dans le texte collé.'); return }
      setTasks(parsed)
      setStep(2)
    } catch (e: any) {
      setParseErr('Format non reconnu. Assurez-vous de coller la réponse JSON de l\'IA.')
    }
  }

  function updateTask(id: string, field: keyof ParsedTask, value: any) {
    setTasks(prev => prev.map(t => t._id === id ? { ...t, [field]: value } : t))
  }

  function removeTask(id: string) {
    setTasks(prev => prev.filter(t => t._id !== id))
  }

  function toggleValidate(id: string) {
    setTasks(prev => prev.map(t => t._id === id ? { ...t, validated: !t.validated } : t))
  }

  const validatedTasks = tasks.filter(t => t.validated)

  async function handleCreate() {
    if (validatedTasks.length === 0) { toast.error('Validez au moins une tâche'); return }
    setSubmitting(true)
    const res = await fetch(`/api/projects/${projectId}/tasks/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tasks: validatedTasks.map(t => ({
          title:       t.title,
          description: t.description || null,
          priority:    t.priority,
          // Si assigné à quelqu'un → pending_acceptance géré côté serveur
          status:      t.assigned_to ? 'pending_acceptance' : t.status,
          due_date:    t.due_date || null,
          assigned_to: t.assigned_to || null,
          label:       t.label || null,
        })),
      }),
    })
    const json = await res.json()
    setSubmitting(false)
    if (!res.ok) { toast.error(json.error ?? 'Erreur'); return }
    toast.success(`${json.created} tâche${json.created > 1 ? 's' : ''} créée${json.created > 1 ? 's' : ''}`)
    setOpen(false)
    setStep(1)
    setRaw('')
    setTasks([])
    router.refresh()
  }

  function handleClose() {
    setOpen(false)
    setStep(1)
    setRaw('')
    setTasks([])
    setParseErr('')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 text-xs font-medium rounded-lg transition"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Import IA
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-blue-50 shrink-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h2 className="text-base font-semibold text-gray-900">Import de tâches en masse</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {step === 1 ? 'Étape 1 — Copier le prompt et générer vos tâches' : `Étape 2 — Valider et assigner (${validatedTasks.length}/${tasks.length} validée${validatedTasks.length > 1 ? 's' : ''})`}
                </p>
              </div>
              {/* Steps indicator */}
              <div className="flex items-center gap-1.5">
                {[1, 2].map(s => (
                  <div key={s} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition
                    ${step === s ? 'bg-violet-600 text-white' : step > s ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {step > s ? <Check className="w-3 h-3" /> : s}
                  </div>
                ))}
              </div>
              <button onClick={handleClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto">

              {/* ── ÉTAPE 1 ── */}
              {step === 1 && (
                <div className="p-6 space-y-4">
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700 leading-relaxed">
                    <p className="font-semibold mb-1">Comment ça marche ?</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Copiez le prompt ci-dessous</li>
                      <li>Collez-le dans <strong>ChatGPT</strong> ou <strong>Claude</strong> et décrivez vos tâches</li>
                      <li>Copiez la réponse JSON générée par l'IA</li>
                      <li>Collez-la dans le champ de l'étape suivante</li>
                    </ol>
                  </div>

                  {/* Prompt */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700">Prompt à copier</label>
                      <button
                        type="button"
                        onClick={handleCopy}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                          copied ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                        }`}
                      >
                        {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copié !' : 'Copier'}
                      </button>
                    </div>
                    <pre className="text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-auto max-h-52 whitespace-pre-wrap leading-relaxed font-mono">
                      {prompt}
                    </pre>
                  </div>

                  {/* Paste area */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Coller la réponse de l'IA (JSON)
                    </label>
                    <textarea
                      value={raw}
                      onChange={e => { setRaw(e.target.value); setParseErr('') }}
                      rows={6}
                      placeholder={'[\n  {\n    "title": "Exemple de tâche",\n    "priority": "high",\n    ...\n  }\n]'}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-mono text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none bg-gray-50"
                    />
                    {parseErr && (
                      <div className="flex items-start gap-2 mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        {parseErr}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* ── ÉTAPE 2 ── */}
              {step === 2 && (
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
                    <ListChecks className="w-4 h-4 shrink-0" />
                    <span>Validez chaque tâche individuellement après assignation. Seules les tâches validées seront créées.</span>
                  </div>

                  <div className="space-y-3">
                    {tasks.map((t, idx) => (
                      <div key={t._id}
                        className={`rounded-xl border-2 transition-all ${
                          t.validated ? 'border-green-400 bg-green-50/40' : 'border-gray-200 bg-white'
                        }`}
                      >
                        <div className="p-4 space-y-3">
                          {/* Row header */}
                          <div className="flex items-start gap-3">
                            <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <div className="flex-1 min-w-0">
                              <input
                                type="text"
                                value={t.title}
                                onChange={e => updateTask(t._id, 'title', e.target.value)}
                                className="w-full text-sm font-semibold text-gray-900 bg-transparent border-b border-dashed border-gray-300 focus:border-violet-400 focus:outline-none pb-0.5"
                              />
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${PRIORITY_META[t.priority]?.cls}`}>
                                {PRIORITY_META[t.priority]?.label}
                              </span>
                              <button type="button" onClick={() => removeTask(t._id)}
                                className="p-1 rounded text-gray-300 hover:text-red-500 transition">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Description */}
                          {t.description && (
                            <p className="text-xs text-gray-500 leading-relaxed pl-8 line-clamp-2">{t.description}</p>
                          )}

                          {/* Controls */}
                          <div className="flex items-center gap-3 pl-8 flex-wrap">
                            {/* Statut — masqué si assigné à quelqu'un */}
                            {t.assigned_to ? (
                              <span className="text-[10px] px-2 py-1 bg-amber-100 text-amber-700 rounded-lg font-medium">
                                ⏳ En attente d'acceptation
                              </span>
                            ) : (
                              <select
                                value={t.status}
                                onChange={e => updateTask(t._id, 'status', e.target.value)}
                                className="text-xs text-gray-700 border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                              >
                                <option value="todo">À faire</option>
                                <option value="in_progress">En cours</option>
                                <option value="review">En révision</option>
                                <option value="done">Terminé</option>
                              </select>
                            )}

                            {/* Priorité */}
                            <select
                              value={t.priority}
                              onChange={e => updateTask(t._id, 'priority', e.target.value)}
                              className="text-xs text-gray-700 border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                            >
                              <option value="low">Faible</option>
                              <option value="medium">Moyen</option>
                              <option value="high">Élevé</option>
                              <option value="urgent">Urgent</option>
                            </select>

                            {/* Échéance */}
                            <input
                              type="date"
                              value={t.due_date}
                              onChange={e => updateTask(t._id, 'due_date', e.target.value)}
                              className="text-xs text-gray-700 border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                            />

                            {/* Assigné */}
                            <div className="flex items-center gap-1.5 flex-1 min-w-[140px]">
                              <Users className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                              <select
                                value={t.assigned_to}
                                onChange={e => updateTask(t._id, 'assigned_to', e.target.value)}
                                className="flex-1 text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                              >
                                <option value="">— Non assigné</option>
                                {members.map(m => (
                                  <option key={m.id} value={m.id}>{m.full_name}</option>
                                ))}
                              </select>
                            </div>

                            {/* Bouton valider */}
                            <button
                              type="button"
                              onClick={() => toggleValidate(t._id)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition ml-auto ${
                                t.validated
                                  ? 'bg-green-500 border-green-500 text-white hover:bg-green-600'
                                  : 'border-gray-300 text-gray-600 hover:border-green-400 hover:text-green-700 hover:bg-green-50'
                              }`}
                            >
                              <Check className="w-3 h-3" />
                              {t.validated ? 'Validée' : 'Valider'}
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="shrink-0 border-t border-gray-100 px-6 py-4 flex items-center justify-between bg-gray-50/50">
              {step === 1 ? (
                <>
                  <button onClick={handleClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
                    Annuler
                  </button>
                  <button
                    onClick={handleParse}
                    disabled={!raw.trim()}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition disabled:opacity-40"
                  >
                    Analyser les tâches <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
                    <ChevronLeft className="w-4 h-4" /> Retour
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">
                      {validatedTasks.length} / {tasks.length} validée{validatedTasks.length > 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={handleCreate}
                      disabled={submitting || validatedTasks.length === 0}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-40"
                    >
                      {submitting
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <CheckCheck className="w-3.5 h-3.5" />
                      }
                      {submitting ? 'Création…' : `Créer ${validatedTasks.length} tâche${validatedTasks.length > 1 ? 's' : ''}`}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}

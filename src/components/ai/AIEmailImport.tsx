'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles, Copy, CheckCheck, ChevronRight, ChevronLeft,
  X, Check, AlertTriangle, FolderKanban, ListChecks,
  Trash2, RefreshCw, Mail, FileText, Search,
} from 'lucide-react'
import { toast } from 'sonner'

// ─── Types ────────────────────────────────────────────────────────────────────

type Mode = 'project' | 'task'
type Step = 1 | 2

interface Project { id: string; title: string; code: string }
interface Program { id: string; name: string }

interface ParsedTask {
  _id:         string
  title:       string
  description: string
  priority:    'low' | 'medium' | 'high' | 'urgent'
  status:      'todo' | 'in_progress' | 'review' | 'done'
  due_date:    string
  validated:   boolean
}

interface ParsedProject {
  title:       string
  description: string
  type:        string
  start_date:  string
  end_date:    string
  tasks:       ParsedTask[]
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  low:    { label: 'Faible',  cls: 'bg-gray-100 text-gray-600' },
  medium: { label: 'Moyen',   cls: 'bg-yellow-100 text-yellow-700' },
  high:   { label: 'Élevé',   cls: 'bg-orange-100 text-orange-700' },
  urgent: { label: 'Urgent',  cls: 'bg-red-100 text-red-700' },
}

const TYPE_LABELS: Record<string, string> = {
  workshop:   '🎓 Workshop',
  hackathon:  '💡 Hackathon',
  bootcamp:   '🚀 Bootcamp',
  incubation: '🌱 Incubation',
  meeting:    '📅 Réunion',
  other:      '📁 Autre',
}

const PROJECT_TYPES = ['workshop', 'hackathon', 'bootcamp', 'incubation', 'meeting', 'other']

// ─── Prompts ──────────────────────────────────────────────────────────────────

function buildTaskPrompt(projectTitle: string, projectCode: string): string {
  return `Tu es un assistant de gestion de projet pour l'I&E Lab de l'UM6P.

Projet cible : ${projectTitle}${projectCode ? ` (${projectCode})` : ''}

Je vais te soumettre soit un email reçu, soit des instructions libres.
Convertis le contenu en tâches structurées au format JSON strict, sans texte autour :

[
  {
    "title": "Titre court et clair de la tâche",
    "description": "Description détaillée avec contexte et critères d'acceptation",
    "priority": "low | medium | high | urgent",
    "due_date": "YYYY-MM-DD ou null"
  }
]

Règles :
- Extrais TOUTES les actions concrètes à réaliser mentionnées dans le texte
- priority : urgent si délai critique, high si important, medium par défaut, low si secondaire
- due_date : estimer une date réaliste si possible, sinon null
- Ne génère que le tableau JSON, sans texte autour

---

Contenu (email ou instructions) :`
}

function buildProjectPrompt(): string {
  return `Tu es un assistant de gestion de projet pour l'I&E Lab de l'UM6P.

Je vais te soumettre soit un email reçu, soit des instructions libres décrivant un projet à créer.
Convertis le contenu en fiche projet structurée au format JSON strict, sans texte autour :

{
  "title": "Titre court et clair du projet",
  "description": "Description complète du projet (2-4 phrases)",
  "type": "workshop | hackathon | bootcamp | incubation | meeting | other",
  "start_date": "YYYY-MM-DD ou null",
  "end_date": "YYYY-MM-DD ou null",
  "tasks": [
    {
      "title": "Titre de la tâche à prévoir",
      "description": "Description courte",
      "priority": "low | medium | high | urgent",
      "due_date": "YYYY-MM-DD ou null"
    }
  ]
}

Règles :
- type : choisir parmi workshop, hackathon, bootcamp, incubation, meeting, other
- tasks : liste de 3 à 7 grandes actions à prévoir pour ce projet
- Ne génère que le JSON, sans texte autour

---

Contenu (email ou instructions) :`
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeId() { return Math.random().toString(36).slice(2) }

const VALID_STATUSES = ['todo', 'in_progress', 'review', 'done'] as const
type TaskStatus = typeof VALID_STATUSES[number]

function parseStatus(v: unknown): TaskStatus {
  return VALID_STATUSES.includes(v as TaskStatus) ? (v as TaskStatus) : 'todo'
}

function parseTasks(raw: string): ParsedTask[] {
  const match = raw.match(/\[[\s\S]*\]/)
  if (!match) throw new Error('Aucun tableau JSON trouvé')
  const arr = JSON.parse(match[0])
  if (!Array.isArray(arr)) throw new Error('Format invalide')
  return arr
    .filter((t: any) => t.title)
    .map((t: any): ParsedTask => ({
      _id:         makeId(),
      title:       String(t.title ?? '').trim(),
      description: String(t.description ?? '').trim(),
      priority:    ['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium',
      status:      parseStatus(t.status),
      due_date:    t.due_date && t.due_date !== 'null' ? t.due_date : '',
      validated:   false,
    }))
}

function parseProject(raw: string): ParsedProject {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Aucun objet JSON trouvé')
  const obj = JSON.parse(match[0])
  return {
    title:       String(obj.title ?? '').trim(),
    description: String(obj.description ?? '').trim(),
    type:        PROJECT_TYPES.includes(obj.type) ? obj.type : 'other',
    start_date:  obj.start_date && obj.start_date !== 'null' ? obj.start_date : '',
    end_date:    obj.end_date && obj.end_date !== 'null' ? obj.end_date : '',
    tasks: Array.isArray(obj.tasks)
      ? obj.tasks.filter((t: any) => t.title).map((t: any): ParsedTask => ({
          _id:         makeId(),
          title:       String(t.title ?? '').trim(),
          description: String(t.description ?? '').trim(),
          priority:    ['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium',
          status:      parseStatus(t.status),
          due_date:    t.due_date && t.due_date !== 'null' ? t.due_date : '',
          validated:   true,
        }))
      : [],
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface AIEmailImportProps {
  /** Si fourni, le sélecteur de mode est masqué */
  defaultMode?: Mode
  /** Si fourni avec mode=task, le sélecteur de projet est masqué */
  defaultProjectId?: string
  defaultProjectTitle?: string
  defaultProjectCode?: string
  /** ID de l'utilisateur connecté — les tâches lui seront automatiquement assignées */
  userId?: string
  /** Style du bouton déclencheur */
  variant?: 'violet' | 'white'
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AIEmailImport({
  defaultMode,
  defaultProjectId,
  defaultProjectTitle,
  defaultProjectCode,
  userId,
  variant = 'violet',
}: AIEmailImportProps) {
  const router = useRouter()

  // Modal state
  const [open, setOpen] = useState(false)

  // Config
  const [mode, setMode]                       = useState<Mode | null>(defaultMode ?? null)
  const [projects, setProjects]               = useState<Project[]>([])
  const [programs, setPrograms]               = useState<Program[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState(defaultProjectId ?? '')
  const [selectedProgramId, setSelectedProgramId] = useState('')
  const [loadingData, setLoadingData]         = useState(false)

  // Project search
  const [projectSearch, setProjectSearch]   = useState('')
  const [showDropdown, setShowDropdown]     = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const searchRef = useRef<HTMLDivElement>(null)

  // Stepper
  const [step, setStep] = useState<Step>(1)

  // Step 1
  const [copied,   setCopied]   = useState(false)
  const [raw,      setRaw]      = useState('')
  const [parseErr, setParseErr] = useState('')

  // Step 2
  const [parsedTasks,   setParsedTasks]   = useState<ParsedTask[]>([])
  const [parsedProject, setParsedProject] = useState<ParsedProject | null>(null)

  // Submit
  const [submitting, setSubmitting] = useState(false)

  // ── Load data on open ──
  useEffect(() => {
    if (!open) return
    setLoadingData(true)
    const fetches: Promise<void>[] = []

    if (!defaultProjectId) {
      fetches.push(
        fetch('/api/projects/list')
          .then(r => r.json())
          .then(data => setProjects(Array.isArray(data) ? data : []))
          .catch(() => {})
      )
    }

    fetches.push(
      fetch('/api/programs')
        .then(r => r.json())
        .then(data => setPrograms(Array.isArray(data) ? data : []))
        .catch(() => {})
    )

    Promise.all(fetches).finally(() => setLoadingData(false))
  }, [open, defaultProjectId])

  // ── Close dropdown on outside click ──
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // ── Derived ──
  function getSelectedProject(): Project | undefined {
    if (defaultProjectId) {
      return { id: defaultProjectId, title: defaultProjectTitle ?? 'Projet', code: defaultProjectCode ?? '' }
    }
    return selectedProject ?? undefined
  }

  // Filtered suggestions — au moins 3 caractères
  const projectSuggestions = projectSearch.trim().length >= 3
    ? projects.filter(p => {
        const q = projectSearch.toLowerCase()
        return p.title.toLowerCase().includes(q) || p.code.toLowerCase().includes(q)
      }).slice(0, 8)
    : []

  function getPrompt(): string {
    if (mode === 'task') {
      const proj = getSelectedProject()
      return buildTaskPrompt(proj?.title ?? 'Projet', proj?.code ?? '')
    }
    return buildProjectPrompt()
  }

  function canAnalyse(): boolean {
    if (!mode) return false
    if (mode === 'task' && !selectedProject && !defaultProjectId) return false
    if (mode === 'project' && !selectedProgramId) return false
    return raw.trim().length > 10
  }

  const validatedTasks = parsedTasks.filter(t => t.validated)

  // ── Handlers ──
  function handleCopy() {
    navigator.clipboard.writeText(getPrompt())
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function handleParse() {
    setParseErr('')
    try {
      if (mode === 'task') {
        const tasks = parseTasks(raw)
        if (tasks.length === 0) { setParseErr('Aucune tâche détectée dans la réponse.'); return }
        setParsedTasks(tasks)
      } else {
        const project = parseProject(raw)
        if (!project.title) { setParseErr('Le titre du projet est manquant.'); return }
        setParsedProject(project)
      }
      setStep(2)
    } catch {
      setParseErr("Format non reconnu. Assurez-vous de coller la réponse JSON de l'IA.")
    }
  }

  function updateTask(id: string, field: keyof ParsedTask, value: any) {
    setParsedTasks(prev => prev.map(t => t._id === id ? { ...t, [field]: value } : t))
  }

  function updateProjectTask(id: string, field: keyof ParsedTask, value: any) {
    if (!parsedProject) return
    setParsedProject(prev => prev ? {
      ...prev,
      tasks: prev.tasks.map(t => t._id === id ? { ...t, [field]: value } : t),
    } : null)
  }

  function removeTask(id: string) {
    setParsedTasks(prev => prev.filter(t => t._id !== id))
  }

  function removeProjectTask(id: string) {
    if (!parsedProject) return
    setParsedProject(prev => prev ? { ...prev, tasks: prev.tasks.filter(t => t._id !== id) } : null)
  }

  function toggleValidate(id: string) {
    setParsedTasks(prev => prev.map(t => t._id === id ? { ...t, validated: !t.validated } : t))
  }

  async function handleCreate() {
    if (mode === 'task' && validatedTasks.length === 0) {
      toast.error('Validez au moins une tâche')
      return
    }
    setSubmitting(true)
    try {
      if (mode === 'task') {
        const projId = selectedProject?.id || defaultProjectId
        const res = await fetch(`/api/projects/${projId}/tasks/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tasks: validatedTasks.map(t => ({
              title:       t.title,
              description: t.description || null,
              priority:    t.priority,
              status:      t.status,
              due_date:    t.due_date || null,
              assigned_to: userId ?? null,
            })),
          }),
        })
        const json = await res.json()
        if (!res.ok) { toast.error(json.error ?? 'Erreur'); return }
        toast.success(`${json.created} tâche${json.created > 1 ? 's' : ''} créée${json.created > 1 ? 's' : ''}`)
        handleClose()
        router.refresh()
      } else if (mode === 'project' && parsedProject) {
        const res = await fetch('/api/ai-import/project', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title:       parsedProject.title,
            description: parsedProject.description || null,
            type:        parsedProject.type,
            program_id:  selectedProgramId,
            start_date:  parsedProject.start_date || null,
            end_date:    parsedProject.end_date || null,
            tasks:       parsedProject.tasks.map(t => ({
              title:       t.title,
              description: t.description || null,
              priority:    t.priority,
              due_date:    t.due_date || null,
            })),
          }),
        })
        const json = await res.json()
        if (!res.ok) { toast.error(json.error ?? 'Erreur'); return }
        toast.success('Projet créé avec succès !')
        handleClose()
        router.push(`/projects/${json.id}`)
      }
    } finally {
      setSubmitting(false)
    }
  }

  function handleClose() {
    setOpen(false)
    setStep(1)
    setRaw('')
    setParsedTasks([])
    setParsedProject(null)
    setParseErr('')
    setCopied(false)
    if (!defaultMode) setMode(null)
    if (!defaultProjectId) {
      setSelectedProjectId('')
      setSelectedProject(null)
      setProjectSearch('')
    }
    setSelectedProgramId('')
    setShowDropdown(false)
  }

  // ── Step labels ──
  const step2Label = mode === 'task'
    ? `Valider les tâches (${validatedTasks.length}/${parsedTasks.length})`
    : parsedProject
      ? `Projet : ${parsedProject.title}`
      : 'Vérifier et créer'

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setOpen(true)}
        className={
          variant === 'violet'
            ? 'inline-flex items-center gap-1.5 px-3 py-1.5 border border-violet-200 text-violet-700 bg-violet-50 hover:bg-violet-100 text-xs font-medium rounded-lg transition'
            : 'inline-flex items-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 text-sm font-medium rounded-lg transition'
        }
      >
        <Sparkles className={variant === 'violet' ? 'w-3.5 h-3.5' : 'w-4 h-4 text-violet-500'} />
        {variant === 'violet' ? 'Import IA' : 'Import IA'}
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col overflow-hidden">

            {/* Header */}
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-violet-50 to-blue-50 shrink-0">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-blue-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-semibold text-gray-900">Import depuis l'IA</h2>
                <p className="text-xs text-gray-500 mt-0.5 truncate">
                  {step === 1
                    ? 'Étape 1 — Configurer, copier le prompt et coller la réponse'
                    : `Étape 2 — ${step2Label}`}
                </p>
              </div>
              {/* Step indicators */}
              <div className="flex items-center gap-1.5 shrink-0">
                {([1, 2] as const).map(s => (
                  <div key={s} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition ${
                    step === s ? 'bg-violet-600 text-white' : step > s ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'
                  }`}>
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
                <div className="p-6 space-y-5">

                  {/* Instructions */}
                  <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700 leading-relaxed">
                    <p className="font-semibold mb-1">Comment ça marche ?</p>
                    <ol className="list-decimal list-inside space-y-1 text-xs">
                      <li>Choisissez ce que vous voulez créer ci-dessous</li>
                      <li>Copiez le prompt généré par Jet Pops</li>
                      <li>Collez-le dans <strong>ChatGPT</strong> ou <strong>Claude</strong>, suivi de votre email ou instructions</li>
                      <li>Copiez la réponse JSON et collez-la dans le champ ci-dessous</li>
                    </ol>
                  </div>

                  {/* Mode selector */}
                  {!defaultMode && (
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-2">Je veux créer…</p>
                      <div className="grid grid-cols-2 gap-3">
                        {([
                          { key: 'project', icon: FolderKanban, label: 'Un projet', desc: 'Nouveau projet + tâches associées' },
                          { key: 'task',    icon: ListChecks,    label: 'Des tâches',  desc: 'Dans un projet existant' },
                        ] as const).map(opt => (
                          <button
                            key={opt.key}
                            onClick={() => setMode(opt.key)}
                            className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition ${
                              mode === opt.key
                                ? 'border-violet-500 bg-violet-50'
                                : 'border-gray-200 hover:border-violet-300 hover:bg-gray-50'
                            }`}
                          >
                            <opt.icon className={`w-5 h-5 mt-0.5 shrink-0 ${mode === opt.key ? 'text-violet-600' : 'text-gray-400'}`} />
                            <div>
                              <p className={`text-sm font-semibold ${mode === opt.key ? 'text-violet-700' : 'text-gray-700'}`}>{opt.label}</p>
                              <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                            </div>
                            {mode === opt.key && (
                              <div className="ml-auto shrink-0 w-5 h-5 rounded-full bg-violet-500 flex items-center justify-center">
                                <Check className="w-3 h-3 text-white" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Project search (task mode) */}
                  {mode === 'task' && !defaultProjectId && (
                    <div ref={searchRef}>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Projet cible <span className="text-red-500">*</span>
                      </label>

                      {/* Selected pill */}
                      {selectedProject ? (
                        <div className="flex items-center gap-2 px-3 py-2 bg-violet-50 border border-violet-300 rounded-lg">
                          <FolderKanban className="w-4 h-4 text-violet-500 shrink-0" />
                          <span className="text-sm font-medium text-violet-800 flex-1 truncate">
                            <span className="font-mono text-xs text-violet-500 mr-1">{selectedProject.code}</span>
                            {selectedProject.title}
                          </span>
                          <button
                            type="button"
                            onClick={() => { setSelectedProject(null); setProjectSearch(''); setSelectedProjectId('') }}
                            className="p-0.5 text-violet-400 hover:text-violet-700 transition shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="relative">
                          <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                              type="text"
                              value={projectSearch}
                              onChange={e => {
                                setProjectSearch(e.target.value)
                                setShowDropdown(true)
                              }}
                              onFocus={() => projectSearch.length >= 3 && setShowDropdown(true)}
                              placeholder={loadingData ? 'Chargement…' : 'Tapez le titre ou le code du projet (min. 3 lettres)'}
                              disabled={loadingData}
                              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 disabled:bg-gray-50 disabled:text-gray-400"
                            />
                          </div>

                          {/* Hint */}
                          {projectSearch.trim().length > 0 && projectSearch.trim().length < 3 && (
                            <p className="text-xs text-gray-400 mt-1 ml-1">
                              Encore {3 - projectSearch.trim().length} lettre{3 - projectSearch.trim().length > 1 ? 's' : ''}…
                            </p>
                          )}

                          {/* Dropdown */}
                          {showDropdown && projectSearch.trim().length >= 3 && (
                            <div className="absolute z-10 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
                              {projectSuggestions.length === 0 ? (
                                <div className="px-4 py-3 text-xs text-gray-400 text-center">
                                  Aucun projet trouvé pour «&nbsp;{projectSearch}&nbsp;»
                                </div>
                              ) : (
                                projectSuggestions.map(p => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onMouseDown={e => e.preventDefault()}
                                    onClick={() => {
                                      setSelectedProject(p)
                                      setSelectedProjectId(p.id)
                                      setProjectSearch('')
                                      setShowDropdown(false)
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-violet-50 transition"
                                  >
                                    <FolderKanban className="w-4 h-4 text-gray-400 shrink-0" />
                                    <span className="font-mono text-xs text-gray-400 shrink-0">{p.code}</span>
                                    <span className="text-sm text-gray-800 truncate">{p.title}</span>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Program selector (project mode) */}
                  {mode === 'project' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Programme <span className="text-red-500">*</span>
                      </label>
                      {loadingData ? (
                        <div className="h-9 bg-gray-100 animate-pulse rounded-lg" />
                      ) : (
                        <select
                          value={selectedProgramId}
                          onChange={e => setSelectedProgramId(e.target.value)}
                          className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                        >
                          <option value="">— Sélectionner un programme</option>
                          {programs.map(p => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  )}

                  {/* Prompt (shown when mode is chosen) */}
                  {mode && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-gray-400" />
                          Prompt à copier dans ChatGPT / Claude
                        </label>
                        <button
                          type="button"
                          onClick={handleCopy}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                            copied
                              ? 'bg-green-100 text-green-700 border border-green-200'
                              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                          }`}
                        >
                          {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {copied ? 'Copié !' : 'Copier le prompt'}
                        </button>
                      </div>
                      <pre className="text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-auto max-h-44 whitespace-pre-wrap leading-relaxed font-mono">
                        {getPrompt()}
                      </pre>
                    </div>
                  )}

                  {/* Paste area */}
                  {mode && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-gray-400" />
                        Coller la réponse de l'IA (JSON)
                      </label>
                      <textarea
                        value={raw}
                        onChange={e => { setRaw(e.target.value); setParseErr('') }}
                        rows={5}
                        placeholder={
                          mode === 'task'
                            ? '[\n  {\n    "title": "Ma tâche",\n    "priority": "high",\n    ...\n  }\n]'
                            : '{\n  "title": "Mon Projet",\n  "type": "workshop",\n  ...\n}'
                        }
                        className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-mono text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-violet-500 resize-none bg-gray-50"
                      />
                      {parseErr && (
                        <div className="flex items-start gap-2 mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                          {parseErr}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── ÉTAPE 2 — TASKS ── */}
              {step === 2 && mode === 'task' && (
                <div className="p-6 space-y-4">
                  <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
                    <ListChecks className="w-4 h-4 shrink-0" />
                    <span>Validez chaque tâche individuellement. Seules les tâches validées seront créées.</span>
                  </div>

                  <div className="space-y-3">
                    {parsedTasks.map((t, idx) => (
                      <div key={t._id} className={`rounded-xl border-2 transition-all ${
                        t.validated ? 'border-green-400 bg-green-50/40' : 'border-gray-200 bg-white'
                      }`}>
                        <div className="p-4 space-y-3">
                          <div className="flex items-start gap-3">
                            <span className="w-5 h-5 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={t.title}
                              onChange={e => updateTask(t._id, 'title', e.target.value)}
                              className="flex-1 text-sm font-semibold text-gray-900 bg-transparent border-b border-dashed border-gray-300 focus:border-violet-400 focus:outline-none pb-0.5"
                            />
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

                          {t.description && (
                            <p className="text-xs text-gray-500 leading-relaxed pl-8 line-clamp-2">{t.description}</p>
                          )}

                          <div className="flex items-center gap-3 pl-8 flex-wrap">
                            {/* Statut */}
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

                            <input
                              type="date"
                              value={t.due_date}
                              onChange={e => updateTask(t._id, 'due_date', e.target.value)}
                              className="text-xs text-gray-700 border border-gray-200 rounded-lg px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                            />

                            <button
                              type="button"
                              onClick={() => toggleValidate(t._id)}
                              className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition ${
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

              {/* ── ÉTAPE 2 — PROJECT ── */}
              {step === 2 && mode === 'project' && parsedProject && (
                <div className="p-6 space-y-5">
                  {/* Project preview */}
                  <div className="bg-gradient-to-r from-violet-50 to-blue-50 rounded-xl border border-violet-100 p-5 space-y-4">
                    <div>
                      <p className="text-xs font-medium text-violet-600 mb-1">Titre du projet</p>
                      <input
                        type="text"
                        value={parsedProject.title}
                        onChange={e => setParsedProject(p => p ? { ...p, title: e.target.value } : p)}
                        className="w-full text-lg font-bold text-gray-900 bg-transparent border-b-2 border-dashed border-violet-300 focus:border-violet-500 focus:outline-none pb-0.5"
                      />
                    </div>

                    {parsedProject.description && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Description</p>
                        <textarea
                          value={parsedProject.description}
                          onChange={e => setParsedProject(p => p ? { ...p, description: e.target.value } : p)}
                          rows={3}
                          className="w-full text-sm text-gray-700 bg-white/70 border border-violet-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none"
                        />
                      </div>
                    )}

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Type</p>
                        <select
                          value={parsedProject.type}
                          onChange={e => setParsedProject(p => p ? { ...p, type: e.target.value } : p)}
                          className="w-full text-xs border border-violet-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                        >
                          {PROJECT_TYPES.map(t => (
                            <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Début</p>
                        <input
                          type="date"
                          value={parsedProject.start_date}
                          onChange={e => setParsedProject(p => p ? { ...p, start_date: e.target.value } : p)}
                          className="w-full text-xs border border-violet-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      </div>
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-1">Fin</p>
                        <input
                          type="date"
                          value={parsedProject.end_date}
                          onChange={e => setParsedProject(p => p ? { ...p, end_date: e.target.value } : p)}
                          className="w-full text-xs border border-violet-200 rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-violet-400"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Tasks preview */}
                  {parsedProject.tasks.length > 0 && (
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <ListChecks className="w-4 h-4 text-violet-500" />
                        Tâches associées ({parsedProject.tasks.length})
                      </p>
                      <div className="space-y-2">
                        {parsedProject.tasks.map((t, idx) => (
                          <div key={t._id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-200">
                            <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                              {idx + 1}
                            </span>
                            <input
                              type="text"
                              value={t.title}
                              onChange={e => updateProjectTask(t._id, 'title', e.target.value)}
                              className="flex-1 text-sm text-gray-800 bg-transparent border-b border-dashed border-gray-300 focus:border-violet-400 focus:outline-none pb-0.5"
                            />
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${PRIORITY_META[t.priority]?.cls}`}>
                              {PRIORITY_META[t.priority]?.label}
                            </span>
                            <button type="button" onClick={() => removeProjectTask(t._id)}
                              className="p-1 text-gray-300 hover:text-red-500 transition shrink-0">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
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
                    disabled={!canAnalyse()}
                    className="inline-flex items-center gap-2 px-5 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition disabled:opacity-40"
                  >
                    Analyser la réponse <ChevronRight className="w-4 h-4" />
                  </button>
                </>
              ) : (
                <>
                  <button onClick={() => setStep(1)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">
                    <ChevronLeft className="w-4 h-4" /> Retour
                  </button>
                  <div className="flex items-center gap-3">
                    {mode === 'task' && (
                      <span className="text-xs text-gray-500">
                        {validatedTasks.length} / {parsedTasks.length} validée{validatedTasks.length > 1 ? 's' : ''}
                      </span>
                    )}
                    <button
                      onClick={handleCreate}
                      disabled={submitting || (mode === 'task' && validatedTasks.length === 0)}
                      className="inline-flex items-center gap-2 px-5 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition disabled:opacity-40"
                    >
                      {submitting
                        ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        : <CheckCheck className="w-3.5 h-3.5" />
                      }
                      {submitting
                        ? 'Création…'
                        : mode === 'task'
                          ? `Créer ${validatedTasks.length} tâche${validatedTasks.length > 1 ? 's' : ''}`
                          : 'Créer le projet'
                      }
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

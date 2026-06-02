'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, ChevronRight, Check, Plus, Send, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import ProgramSearchInput from './ProgramSearchInput'
import MemberSearch from './MemberSearch'
import NeedsSelector from './NeedsSelector'
import AIProjectSuggestions from './AIProjectSuggestions'

// ─── Schema ────────────────────────────────────────────────────────────────
const schema = z.object({
  title: z.string().min(3, 'Titre requis (min. 3 caractères)'),
  description: z.string().optional(),
  type: z.enum(['workshop', 'hackathon', 'bootcamp', 'incubation', 'meeting', 'other'], {
    required_error: 'Type requis',
  }),
  program_id: z.string().min(1, 'Programme requis'),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  confidentiality: z.enum(['public_internal', 'restricted', 'confidential', 'private']).default('public_internal'),
  budget: z.string().optional(),
  budget_currency: z.enum(['MAD', 'EUR', 'USD']).default('MAD'),
  responsible_id: z.string().optional(),
  collaborator_ids: z.array(z.string()).default([]),
  project_structure: z.enum(['structured', 'flexible']).default('flexible'),
  needs_logistique: z.array(z.string()).default([]),
  needs_communication: z.array(z.string()).default([]),
  needs_administratif: z.array(z.string()).default([]),
  participant_option: z.enum(['form', 'import', 'none']).default('none'),
})

type FormValues = z.infer<typeof schema>

// ─── Props ─────────────────────────────────────────────────────────────────
interface Profile {
  id: string
  full_name: string
  email: string
  role: string
  avatar_url?: string | null
}

interface Program {
  id: string
  name: string
  description?: string | null
  color?: string | null
}

interface NewProjectFormProps {
  programs: Program[]
  profiles: Profile[]
  currentUserId: string
  currentUserRole: string
}

// ─── Constants ─────────────────────────────────────────────────────────────
const TABS = [
  { id: 'general',      label: 'Général',      description: 'Infos du projet' },
  { id: 'equipe',       label: 'Équipe',        description: 'Responsable & membres' },
  { id: 'structure',    label: 'Structure',     description: 'Organisation' },
  { id: 'besoins',      label: 'Besoins',       description: 'Ressources' },
  { id: 'participants', label: 'Participants',  description: 'Inscriptions' },
]

const PROJECT_TYPES = [
  { value: 'workshop',   label: '🎓 Workshop' },
  { value: 'hackathon',  label: '💡 Hackathon' },
  { value: 'bootcamp',   label: '🚀 Bootcamp' },
  { value: 'incubation', label: '🌱 Incubation' },
  { value: 'meeting',    label: '📅 Réunion' },
  { value: 'other',      label: '📁 Autre' },
]

const CONFIDENTIALITY_OPTIONS = [
  { value: 'public_internal', label: 'Public interne',  desc: 'Visible par tous les membres', emoji: '🌐' },
  { value: 'restricted',      label: 'Restreint',        desc: 'Membres assignés uniquement',  emoji: '🔒' },
  { value: 'confidential',    label: 'Confidentiel',     desc: 'Admins + responsable',          emoji: '🔐' },
  { value: 'private',         label: 'Privé',            desc: 'Visible uniquement par vous',   emoji: '👤' },
]

const DEFAULT_TASKS: Record<string, { title: string; description: string }[]> = {
  workshop: [
    { title: 'Créer le formulaire d\'inscription', description: 'Mettre en place le formulaire pour les participants' },
    { title: 'Réserver la salle', description: 'Confirmer le lieu et les équipements nécessaires' },
    { title: 'Préparer le programme', description: 'Définir l\'agenda et les intervenants' },
    { title: 'Communication & invitations', description: 'Envoyer les invitations et communiquer l\'événement' },
  ],
  hackathon: [
    { title: 'Définir les thématiques', description: 'Préparer les sujets et défis du hackathon' },
    { title: 'Former le jury', description: 'Identifier et contacter les membres du jury' },
    { title: 'Créer les critères de notation', description: 'Définir la grille d\'évaluation' },
    { title: 'Préparer la logistique', description: 'Salle, matériel, restauration' },
    { title: 'Communication digitale', description: 'Réseaux sociaux, site web, campagne email' },
  ],
  bootcamp: [
    { title: 'Définir le curriculum', description: 'Contenu pédagogique et planning des sessions' },
    { title: 'Recruter les formateurs', description: 'Identifier et confirmer les intervenants' },
    { title: 'Préparer les supports', description: 'Slides, exercices, ressources pédagogiques' },
    { title: 'Gérer les inscriptions', description: 'Formulaire et suivi des participants' },
  ],
  incubation: [
    { title: 'Préparer la convention', description: 'Document de partenariat avec les équipes RH/Juridique' },
    { title: 'Définir les critères de sélection', description: 'Grille d\'évaluation des candidats' },
    { title: 'Planifier les sessions de mentoring', description: 'Calendrier des rencontres et suivi' },
    { title: 'Préparer l\'espace de travail', description: 'Aménagement et ressources pour les équipes' },
  ],
}

function generateProjectCode(type: string, title: string): string {
  const typePrefix = type.slice(0, 3).toUpperCase()
  const titlePrefix = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase()
  const year = new Date().getFullYear().toString().slice(2)
  const rand = Math.floor(Math.random() * 900 + 100)
  return `${typePrefix}-${titlePrefix}-${year}${rand}`
}

// ─── Shared input styles ───────────────────────────────────────────────────
const inputCls = 'w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition'
const labelCls = 'block text-sm font-medium text-gray-700 mb-1'
const errorCls = 'mt-1 text-xs text-red-600'

// ─── Program Create Popup ───────────────────────────────────────────────────
interface ProgramPopupProps {
  canCreate: boolean
  onClose: () => void
  onCreated?: (program: Program) => void
  onRefresh: () => void
  currentUserId: string
}

function ProgramPopup({ canCreate, onClose, onCreated, onRefresh, currentUserId }: ProgramPopupProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)
    setError(null)
    const supabase = createClient()

    if (canCreate) {
      // Auto-generate a short code from the name (e.g. "Innovation & Entrepreneuriat 2025" → "IE-25")
      const autoCode = name.trim()
        .normalize('NFD').replace(/[̀-ͯ]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2)
        .map(w => w[0].toUpperCase())
        .join('')
        .slice(0, 6) + '-' + new Date().getFullYear().toString().slice(2)

      const { data, error: err } = await supabase
        .from('programs')
        .insert({ name: name.trim(), code: autoCode, description: description.trim() || null, created_by: currentUserId, is_active: true })
        .select('id, name, description')
        .single()
      if (err) { setError(err.message); setLoading(false); return }
      onCreated?.(data as Program)
      onClose()
      onRefresh()
    } else {
      const { error: err } = await supabase.from('notifications').insert({
        user_id: currentUserId,
        type: 'program_request',
        title: `Demande de programme : ${name.trim()}`,
        message: `L'utilisateur souhaite créer le programme "${name.trim()}". Description : ${description.trim() || '—'}`,
        is_read: false,
      })
      if (err) { setError(err.message); setLoading(false); return }
      setSubmitted(true)
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {canCreate ? 'Créer un programme' : 'Demande de programme'}
            </h3>
            <p className="text-sm text-gray-500 mt-0.5">
              {canCreate ? 'Le programme sera disponible immédiatement' : 'Votre demande sera examinée par un administrateur'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {submitted ? (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
              <Send className="w-6 h-6 text-green-600" />
            </div>
            <p className="text-lg font-semibold text-gray-900 mb-1">Demande envoyée !</p>
            <p className="text-sm text-gray-500 mb-4">Un administrateur examinera votre demande.</p>
            <button onClick={onClose} className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition">
              Fermer
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className={labelCls}>Nom du programme <span className="text-red-500">*</span></label>
              <input className={inputCls} value={name} onChange={e => setName(e.target.value)} placeholder="Ex: Innovation & Entrepreneuriat 2025" required />
            </div>
            <div>
              <label className={labelCls}>Description</label>
              <textarea className={cn(inputCls, 'resize-none')} rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Décrivez brièvement ce programme…" />
            </div>
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition">Annuler</button>
              <button type="submit" disabled={loading || !name.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition">
                {loading ? (
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                ) : canCreate ? <Plus className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                {canCreate ? 'Créer' : 'Envoyer la demande'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

// ─── Component ─────────────────────────────────────────────────────────────
export default function NewProjectForm({ programs: initialPrograms, profiles, currentUserId, currentUserRole }: NewProjectFormProps) {
  const router = useRouter()
  const [programs, setPrograms] = useState(initialPrograms)
  const [activeTab, setActiveTab] = useState('general')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [showProgramPopup, setShowProgramPopup] = useState(false)

  const canCreateProgram = ['admin', 'directeur'].includes(currentUserRole)

  const {
    register,
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      confidentiality: 'public_internal',
      project_structure: 'flexible',
      budget_currency: 'MAD',
      collaborator_ids: [],
      needs_logistique: [],
      needs_communication: [],
      needs_administratif: [],
      participant_option: 'none',
    },
  })

  const formValues = watch()

  // ─── Submit ──────────────────────────────────────────────────────────────
  async function onSubmit(data: FormValues) {
    setSubmitting(true)
    setSubmitError(null)
    const supabase = createClient()

    try {
      const code = generateProjectCode(data.type, data.title)
      const needs = {
        logistique: data.needs_logistique,
        communication: data.needs_communication,
        administratif: data.needs_administratif,
      }

      // Generate the UUID client-side so we never need to SELECT the project
      // back — avoids triggering the projects SELECT policy (which references
      // project_members and causes infinite recursion).
      const projectId = crypto.randomUUID()

      const { error: projectError } = await supabase
        .from('projects')
        .insert({
          id: projectId,
          code,
          title: data.title,
          description: data.description || null,
          type: data.type,
          program_id: data.program_id,
          start_date: data.start_date || null,
          end_date: data.end_date || null,
          budget: data.budget ? parseFloat(data.budget) : null,
          budget_currency: data.budget_currency ?? 'MAD',
          chef_projet_id: data.responsible_id || null,
          is_structured: data.project_structure === 'structured',
          metadata: {
            confidentiality: data.confidentiality,
            participant_option: data.participant_option,
            needs,
          },
          status: 'draft',
          completion_pct: 0,
          created_by: currentUserId,
        })

      if (projectError) throw projectError

      // Insert project members (profile_id + role)
      const memberInserts: { project_id: string; profile_id: string; role: string }[] = []
      if (data.responsible_id) {
        memberInserts.push({ project_id: projectId, profile_id: data.responsible_id, role: 'responsible' })
      }
      for (const uid of data.collaborator_ids) {
        if (uid !== data.responsible_id) {
          memberInserts.push({ project_id: projectId, profile_id: uid, role: 'member' })
        }
      }
      if (memberInserts.length > 0) {
        const { error: membersError } = await supabase.from('project_members').insert(memberInserts)
        if (membersError) throw membersError
      }

      // Insert default tasks for structured projects
      if (data.project_structure === 'structured') {
        const defaultTasks = DEFAULT_TASKS[data.type] ?? []
        if (defaultTasks.length > 0) {
          const taskInserts = defaultTasks.map((t, idx) => ({
            project_id: projectId,
            title: t.title,
            description: t.description,
            status: 'todo',
            priority: idx === 0 ? 'high' : 'medium',
            created_by: currentUserId,
            assigned_to: data.responsible_id || null,
          }))
          await supabase.from('tasks').insert(taskInserts)
        }
      }

      // ── Tâches brouillons depuis les besoins sélectionnés ─────────────────
      // Chaque besoin coché → 1 tâche draft avec label = need_id
      const NEED_TITLES: Record<string, string> = {
        hebergement: 'Gérer l\'hébergement', parking: 'Organiser le parking',
        transport: 'Organiser le transport', catering: 'Organiser le catering',
        billets_avion: 'Réserver les billets avion', salle: 'Réserver la salle',
        materiel: 'Préparer le matériel', autre_log: 'Logistique (à définir)',
        design: 'Créer les visuels / design', presentation: 'Préparer la présentation',
        formulaire: 'Créer le formulaire', reseaux: 'Gérer les réseaux sociaux',
        email: 'Préparer la campagne email', video: 'Réaliser la vidéo / photo',
        site_web: 'Créer la page web', autre_com: 'Communication (à définir)',
        demande_achat: 'Soumettre la demande d\'achat',
        validation_docs: 'Valider les documents', factures: 'Traiter les factures / BC',
        contrats: 'Préparer les contrats', rapport: 'Rédiger le rapport final',
        certificats: 'Préparer les certificats', autre_adm: 'Administratif (à définir)',
      }

      const allNeeds = [
        ...data.needs_logistique,
        ...data.needs_communication,
        ...data.needs_administratif,
      ]

      if (allNeeds.length > 0) {
        const draftInserts = allNeeds.map(needId => ({
          project_id: projectId,
          title: NEED_TITLES[needId] ?? needId,
          description: null,
          status: 'todo',
          priority: 'medium',
          created_by: currentUserId,
          assigned_to: null,
          label: needId,
          is_draft: true,
        }))
        // Tentative d'insert avec les nouvelles colonnes (migration 006)
        const { error: draftErr } = await supabase.from('tasks').insert(draftInserts)
        if (draftErr) {
          // Fallback sans label/is_draft si migration pas encore appliquée
          await supabase.from('tasks').insert(draftInserts.map(t => ({
            project_id: t.project_id, title: t.title, description: t.description,
            status: t.status, priority: t.priority, created_by: t.created_by,
          }))).catch(() => {})
        }
      }

      // ── Intégrations : fire & forget (ne bloque pas la navigation) ──────────
      fetch(`/api/projects/${projectId}/sharepoint`, { method: 'POST' }).catch(() => {})
      fetch(`/api/projects/${projectId}/google-drive`, { method: 'POST' }).catch(() => {})
      fetch('/api/slack/notify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event: { type: 'project_created', project: { code, title: data.title, type: data.type }, creator: 'Membre' } }),
      }).catch(() => {})

      router.push(`/projects/${projectId}`)
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
            ? String((err as { message: unknown }).message)
            : JSON.stringify(err)
      setSubmitError(msg)
      setSubmitting(false)
    }
  }

  const tabIndex = TABS.findIndex(t => t.id === activeTab)
  function goNext() { if (tabIndex < TABS.length - 1) setActiveTab(TABS[tabIndex + 1].id) }
  function goPrev() { if (tabIndex > 0) setActiveTab(TABS[tabIndex - 1].id) }

  const handleFormSubmit = handleSubmit(onSubmit, (errors) => {
    const keys = Object.keys(errors)
    const generalKeys = ['title', 'type', 'program_id', 'start_date', 'end_date', 'budget', 'confidentiality']
    const equipeKeys = ['responsible_id', 'collaborator_ids']
    const structureKeys = ['project_structure']
    const besoinsKeys = ['needs_logistique', 'needs_communication', 'needs_administratif']

    if (keys.some(k => generalKeys.includes(k))) {
      setActiveTab('general')
    } else if (keys.some(k => equipeKeys.includes(k))) {
      setActiveTab('equipe')
    } else if (keys.some(k => structureKeys.includes(k))) {
      setActiveTab('structure')
    } else if (keys.some(k => besoinsKeys.includes(k))) {
      setActiveTab('besoins')
    } else {
      setActiveTab('participants')
    }
    setSubmitError('Veuillez corriger les erreurs dans le formulaire avant de soumettre.')
  })

  return (
    <>
      {showProgramPopup && (
        <ProgramPopup
          canCreate={canCreateProgram}
          onClose={() => setShowProgramPopup(false)}
          onCreated={(prog) => setPrograms(prev => [...prev, prog])}
          onRefresh={() => router.refresh()}
          currentUserId={currentUserId}
        />
      )}

      <form onSubmit={handleFormSubmit}>
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-6">
          {/* ── Main form ── */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

            {/* ── Step indicator ── */}
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
              <div className="flex items-center gap-1 overflow-x-auto">
                {TABS.map((tab, idx) => {
                  const isActive = tab.id === activeTab
                  const isDone = idx < tabIndex
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setActiveTab(tab.id)}
                      className="flex items-center gap-2 shrink-0 group"
                    >
                      <div className={cn(
                        'w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors',
                        isActive ? 'bg-blue-600 text-white' :
                        isDone  ? 'bg-green-500 text-white' :
                                  'bg-gray-200 text-gray-500 group-hover:bg-gray-300'
                      )}>
                        {isDone ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                      </div>
                      <div className="text-left hidden sm:block">
                        <div className={cn('text-xs font-semibold', isActive ? 'text-blue-700' : isDone ? 'text-green-700' : 'text-gray-500')}>
                          {tab.label}
                        </div>
                      </div>
                      {idx < TABS.length - 1 && (
                        <div className={cn('w-6 h-px mx-1', isDone ? 'bg-green-400' : 'bg-gray-200')} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── Tab: Général ── */}
            {activeTab === 'general' && (
              <div className="p-6 space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Informations générales</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Décrivez votre projet et associez-le à un programme</p>
                </div>

                <div>
                  <label className={labelCls}>Titre du projet <span className="text-red-500">*</span></label>
                  <input {...register('title')} className={cn(inputCls, errors.title && 'border-red-400 focus:ring-red-400')} placeholder="Ex: Workshop IA pour étudiants MBA" />
                  {errors.title && <p className={errorCls}>{errors.title.message}</p>}
                </div>

                <div>
                  <label className={labelCls}>Description</label>
                  <textarea {...register('description')} className={cn(inputCls, 'resize-none')} rows={3} placeholder="Décrivez les objectifs et le contexte du projet..." />
                </div>

                <div>
                  <label className={labelCls}>Type de projet <span className="text-red-500">*</span></label>
                  <Controller
                    name="type"
                    control={control}
                    render={({ field }) => (
                      <select {...field} value={field.value ?? ''} className={cn(inputCls, errors.type && 'border-red-400')}>
                        <option value="" disabled>Sélectionner un type…</option>
                        {PROJECT_TYPES.map(t => (
                          <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                      </select>
                    )}
                  />
                  {errors.type && <p className={errorCls}>{errors.type.message as string}</p>}
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className={labelCls}>Programme <span className="text-red-500">*</span></label>
                    <button type="button" onClick={() => setShowProgramPopup(true)}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium transition">
                      <Plus className="w-3.5 h-3.5" />
                      {canCreateProgram ? 'Créer un programme' : 'Demander un programme'}
                    </button>
                  </div>
                  <Controller
                    name="program_id"
                    control={control}
                    render={({ field }) => (
                      <ProgramSearchInput
                        programs={programs}
                        value={field.value ?? ''}
                        onChange={field.onChange}
                        error={errors.program_id?.message}
                      />
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Date de début</label>
                    <input type="date" {...register('start_date')} className={inputCls} />
                  </div>
                  <div>
                    <label className={labelCls}>Date de fin</label>
                    <input type="date" {...register('end_date')} className={inputCls} />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Budget</label>
                  <div className="flex gap-2">
                    <input type="number" {...register('budget')} className={cn(inputCls, 'flex-1')} placeholder="0" min="0" step="100" />
                    <Controller
                      name="budget_currency"
                      control={control}
                      render={({ field }) => (
                        <select {...field} className={cn(inputCls, 'w-24')}>
                          <option value="MAD">MAD</option>
                          <option value="EUR">EUR</option>
                          <option value="USD">USD</option>
                        </select>
                      )}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Confidentialité</label>
                  <Controller
                    name="confidentiality"
                    control={control}
                    render={({ field }) => (
                      <div className="grid grid-cols-2 gap-2 mt-1">
                        {CONFIDENTIALITY_OPTIONS.map(opt => (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => field.onChange(opt.value)}
                            className={cn(
                              'p-3 rounded-xl border-2 text-left transition-all',
                              field.value === opt.value
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300 bg-white'
                            )}
                          >
                            <span className="text-xl">{opt.emoji}</span>
                            <p className="text-sm font-semibold text-gray-800 mt-1">{opt.label}</p>
                            <p className="text-xs text-gray-500">{opt.desc}</p>
                          </button>
                        ))}
                      </div>
                    )}
                  />
                </div>
              </div>
            )}

            {/* ── Tab: Équipe ── */}
            {activeTab === 'equipe' && (
              <div className="p-6 space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Équipe projet</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Désignez un responsable et ajoutez des collaborateurs</p>
                </div>

                <div>
                  <label className={labelCls}>Responsable du projet</label>
                  <Controller
                    name="responsible_id"
                    control={control}
                    render={({ field }) => (
                      <MemberSearch
                        profiles={profiles}
                        value={field.value ? [field.value] : []}
                        onChange={(ids) => field.onChange(ids[0] ?? '')}
                        label="Rechercher le responsable"
                        single
                      />
                    )}
                  />
                  <p className="text-xs text-gray-400 mt-1">Le responsable sera notifié et aura accès complet au projet</p>
                </div>

                <div>
                  <label className={labelCls}>Collaborateurs</label>
                  <Controller
                    name="collaborator_ids"
                    control={control}
                    render={({ field }) => (
                      <MemberSearch
                        profiles={profiles.filter(p => p.id !== formValues.responsible_id)}
                        value={field.value ?? []}
                        onChange={field.onChange}
                        label="Ajouter des collaborateurs"
                      />
                    )}
                  />
                  <p className="text-xs text-gray-400 mt-1">Les collaborateurs peuvent consulter et mettre à jour les tâches</p>
                </div>
              </div>
            )}

            {/* ── Tab: Structure ── */}
            {activeTab === 'structure' && (
              <div className="p-6 space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Structure du projet</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Choisissez comment organiser et suivre votre projet</p>
                </div>
                <Controller
                  name="project_structure"
                  control={control}
                  render={({ field }) => (
                    <div className="space-y-3">
                      {[
                        { value: 'flexible',   emoji: '🎨', label: 'Flexible',    desc: 'Démarrez avec une page blanche, créez vos tâches librement' },
                        { value: 'structured', emoji: '📋', label: 'Structuré',   desc: 'Tâches recommandées générées automatiquement selon le type de projet' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => field.onChange(opt.value)}
                          className={cn(
                            'w-full p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3',
                            field.value === opt.value
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          )}
                        >
                          <span className="text-2xl shrink-0">{opt.emoji}</span>
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{opt.label}</p>
                            <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                />
                {formValues.project_structure === 'structured' && formValues.type && DEFAULT_TASKS[formValues.type] && (
                  <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                    <p className="text-sm font-semibold text-green-700 mb-2">
                      ✅ {DEFAULT_TASKS[formValues.type].length} tâches seront générées automatiquement
                    </p>
                    <ul className="space-y-1">
                      {DEFAULT_TASKS[formValues.type].map((t, i) => (
                        <li key={i} className="text-sm text-gray-600 flex items-center gap-2">
                          <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                          {t.title}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {/* ── Tab: Besoins ── */}
            {activeTab === 'besoins' && (
              <div className="p-6 space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Besoins du projet</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Sélectionnez les ressources et services nécessaires</p>
                </div>
                <Controller
                  name="needs_logistique"
                  control={control}
                  render={({ field: logField }) => (
                    <Controller
                      name="needs_communication"
                      control={control}
                      render={({ field: commField }) => (
                        <Controller
                          name="needs_administratif"
                          control={control}
                          render={({ field: adminField }) => (
                            <NeedsSelector
                              value={{
                                logistique: logField.value,
                                communication: commField.value,
                                administratif: adminField.value,
                              }}
                              onChange={({ logistique, communication, administratif }) => {
                                logField.onChange(logistique)
                                commField.onChange(communication)
                                adminField.onChange(administratif)
                              }}
                            />
                          )}
                        />
                      )}
                    />
                  )}
                />
              </div>
            )}

            {/* ── Tab: Participants ── */}
            {activeTab === 'participants' && (
              <div className="p-6 space-y-5">
                <div>
                  <h2 className="text-lg font-semibold text-gray-800">Gestion des participants</h2>
                  <p className="text-sm text-gray-500 mt-0.5">Choisissez comment gérer les inscriptions externes</p>
                </div>
                <Controller
                  name="participant_option"
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'form',   emoji: '📝', label: 'Formulaire d\'inscription', desc: 'Créer un formulaire en ligne' },
                        { value: 'import', emoji: '📊', label: 'Import Excel',              desc: 'Importer depuis un fichier Excel' },
                        { value: 'none',   emoji: '🚫', label: 'Aucun participant',         desc: 'Projet interne sans participants' },
                      ].map(opt => (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => field.onChange(opt.value)}
                          className={cn(
                            'p-4 rounded-xl border-2 text-left transition-all',
                            field.value === opt.value
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300 bg-white'
                          )}
                        >
                          <span className="text-2xl">{opt.emoji}</span>
                          <p className="text-sm font-semibold text-gray-800 mt-2">{opt.label}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{opt.desc}</p>
                        </button>
                      ))}
                    </div>
                  )}
                />
              </div>
            )}

            {/* ── Footer nav ── */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <button
                type="button"
                onClick={goPrev}
                disabled={tabIndex === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="w-4 h-4" /> Précédent
              </button>

              {tabIndex < TABS.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
                >
                  Suivant <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  {submitting ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                      </svg>
                      Création…
                    </>
                  ) : (
                    <><Check className="w-4 h-4" /> Créer le projet</>
                  )}
                </button>
              )}
            </div>

            {submitError && (
              <div className="mx-6 mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <strong>Erreur :</strong> {submitError}
              </div>
            )}
          </div>

          {/* ── Sidebar: AI suggestions ── */}
          <div className="hidden xl:block">
            <div className="sticky top-6">
              <AIProjectSuggestions
                formValues={{
                  title: formValues.title,
                  type: formValues.type,
                  project_structure: formValues.project_structure,
                  end_date: formValues.end_date,
                  needs_logistique: formValues.needs_logistique,
                  needs_communication: formValues.needs_communication,
                  needs_administratif: formValues.needs_administratif,
                  responsible_id: formValues.responsible_id,
                  collaborator_ids: formValues.collaborator_ids,
                  program_id: formValues.program_id,
                }}
              />
            </div>
          </div>
        </div>
      </form>
    </>
  )
}

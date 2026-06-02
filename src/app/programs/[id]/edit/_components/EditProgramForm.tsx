'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  Layers, Calendar, Users, FileText, DollarSign,
  Target, Plus, X, Search, Trash2, Check, File, Hash,
  Lock, Globe, RefreshCw,
} from 'lucide-react'
import BulkBudgetImport from './BulkBudgetImport'

// ── Types ─────────────────────────────────────────────────────────────────────

interface Profile   { id: string; full_name: string; email: string; avatar_url: string | null }
interface Document  { id: string; title: string; file_name: string; mime_type: string }
interface BudgetLine { _id: string; id?: string; code: string; designation: string; notes: string; isNew?: boolean; toDelete?: boolean }
interface ProgramMember { id?: string; profile: Profile; role: string; isNew?: boolean; toDelete?: boolean }

interface Program {
  id: string; name: string; code: string
  description: string | null; objectives: string | null
  is_active: boolean; is_confidential: boolean
  start_date: string | null; end_date: string | null
}

// ── Toggle réutilisable ───────────────────────────────────────────────────────
function Toggle({ on, onChange, colorOn = 'bg-indigo-600' }: { on: boolean; onChange: (v: boolean) => void; colorOn?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`relative inline-flex w-11 h-6 rounded-full transition-colors duration-200 focus:outline-none overflow-hidden flex-shrink-0 ${on ? colorOn : 'bg-gray-200'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${on ? 'translate-x-5' : 'translate-x-0'}`} />
    </button>
  )
}

// ── Composant principal ───────────────────────────────────────────────────────

export default function EditProgramForm({ program: initial }: { program: Program }) {
  const router  = useRouter()
  const [saving, setSaving] = useState(false)

  // Champs principaux
  const [name,          setName]          = useState(initial.name)
  const [description,   setDescription]   = useState(initial.description ?? '')
  const [objectives,    setObjectives]    = useState(initial.objectives ?? '')
  const [isActive,      setIsActive]      = useState(initial.is_active)
  const [isConfidential,setIsConfidential]= useState(initial.is_confidential ?? false)
  const [startDate,     setStartDate]     = useState(initial.start_date ?? '')
  const [endDate,       setEndDate]       = useState(initial.end_date ?? '')

  // Membres
  const [profiles,       setProfiles]       = useState<Profile[]>([])
  const [members,        setMembers]        = useState<ProgramMember[]>([])
  const [memberSearch,   setMemberSearch]   = useState('')
  const [memberDropdown, setMemberDropdown] = useState(false)
  const memberRef = useRef<HTMLDivElement>(null)

  // Documents
  const [allDocs,     setAllDocs]     = useState<Document[]>([])
  const [linkedDocs,  setLinkedDocs]  = useState<Array<Document & { linkId?: string; isNew?: boolean; toDelete?: boolean }>>([])
  const [docSearch,   setDocSearch]   = useState('')
  const [docDropdown, setDocDropdown] = useState(false)
  const docRef = useRef<HTMLDivElement>(null)

  // Lignes budgétaires
  const [budgetLines, setBudgetLines] = useState<BudgetLine[]>([])

  // ── Chargement initial ─────────────────────────────────────────────────────
  useEffect(() => {
    // Membres existants
    fetch(`/api/programs/${initial.id}/members`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setMembers((Array.isArray(data) ? data : []).map((m: any) => ({
          id: m.id,
          profile: m.profile,
          role: m.role,
        })))
      }).catch(() => {})

    // Documents existants
    fetch(`/api/programs/${initial.id}/documents`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setLinkedDocs((Array.isArray(data) ? data : []).map((d: any) => ({
          ...d.document,
          linkId: d.id,
        })))
      }).catch(() => {})

    // Lignes budgétaires existantes
    fetch(`/api/budget-references?program_id=${initial.id}`)
      .then(r => r.ok ? r.json() : [])
      .then(data => {
        setBudgetLines((Array.isArray(data) ? data : []).map((l: any) => ({
          _id: l.id,
          id: l.id,
          code: l.code,
          designation: l.designation,
          notes: l.notes ?? '',
        })))
      }).catch(() => {})

    // Tous les profils
    fetch('/api/admin/users').then(r => r.ok ? r.json() : []).then(data => {
      setProfiles(Array.isArray(data) ? data : [])
    }).catch(() => {})

    // Tous les documents
    fetch('/api/documents').then(r => r.ok ? r.json() : []).then(data => {
      setAllDocs(Array.isArray(data) ? data : [])
    }).catch(() => {})
  }, [initial.id])

  // Fermer dropdowns au clic extérieur
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (memberRef.current && !memberRef.current.contains(e.target as Node)) setMemberDropdown(false)
      if (docRef.current    && !docRef.current.contains(e.target as Node))    setDocDropdown(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // ── Membres ────────────────────────────────────────────────────────────────
  const filteredProfiles = profiles.filter(p =>
    !members.find(m => m.profile?.id === p.id) &&
    (p.full_name.toLowerCase().includes(memberSearch.toLowerCase()) ||
     p.email.toLowerCase().includes(memberSearch.toLowerCase()))
  )

  function addMember(profile: Profile) {
    setMembers(prev => [...prev, { profile, role: 'membre', isNew: true }])
    setMemberSearch(''); setMemberDropdown(false)
  }

  function removeMember(profileId: string) {
    setMembers(prev => prev.filter(m => m.profile?.id !== profileId))
  }

  function setMemberRole(profileId: string, role: string) {
    setMembers(prev => prev.map(m => m.profile?.id === profileId ? { ...m, role } : m))
  }

  // ── Documents ──────────────────────────────────────────────────────────────
  const filteredDocs = allDocs.filter(d =>
    !linkedDocs.find(ld => ld.id === d.id) &&
    (d.title.toLowerCase().includes(docSearch.toLowerCase()) ||
     d.file_name.toLowerCase().includes(docSearch.toLowerCase()))
  )

  function addDoc(doc: Document) {
    setLinkedDocs(prev => [...prev, { ...doc, isNew: true }])
    setDocSearch(''); setDocDropdown(false)
  }

  function removeDoc(id: string) {
    setLinkedDocs(prev => prev.filter(d => d.id !== id))
  }

  // ── Lignes budgétaires ─────────────────────────────────────────────────────
  function addEmptyLine() {
    const existingCount = budgetLines.length + 1
    setBudgetLines(prev => [...prev, {
      _id: Math.random().toString(36).slice(2),
      code: `BUD-${String(existingCount).padStart(3, '0')}`,
      designation: '',
      notes: '',
      isNew: true,
    }])
  }

  function updateLine(id: string, field: keyof BudgetLine, value: string) {
    setBudgetLines(prev => prev.map(l => l._id === id ? { ...l, [field]: value } : l))
  }

  function removeLine(id: string) {
    setBudgetLines(prev => prev.filter(l => l._id !== id))
  }

  function handleBulkImport(lines: Array<{ code: string; designation: string; notes: string }>) {
    setBudgetLines(prev => [
      ...prev,
      ...lines.map(l => ({
        _id: Math.random().toString(36).slice(2),
        code: l.code,
        designation: l.designation,
        notes: l.notes,
        isNew: true,
      })),
    ])
  }

  // ── Soumission ─────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) { toast.error('Le nom est requis'); return }
    setSaving(true)

    try {
      // 1. Mettre à jour le programme principal
      const res = await fetch(`/api/programs/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          objectives: objectives.trim() || null,
          is_active: isActive,
          is_confidential: isConfidential,
          start_date: startDate || null,
          end_date: endDate || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { toast.error(json.error ?? 'Erreur mise à jour'); setSaving(false); return }

      // 2. Synchroniser les membres
      //    On récupère les membres actuels en DB et on diff
      const currentMembersRes = await fetch(`/api/programs/${initial.id}/members`)
      const currentMembers: any[] = currentMembersRes.ok ? await currentMembersRes.json() : []
      const currentProfileIds = new Set(currentMembers.map((m: any) => m.profile?.id))
      const desiredProfileIds = new Set(members.map(m => m.profile?.id))

      // Ajouter les nouveaux
      const toAdd = members.filter(m => !currentProfileIds.has(m.profile?.id))
      // Supprimer les retirés
      const toRemove = currentMembers.filter((m: any) => !desiredProfileIds.has(m.profile?.id))

      await Promise.allSettled([
        ...toAdd.map(m => fetch(`/api/programs/${initial.id}/members`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ profile_id: m.profile.id, role: m.role }),
        })),
        ...toRemove.map((m: any) => fetch(
          `/api/programs/${initial.id}/members?profile_id=${m.profile?.id}`,
          { method: 'DELETE' }
        )),
      ])

      // 3. Synchroniser les documents
      const currentDocsRes = await fetch(`/api/programs/${initial.id}/documents`)
      const currentDocs: any[] = currentDocsRes.ok ? await currentDocsRes.json() : []
      const currentDocIds = new Set(currentDocs.map((d: any) => d.document?.id))
      const desiredDocIds = new Set(linkedDocs.map(d => d.id))

      const docsToAdd    = linkedDocs.filter(d => !currentDocIds.has(d.id))
      const docsToRemove = currentDocs.filter((d: any) => !desiredDocIds.has(d.document?.id))

      await Promise.allSettled([
        ...docsToAdd.map(d => fetch(`/api/programs/${initial.id}/documents`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ document_id: d.id }),
        })),
        ...docsToRemove.map((d: any) => fetch(
          `/api/programs/${initial.id}/documents?document_id=${d.document?.id}`,
          { method: 'DELETE' }
        )),
      ])

      // 4. Lignes budgétaires : créer les nouvelles uniquement
      const newLines = budgetLines.filter(l => !l.id && l.code.trim() && l.designation.trim())
      await Promise.allSettled(
        newLines.map(l => fetch('/api/budget-references', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            program_id: initial.id,
            code: l.code.trim().toUpperCase(),
            designation: l.designation.trim(),
            notes: l.notes.trim() || null,
            is_active: true,
          }),
        }))
      )

      toast.success('Programme mis à jour !')
      router.push(`/programs/${initial.id}`)
      router.refresh()
    } catch {
      toast.error('Erreur inattendue')
      setSaving(false)
    }
  }

  // ── Rendu ──────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl">

      {/* ── Informations générales ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-800">Informations générales</h2>
        </div>

        {/* Nom */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Nom du programme <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition"
          />
        </div>

        {/* Code (lecture seule) */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            <span className="flex items-center gap-1.5"><Hash className="w-3.5 h-3.5 text-gray-400" /> Code</span>
          </label>
          <div className="flex items-center gap-3 px-4 py-2.5 bg-gray-50 border border-dashed border-gray-200 rounded-xl">
            <span className="text-sm font-mono font-semibold text-indigo-500">{initial.code}</span>
            <span className="ml-auto text-xs text-gray-400">Non modifiable</span>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            placeholder="Décrivez le périmètre et le contexte du programme…"
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition resize-none"
          />
        </div>

        {/* Objectifs */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-0.5">
            <span className="flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-indigo-400" />
              Objectifs principaux
              <span className="text-xs text-gray-400 font-normal">(facultatif)</span>
            </span>
          </label>
          <p className="text-xs text-gray-400 mb-1.5">Un objectif par ligne</p>
          <textarea
            value={objectives}
            onChange={e => setObjectives(e.target.value)}
            rows={4}
            placeholder={"- Accompagner 50 porteurs de projet\n- Lancer 3 initiatives pilotes"}
            className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition resize-none font-mono"
          />
        </div>

        {/* Toggles */}
        <div className="flex flex-col gap-3 pt-1">
          {/* Actif */}
          <div className="flex items-center gap-3">
            <Toggle on={isActive} onChange={setIsActive} colorOn="bg-indigo-600" />
            <span className="text-sm text-gray-700">
              Programme&nbsp;<span className={`font-semibold ${isActive ? 'text-green-600' : 'text-gray-400'}`}>
                {isActive ? 'actif' : 'inactif'}
              </span>
            </span>
          </div>

          {/* Confidentialité */}
          <div className="flex items-center gap-3">
            <Toggle on={isConfidential} onChange={setIsConfidential} colorOn="bg-amber-500" />
            <div className="flex items-center gap-1.5">
              {isConfidential
                ? <Lock className="w-3.5 h-3.5 text-amber-500" />
                : <Globe className="w-3.5 h-3.5 text-gray-400" />}
              <span className="text-sm text-gray-700">
                Accès&nbsp;<span className={`font-semibold ${isConfidential ? 'text-amber-600' : 'text-gray-500'}`}>
                  {isConfidential ? 'restreint (confidentiel)' : 'ouvert à tous les membres'}
                </span>
              </span>
            </div>
          </div>
          {isConfidential && (
            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              🔒 Seuls les membres ajoutés au programme pourront y accéder.
            </p>
          )}
        </div>
      </section>

      {/* ── Période ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-800">Période</h2>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Date de début</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Date de fin</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-300 transition" />
          </div>
        </div>
      </section>

      {/* ── Équipe ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-800">Responsable &amp; collaborateurs</h2>
        </div>

        {members.length > 0 && (
          <div className="space-y-2">
            {members.map(m => m.profile && (
              <div key={m.profile.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <div className="w-7 h-7 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center text-xs font-bold flex-shrink-0">
                  {m.profile.full_name?.charAt(0).toUpperCase() ?? '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{m.profile.full_name}</p>
                  <p className="text-xs text-gray-400 truncate">{m.profile.email}</p>
                </div>
                <select
                  value={m.role}
                  onChange={e => setMemberRole(m.profile.id, e.target.value)}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-indigo-300"
                >
                  <option value="responsable">Responsable</option>
                  <option value="chef_projet">Chef de projet</option>
                  <option value="membre">Membre</option>
                  <option value="observateur">Observateur</option>
                </select>
                <button type="button" onClick={() => removeMember(m.profile.id)}
                  className="p-1 text-gray-300 hover:text-red-400 transition flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div ref={memberRef} className="relative">
          <div className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/30 transition cursor-text">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={memberSearch}
              onChange={e => { setMemberSearch(e.target.value); setMemberDropdown(true) }}
              onFocus={() => setMemberDropdown(true)}
              placeholder="Rechercher un membre à ajouter…"
              className="flex-1 text-sm text-gray-600 bg-transparent focus:outline-none placeholder:text-gray-400"
            />
          </div>
          {memberDropdown && filteredProfiles.length > 0 && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
              {filteredProfiles.slice(0, 8).map(p => (
                <button key={p.id} type="button" onClick={() => addMember(p)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-indigo-50 transition text-left">
                  <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {p.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{p.full_name}</p>
                    <p className="text-xs text-gray-400 truncate">{p.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ── Documents de référence ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-800">Documents de référence</h2>
          <span className="text-xs text-gray-400">(facultatif)</span>
        </div>

        {linkedDocs.length > 0 && (
          <div className="space-y-2">
            {linkedDocs.map(d => (
              <div key={d.id} className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 rounded-xl border border-gray-100">
                <File className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{d.title}</p>
                  <p className="text-xs text-gray-400 truncate">{d.file_name}</p>
                </div>
                <button type="button" onClick={() => removeDoc(d.id)}
                  className="p-1 text-gray-300 hover:text-red-400 transition flex-shrink-0">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div ref={docRef} className="relative">
          <div className="flex items-center gap-2 px-3 py-2.5 border border-dashed border-gray-200 rounded-xl hover:border-indigo-300 hover:bg-indigo-50/30 transition cursor-text">
            <Search className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              type="text"
              value={docSearch}
              onChange={e => { setDocSearch(e.target.value); setDocDropdown(true) }}
              onFocus={() => setDocDropdown(true)}
              placeholder="Rechercher un document existant…"
              className="flex-1 text-sm text-gray-600 bg-transparent focus:outline-none placeholder:text-gray-400"
            />
          </div>
          {docDropdown && (
            <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-100 rounded-xl shadow-lg z-20 max-h-48 overflow-y-auto">
              {filteredDocs.length > 0 ? filteredDocs.slice(0, 8).map(d => (
                <button key={d.id} type="button" onClick={() => addDoc(d)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-indigo-50 transition text-left">
                  <File className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm text-gray-800 truncate">{d.title}</p>
                    <p className="text-xs text-gray-400 truncate">{d.file_name}</p>
                  </div>
                </button>
              )) : (
                <p className="px-4 py-3 text-sm text-gray-400">Aucun document trouvé</p>
              )}
            </div>
          )}
        </div>
      </section>

      {/* ── Lignes budgétaires ── */}
      <section className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-indigo-500" />
            <h2 className="text-sm font-semibold text-gray-800">Lignes budgétaires</h2>
            <span className="text-xs text-gray-400">(facultatif)</span>
          </div>
          <div className="flex items-center gap-2">
            <BulkBudgetImport programName={name} onImport={handleBulkImport} />
            <button type="button" onClick={addEmptyLine}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition">
              <Plus className="w-3.5 h-3.5" /> Ajouter
            </button>
          </div>
        </div>

        {budgetLines.length === 0 ? (
          <div className="py-8 text-center border border-dashed border-gray-200 rounded-xl">
            <DollarSign className="w-6 h-6 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Aucune ligne budgétaire</p>
            <p className="text-xs text-gray-300 mt-0.5">Utilisez «&nbsp;Import IA&nbsp;» ou «&nbsp;Ajouter&nbsp;» pour en créer</p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[110px_1fr_1fr_32px] gap-2 px-1">
              <span className="text-xs font-medium text-gray-400">Code</span>
              <span className="text-xs font-medium text-gray-400">Désignation *</span>
              <span className="text-xs font-medium text-gray-400">Notes</span>
              <span />
            </div>
            {budgetLines.map(l => (
              <div key={l._id} className={`grid grid-cols-[110px_1fr_1fr_32px] gap-2 items-center ${!l.id ? 'opacity-100' : ''}`}>
                <input
                  value={l.code}
                  onChange={e => updateLine(l._id, 'code', e.target.value.toUpperCase())}
                  placeholder="BUD-001"
                  maxLength={20}
                  readOnly={!!l.id} // Les lignes existantes ont un code non modifiable
                  className={`border rounded-lg px-2.5 py-2 text-xs font-mono text-gray-700 focus:outline-none w-full ${l.id ? 'bg-gray-50 border-gray-100 text-gray-400' : 'border-gray-200 focus:ring-1 focus:ring-indigo-300'}`}
                />
                <input
                  value={l.designation}
                  onChange={e => updateLine(l._id, 'designation', e.target.value)}
                  placeholder="Ex. Frais de communication"
                  className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300 w-full"
                />
                <input
                  value={l.notes}
                  onChange={e => updateLine(l._id, 'notes', e.target.value)}
                  placeholder="Remarques (optionnel)"
                  className="border border-gray-200 rounded-lg px-2.5 py-2 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-200 w-full"
                />
                <button type="button" onClick={() => removeLine(l._id)}
                  className="p-1 text-gray-300 hover:text-red-400 transition">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Actions ── */}
      <div className="flex items-center justify-end gap-3 pb-8">
        <button type="button" onClick={() => router.back()}
          className="px-4 py-2.5 text-sm text-gray-500 hover:text-gray-700 transition">
          Annuler
        </button>
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="inline-flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition disabled:opacity-50"
        >
          {saving
            ? <RefreshCw className="w-4 h-4 animate-spin" />
            : <Check className="w-4 h-4" />}
          Enregistrer les modifications
        </button>
      </div>
    </form>
  )
}

'use client'

import { useState, useEffect } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { ArrowLeft, UserPlus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { getInitials } from '@/lib/utils'

export default function ProjectMembersPage() {
  const router = useRouter()
  const { id } = useParams<{ id: string }>()
  const [members, setMembers] = useState<any[]>([])
  const [allProfiles, setAllProfiles] = useState<any[]>([])
  const [selectedProfile, setSelectedProfile] = useState('')
  const [selectedRole, setSelectedRole] = useState('membre')
  const [loading, setLoading] = useState(false)
  const [projectTitle, setProjectTitle] = useState('')

  async function load() {
    const supabase = createClient()
    const [projRes, memsRes, { data: profiles }] = await Promise.all([
      fetch(`/api/projects/${id}`),
      fetch(`/api/projects/${id}/members`),
      supabase.from('profiles').select('id, full_name, email').order('full_name'),
    ])
    if (projRes.ok) { const proj = await projRes.json(); setProjectTitle(proj.title) }
    if (memsRes.ok) { const mems = await memsRes.json(); setMembers(mems) }
    if (profiles) setAllProfiles(profiles)
  }

  useEffect(() => { load() }, [id])

  const memberIds = members.map(m => (m.profile as any)?.id)
  const available = allProfiles.filter(p => !memberIds.includes(p.id))

  async function handleAdd() {
    if (!selectedProfile) return
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.from('project_members').insert({
      project_id: id,
      profile_id: selectedProfile,
      role: selectedRole,
    })
    if (error) { toast.error(error.message); setLoading(false); return }

    // Intégrations : fire & forget
    fetch(`/api/projects/${id}/members/invite`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ profile_id: selectedProfile, role: selectedRole }),
    }).catch(() => {})

    const addedProfile = allProfiles.find(p => p.id === selectedProfile)
    fetch('/api/slack/notify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: { type: 'member_added', member: addedProfile?.full_name ?? 'Membre', project: projectTitle, role: selectedRole } }),
    }).catch(() => {})

    // VH-05 — Audit log ajout membre
    fetch('/api/audit-logs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:      'member_added',
        entity_type: 'project',
        entity_id:   id,
        entity_name: projectTitle,
        new_data:    { profile_id: selectedProfile, role: selectedRole },
      }),
    }).catch(() => {})

    toast.success('Membre ajouté')
    setSelectedProfile('')
    await load()
    setLoading(false)
  }

  async function handleRemove(memberId: string, name: string) {
    if (!confirm(`Retirer ${name} du projet ?`)) return
    const supabase = createClient()
    await supabase.from('project_members').delete().eq('id', memberId)

    // VH-05 — Audit log retrait membre
    fetch('/api/audit-logs', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action:      'member_removed',
        entity_type: 'project',
        entity_id:   id,
        entity_name: projectTitle,
        old_data:    { member_id: memberId, name },
      }),
    }).catch(() => {})
    toast.success('Membre retiré')
    await load()
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Link href={`/projects/${id}`} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Membres du projet</h1>
          <p className="text-sm text-gray-500 mt-0.5 truncate max-w-xs">{projectTitle}</p>
        </div>
      </div>

      {/* Ajouter un membre */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <h2 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-blue-600" /> Ajouter un membre
        </h2>
        <div className="flex gap-3">
          <select value={selectedProfile} onChange={e => setSelectedProfile(e.target.value)}
            className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Sélectionner un utilisateur...</option>
            {available.map(p => (
              <option key={p.id} value={p.id}>{p.full_name} — {p.email}</option>
            ))}
          </select>
          <select value={selectedRole} onChange={e => setSelectedRole(e.target.value)}
            className="w-36 px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="membre">Membre</option>
            <option value="responsible">Responsable</option>
            <option value="observateur">Observateur</option>
          </select>
          <button onClick={handleAdd} disabled={!selectedProfile || loading}
            className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
            Ajouter
          </button>
        </div>
      </div>

      {/* Liste membres */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">{members.length} membre{members.length > 1 ? 's' : ''}</h2>
        </div>
        {!members.length ? (
          <p className="text-sm text-gray-400 text-center py-10">Aucun membre dans ce projet</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {members.map(m => {
              const profile = m.profile as any
              return (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-semibold flex-shrink-0">
                    {getInitials(profile?.full_name ?? '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-800">{profile?.full_name}</div>
                    <div className="text-xs text-gray-400">{profile?.email}</div>
                  </div>
                  <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full shrink-0">{(m as any).role_in_project ?? (m as any).role}</span>
                  <button onClick={() => handleRemove(m.id, profile?.full_name)}
                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

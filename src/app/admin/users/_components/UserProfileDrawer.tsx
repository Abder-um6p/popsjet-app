'use client'

import { useState, useEffect } from 'react'
import {
  X, Edit3, Mail, Calendar, ShieldCheck,
  CheckSquare, Globe, Linkedin, Brain, Star, FolderKanban,
  Clock, Users, FileText,
} from 'lucide-react'
import { cn, formatDate, timeAgo, getInitials, LABELS } from '@/lib/utils'
import { toast } from 'sonner'
import type { AdminUser } from './UserTable'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProjectEntry {
  id: string
  title: string
  code: string
  status: string
  type: string
  memberRole: string
  joinedAt: string
}

interface ProfileData {
  profile: AdminUser & {
    bio?: string
    skills?: string[]
    languages?: string[]
    linkedin_url?: string
    invite_note?: string
  }
  lastSignIn: string | null
  projects: ProjectEntry[]
  tasks: { total: number; done: number }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROLE_COLORS: Record<string, string> = {
  admin:       'bg-red-50 text-red-700 ring-1 ring-red-200',
  directeur:   'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
  chef_projet: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  membre:      'bg-gray-100 text-gray-600 ring-1 ring-gray-200',
}

const PROJECT_STATUS_COLOR: Record<string, string> = {
  draft:     'bg-gray-100 text-gray-600',
  active:    'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  archived:  'bg-orange-100 text-orange-700',
}

const PROJECT_STATUS_LABEL: Record<string, string> = {
  draft:     'Brouillon',
  active:    'Actif',
  completed: 'Terminé',
  archived:  'Archivé',
}

function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse bg-gray-100 rounded', className)} />
}

// ─── AI Summary Component ─────────────────────────────────────────────────────

function AiSummary({ profile }: { profile: ProfileData['profile'] }) {
  const [summary, setSummary] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [generated, setGenerated] = useState(false)

  function generate() {
    setLoading(true)
    // Simulate AI summary generation based on profile data
    const skills = profile.skills ?? []
    const languages = profile.languages ?? []
    const roleLabel = LABELS.user_role[profile.role as keyof typeof LABELS.user_role] ?? profile.role

    setTimeout(() => {
      const parts: string[] = []
      if (profile.full_name) {
        parts.push(`**${profile.full_name}** est ${roleLabel.toLowerCase()} sur la plateforme Jet Pops.`)
      }
      if (skills.length > 0) {
        parts.push(`Ses compétences couvrent : ${skills.slice(0, 5).join(', ')}.`)
      }
      if (languages.length > 0) {
        parts.push(`Langues maîtrisées : ${languages.join(', ')}.`)
      }
      if (profile.bio) {
        parts.push(profile.bio)
      }
      if (parts.length === 0) {
        parts.push(`Profil en cours de configuration. Aucune information complémentaire disponible pour le moment.`)
      }
      setSummary(parts.join(' '))
      setGenerated(true)
      setLoading(false)
    }, 1200)
  }

  if (!generated && !loading) {
    return (
      <button
        onClick={generate}
        className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border border-dashed border-purple-200 bg-purple-50/50 text-purple-700 hover:bg-purple-50 hover:border-purple-300 transition text-sm font-medium"
      >
        <Brain className="w-4 h-4" />
        Générer un résumé IA du profil
      </button>
    )
  }

  if (loading) {
    return (
      <div className="p-4 rounded-xl border border-purple-100 bg-purple-50/40 space-y-2">
        <div className="flex items-center gap-2 text-purple-600 text-sm font-medium mb-3">
          <Brain className="w-4 h-4 animate-pulse" />
          Analyse du profil en cours…
        </div>
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    )
  }

  return (
    <div className="p-4 rounded-xl border border-purple-100 bg-gradient-to-br from-purple-50/60 to-blue-50/30">
      <div className="flex items-center gap-2 text-purple-700 text-xs font-semibold uppercase tracking-wider mb-2">
        <Brain className="w-3.5 h-3.5" />
        Résumé IA
      </div>
      <p className="text-sm text-gray-700 leading-relaxed">{summary}</p>
      <button
        onClick={() => { setSummary(null); setGenerated(false) }}
        className="mt-2 text-xs text-purple-500 hover:text-purple-700 transition"
      >
        Régénérer
      </button>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserProfileDrawer({
  user,
  isAdmin,
  onClose,
  onEdit,
}: {
  user: AdminUser
  isAdmin: boolean
  onClose: () => void
  onEdit: () => void
}) {
  const [data, setData] = useState<ProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'overview' | 'projects' | 'activity'>('overview')

  useEffect(() => {
    async function load() {
      setLoading(true)
      const res = await fetch(`/api/admin/users/${user.id}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      } else {
        toast.error('Impossible de charger le profil')
      }
      setLoading(false)
    }
    load()
  }, [user.id])

  const profile = data?.profile
  const isDisabled = !!user.disabled_at
  const isPending = !user.onboarding_completed && !user.disabled_at
  const completionRate = data?.tasks?.total
    ? Math.round((data.tasks.done / data.tasks.total) * 100)
    : 0

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="shrink-0 border-b border-gray-100">
          {/* Top bar */}
          <div className="flex items-center justify-between px-5 py-3.5">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Profil utilisateur</span>
            <div className="flex items-center gap-1">
              {isAdmin && !isDisabled && (
                <button
                  onClick={onEdit}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-lg hover:bg-blue-100 transition"
                >
                  <Edit3 className="w-3 h-3" />
                  Modifier le rôle
                </button>
              )}
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* User identity */}
          <div className="px-5 pb-4">
            <div className="flex items-start gap-4">
              {/* Avatar */}
              <div className={cn(
                'w-16 h-16 rounded-2xl flex items-center justify-center text-white font-bold text-xl overflow-hidden shrink-0 shadow-sm',
                !user.avatar_url && 'bg-gradient-to-br from-blue-500 to-blue-700'
              )}>
                {user.avatar_url
                  ? <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
                  : getInitials(user.full_name || user.email)
                }
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <h2 className="text-lg font-bold text-gray-900 leading-tight truncate">
                    {loading ? <Skeleton className="h-5 w-40" /> : (profile?.full_name || user.email)}
                  </h2>
                </div>
                <p className="text-xs text-gray-400 mt-0.5 truncate">{user.email}</p>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {/* Role badge */}
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', ROLE_COLORS[user.role] ?? 'bg-gray-100 text-gray-600')}>
                    {LABELS.user_role[user.role as keyof typeof LABELS.user_role] ?? user.role}
                  </span>

                  {/* Status badge */}
                  {isDisabled ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-600">
                      Désactivé
                    </span>
                  ) : isPending ? (
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-600">
                      Invitation en attente
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-50 text-green-700">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                      Actif
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex border-t border-gray-100 px-2">
            {[
              { key: 'overview', label: 'Profil', icon: Users },
              { key: 'projects', label: 'Projets', icon: FolderKanban },
              { key: 'activity', label: 'Activité', icon: CheckSquare },
            ].map(tab => {
              const Icon = tab.icon
              const active = activeTab === tab.key
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as typeof activeTab)}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium transition border-b-2',
                    active
                      ? 'text-blue-600 border-blue-600'
                      : 'text-gray-500 border-transparent hover:text-gray-700 hover:border-gray-200'
                  )}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                  {tab.key === 'projects' && !loading && (
                    <span className="ml-0.5 text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full font-semibold">
                      {data?.projects?.length ?? 0}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="p-5 space-y-4">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-3 w-24" />
                  <Skeleton className="h-9 w-full" />
                </div>
              ))}
            </div>
          ) : (
            <>
              {/* ── Overview Tab ── */}
              {activeTab === 'overview' && (
                <div className="p-5 space-y-5">
                  {/* Quick stats */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { icon: FolderKanban, label: 'Projets',  value: data?.projects?.length ?? 0, color: 'text-blue-600',  bg: 'bg-blue-50' },
                      { icon: CheckSquare,  label: 'Tâches',   value: data?.tasks?.total ?? 0,      color: 'text-green-600', bg: 'bg-green-50' },
                      { icon: Star,         label: 'Terminées',value: data?.tasks?.done ?? 0,       color: 'text-purple-600',bg: 'bg-purple-50' },
                    ].map(s => {
                      const Icon = s.icon
                      return (
                        <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center border border-gray-100">
                          <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center mx-auto mb-1.5', s.bg)}>
                            <Icon className={cn('w-3.5 h-3.5', s.color)} />
                          </div>
                          <div className="text-lg font-bold text-gray-800">{s.value}</div>
                          <div className="text-[10px] text-gray-400">{s.label}</div>
                        </div>
                      )
                    })}
                  </div>

                  {/* Task completion */}
                  {(data?.tasks?.total ?? 0) > 0 && (
                    <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600">Taux de complétion</span>
                        <span className="text-xs font-bold text-gray-800">{completionRate}%</span>
                      </div>
                      <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-700"
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1">
                        {data?.tasks?.done} / {data?.tasks?.total} tâches terminées
                      </div>
                    </div>
                  )}

                  {/* Bio */}
                  {profile?.bio && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        <FileText className="w-3 h-3" />
                        Bio
                      </div>
                      <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-3 border border-gray-100">
                        {profile.bio}
                      </p>
                    </div>
                  )}

                  {/* Skills */}
                  {(profile?.skills?.length ?? 0) > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        <Brain className="w-3 h-3" />
                        Compétences
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {profile!.skills!.map(skill => (
                          <span key={skill} className="text-xs px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-100 font-medium">
                            {skill}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Languages */}
                  {(profile?.languages?.length ?? 0) > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                        <Globe className="w-3 h-3" />
                        Langues
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {profile!.languages!.map(lang => (
                          <span key={lang} className="text-xs px-2.5 py-1 bg-green-50 text-green-700 rounded-full border border-green-100 font-medium">
                            {lang}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Info block */}
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                      <ShieldCheck className="w-3 h-3" />
                      Informations compte
                    </div>
                    <div className="divide-y divide-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                      {[
                        { icon: Mail,     label: 'Email',            value: user.email },
                        { icon: Calendar, label: 'Membre depuis',    value: formatDate(user.created_at) },
                        { icon: Clock,    label: 'Dernière connexion', value: data?.lastSignIn ? timeAgo(data.lastSignIn) : 'Jamais' },
                      ].map(row => {
                        const Icon = row.icon
                        return (
                          <div key={row.label} className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-gray-50 transition">
                            <Icon className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                            <span className="text-xs text-gray-500 min-w-32">{row.label}</span>
                            <span className="text-xs font-medium text-gray-700 ml-auto">{row.value}</span>
                          </div>
                        )
                      })}
                      {profile?.linkedin_url && (
                        <a
                          href={profile.linkedin_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 px-4 py-2.5 bg-white hover:bg-blue-50 transition"
                        >
                          <Linkedin className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="text-xs text-gray-500 min-w-32">LinkedIn</span>
                          <span className="text-xs font-medium text-blue-600 ml-auto hover:underline truncate max-w-36">
                            Voir le profil
                          </span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Admin-only note */}
                  {isAdmin && profile?.invite_note && (
                    <div className="p-3.5 bg-amber-50 rounded-xl border border-amber-100">
                      <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-1">
                        Note interne (admin)
                      </div>
                      <p className="text-xs text-amber-800 leading-relaxed">{profile.invite_note}</p>
                    </div>
                  )}

                  {/* AI Summary */}
                  <div>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                      <Brain className="w-3 h-3" />
                      Analyse IA
                    </div>
                    <AiSummary profile={profile!} />
                  </div>
                </div>
              )}

              {/* ── Projects Tab ── */}
              {activeTab === 'projects' && (
                <div className="p-5 space-y-3">
                  {(data?.projects?.length ?? 0) === 0 ? (
                    <div className="py-16 text-center">
                      <FolderKanban className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                      <p className="text-sm text-gray-400">Aucun projet assigné</p>
                    </div>
                  ) : (
                    data!.projects.map(project => (
                      <div
                        key={project.id}
                        className="bg-white rounded-xl border border-gray-100 p-4 hover:border-blue-100 hover:shadow-sm transition"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                {project.code}
                              </span>
                              <span className={cn('text-[10px] font-medium px-1.5 py-0.5 rounded-full', PROJECT_STATUS_COLOR[project.status] ?? 'bg-gray-100 text-gray-600')}>
                                {PROJECT_STATUS_LABEL[project.status] ?? project.status}
                              </span>
                            </div>
                            <div className="text-sm font-semibold text-gray-800 leading-tight">{project.title}</div>
                            <div className="flex items-center gap-3 mt-1.5">
                              <span className="text-xs text-gray-400">
                                {LABELS.project_type[project.type as keyof typeof LABELS.project_type] ?? project.type}
                              </span>
                            </div>
                          </div>
                          <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full shrink-0">
                            {project.memberRole}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-2.5 text-[10px] text-gray-400">
                          <Calendar className="w-3 h-3" />
                          Rejoint {formatDate(project.joinedAt)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* ── Activity Tab ── */}
              {activeTab === 'activity' && (
                <div className="p-5 space-y-4">
                  {/* Task stats */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 rounded-xl border border-gray-100 p-4">
                      <div className="text-2xl font-bold text-gray-800">{data?.tasks?.total ?? 0}</div>
                      <div className="text-xs text-gray-500 mt-0.5">Tâches assignées</div>
                    </div>
                    <div className="bg-green-50 rounded-xl border border-green-100 p-4">
                      <div className="text-2xl font-bold text-green-700">{data?.tasks?.done ?? 0}</div>
                      <div className="text-xs text-green-600 mt-0.5">Tâches terminées</div>
                    </div>
                  </div>

                  {/* Completion bar */}
                  {(data?.tasks?.total ?? 0) > 0 && (
                    <div className="bg-white rounded-xl border border-gray-100 p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-gray-700">Progression globale</span>
                        <span className="text-sm font-bold text-blue-600">{completionRate}%</span>
                      </div>
                      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-700"
                          style={{ width: `${completionRate}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-400 mt-2">
                        {data?.tasks?.done} tâches terminées sur {data?.tasks?.total} au total
                      </p>
                    </div>
                  )}

                  {/* Account timeline */}
                  <div>
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      Chronologie du compte
                    </div>
                    <div className="relative pl-5 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-px before:bg-gray-100">
                      {[
                        { icon: Users, label: 'Compte créé', date: user.created_at, color: 'bg-blue-500' },
                        ...(data?.lastSignIn ? [{
                          icon: Clock,
                          label: 'Dernière connexion',
                          date: data.lastSignIn,
                          color: 'bg-green-500',
                        }] : []),
                        ...(user.disabled_at ? [{
                          icon: X,
                          label: 'Compte désactivé',
                          date: user.disabled_at,
                          color: 'bg-red-500',
                        }] : []),
                      ].map((event, i) => {
                        const Icon = event.icon
                        return (
                          <div key={i} className="relative flex items-start gap-3">
                            <div className={cn('absolute -left-[13px] w-4 h-4 rounded-full flex items-center justify-center', event.color)}>
                              <Icon className="w-2 h-2 text-white" />
                            </div>
                            <div className="pl-1">
                              <div className="text-xs font-medium text-gray-700">{event.label}</div>
                              <div className="text-[10px] text-gray-400 mt-0.5">
                                {formatDate(event.date)} · {timeAgo(event.date)}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-100 px-5 py-3.5 bg-gray-50/50 flex items-center justify-between">
          <div className="text-xs text-gray-400">
            ID: <span className="font-mono">{user.id.slice(0, 8)}…</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </>
  )
}

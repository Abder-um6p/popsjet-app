'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  Search, Plus, RefreshCw, MoreHorizontal,
  ShieldCheck, UserX, UserCheck, Edit3, Eye,
  ChevronUp, ChevronDown, Users, Mail, Clock, KeyRound,
} from 'lucide-react'
import { cn, formatDate, timeAgo, LABELS, getInitials } from '@/lib/utils'
import { toast } from 'sonner'
import AddUserModal from './AddUserModal'
import EditUserModal from './EditUserModal'
import UserProfileDrawer from './UserProfileDrawer'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AdminUser {
  id: string
  full_name: string
  email: string
  role: string
  avatar_url: string | null
  onboarding_completed: boolean
  disabled_at: string | null
  invited_by: string | null
  created_at: string
  updated_at: string
  last_sign_in_at: string | null
}

type UserStatus = 'active' | 'pending' | 'disabled'
type SortKey = 'full_name' | 'role' | 'status' | 'created_at' | 'last_sign_in_at'

function getUserStatus(u: AdminUser): UserStatus {
  if (u.disabled_at) return 'disabled'
  if (!u.onboarding_completed) return 'pending'
  return 'active'
}

const STATUS_CONFIG: Record<UserStatus, { label: string; cls: string; dot: string }> = {
  active:   { label: 'Actif',                cls: 'bg-green-50 text-green-700',   dot: 'bg-green-400' },
  pending:  { label: 'Invitation en attente', cls: 'bg-amber-50 text-amber-700',  dot: 'bg-amber-400' },
  disabled: { label: 'Désactivé',             cls: 'bg-red-50 text-red-600',      dot: 'bg-red-400' },
}

const ROLE_CONFIG: Record<string, { label: string; cls: string }> = {
  admin:       { label: 'Administrateur', cls: 'bg-red-50 text-red-700 ring-1 ring-red-200' },
  directeur:   { label: 'Directeur',      cls: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200' },
  chef_projet: { label: 'Chef de projet', cls: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200' },
  membre:      { label: 'Membre',         cls: 'bg-gray-100 text-gray-600 ring-1 ring-gray-200' },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function Avatar({ user }: { user: AdminUser }) {
  const colors: Record<string, string> = {
    admin:       'from-red-500 to-red-700',
    directeur:   'from-purple-500 to-purple-700',
    chef_projet: 'from-blue-500 to-blue-700',
    membre:      'from-gray-400 to-gray-600',
  }
  const gradient = colors[user.role] ?? 'from-gray-400 to-gray-600'
  return (
    <div className="relative w-9 h-9 shrink-0">
      <div className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden',
        !user.avatar_url && `bg-gradient-to-br ${gradient}`
      )}>
        {user.avatar_url
          ? <img src={user.avatar_url} alt={user.full_name} className="w-full h-full object-cover" />
          : getInitials(user.full_name || user.email)
        }
      </div>
      {getUserStatus(user) === 'active' && (
        <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-white" />
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: UserStatus }) {
  const cfg = STATUS_CONFIG[status]
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full', cfg.cls)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', cfg.dot)} />
      {cfg.label}
    </span>
  )
}

function RoleBadge({ role }: { role: string }) {
  const cfg = ROLE_CONFIG[role] ?? ROLE_CONFIG.membre
  return (
    <span className={cn('text-xs font-medium px-2.5 py-0.5 rounded-full', cfg.cls)}>
      {cfg.label}
    </span>
  )
}

// ─── Actions dropdown ────────────────────────────────────────────────────────

function ActionsMenu({
  user,
  isAdmin,
  currentUserId,
  onEdit,
  onViewProfile,
  onToggleDisable,
  onSendReset,
}: {
  user: AdminUser
  isAdmin: boolean
  currentUserId: string
  onEdit: () => void
  onViewProfile: () => void
  onToggleDisable: () => void
  onSendReset: () => void
}) {
  const [open, setOpen] = useState(false)
  const isSelf = user.id === currentUserId
  const isDisabled = !!user.disabled_at

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-20 bg-white rounded-xl shadow-lg border border-gray-100 py-1.5 w-56 text-sm">
            <button
              onClick={() => { setOpen(false); onViewProfile() }}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-gray-700 hover:bg-gray-50 transition"
            >
              <Eye className="w-3.5 h-3.5 text-gray-400" /> Voir le profil
            </button>
            {isAdmin && !isSelf && (
              <>
                <button
                  onClick={() => { setOpen(false); onEdit() }}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-gray-700 hover:bg-gray-50 transition"
                >
                  <Edit3 className="w-3.5 h-3.5 text-gray-400" /> Modifier le rôle
                </button>
                {!isDisabled && (
                  <button
                    onClick={() => { setOpen(false); onSendReset() }}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-blue-600 hover:bg-blue-50 transition"
                  >
                    <KeyRound className="w-3.5 h-3.5" /> Envoyer lien reset MDP
                  </button>
                )}
                <div className="my-1 mx-2 border-t border-gray-100" />
                <button
                  onClick={() => { setOpen(false); onToggleDisable() }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-4 py-2 transition',
                    isDisabled
                      ? 'text-green-700 hover:bg-green-50'
                      : 'text-red-600 hover:bg-red-50'
                  )}
                >
                  {isDisabled
                    ? <><UserCheck className="w-3.5 h-3.5" /> Réactiver le compte</>
                    : <><UserX className="w-3.5 h-3.5" /> Désactiver le compte</>
                  }
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ─── Sortable column header ──────────────────────────────────────────────────

function SortHeader({
  label, sortKey, current, direction, onClick,
}: {
  label: string; sortKey: SortKey; current: SortKey; direction: 'asc' | 'desc'; onClick: (k: SortKey) => void
}) {
  const active = current === sortKey
  return (
    <th
      className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider cursor-pointer select-none hover:text-gray-600 transition"
      onClick={() => onClick(sortKey)}
    >
      <div className="flex items-center gap-1">
        {label}
        {active
          ? (direction === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
          : <div className="w-3 h-3" />
        }
      </div>
    </th>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserTable({
  isAdmin,
  currentUserId,
}: {
  isAdmin: boolean
  currentUserId: string
}) {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  // Filters
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('created_at')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  // Modals
  const [showAdd, setShowAdd] = useState(false)
  const [editUser, setEditUser] = useState<AdminUser | null>(null)
  const [drawerUser, setDrawerUser] = useState<AdminUser | null>(null)

  async function load(silent = false) {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    const res = await fetch('/api/admin/users')
    if (res.ok) {
      const data = await res.json()
      setUsers(data)
    } else {
      toast.error('Erreur lors du chargement des utilisateurs')
    }
    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => { load() }, [])

  function handleSort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('asc') }
  }

  async function handleSendReset(user: AdminUser) {
    if (!confirm(`Envoyer un lien de réinitialisation de mot de passe à ${user.email} ?`)) return
    const res = await fetch(`/api/admin/users/${user.id}/send-reset`, { method: 'POST' })
    if (res.ok) {
      toast.success(`Lien de réinitialisation envoyé à ${user.email}`)
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Erreur lors de l\'envoi')
    }
  }

  async function handleToggleDisable(user: AdminUser) {
    const isDisabled = !!user.disabled_at
    const action = isDisabled ? 'enable' : 'disable'
    const msg = isDisabled
      ? `Réactiver le compte de ${user.full_name} ?`
      : `Désactiver le compte de ${user.full_name} ? L'utilisateur ne pourra plus se connecter.`
    if (!confirm(msg)) return

    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (res.ok) {
      toast.success(isDisabled ? 'Compte réactivé' : 'Compte désactivé')
      load(true)
    } else {
      const err = await res.json()
      toast.error(err.error ?? 'Erreur')
    }
  }

  // Compute stats
  const stats = useMemo(() => ({
    total:    users.length,
    active:   users.filter(u => !u.disabled_at && u.onboarding_completed).length,
    pending:  users.filter(u => !u.disabled_at && !u.onboarding_completed).length,
    disabled: users.filter(u => !!u.disabled_at).length,
  }), [users])

  // Filter + search + sort
  const filtered = useMemo(() => {
    let list = [...users]

    if (search.trim()) {
      const q = search.toLowerCase()
      list = list.filter(u =>
        u.full_name?.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      )
    }
    if (roleFilter) list = list.filter(u => u.role === roleFilter)
    if (statusFilter) list = list.filter(u => getUserStatus(u) === statusFilter)

    list.sort((a, b) => {
      let av = '', bv = ''
      if (sortKey === 'full_name')        { av = a.full_name ?? a.email; bv = b.full_name ?? b.email }
      else if (sortKey === 'role')        { av = a.role; bv = b.role }
      else if (sortKey === 'status')      { av = getUserStatus(a); bv = getUserStatus(b) }
      else if (sortKey === 'created_at')  { av = a.created_at; bv = b.created_at }
      else if (sortKey === 'last_sign_in_at') { av = a.last_sign_in_at ?? ''; bv = b.last_sign_in_at ?? '' }
      const cmp = av.localeCompare(bv)
      return sortDir === 'asc' ? cmp : -cmp
    })

    return list
  }, [users, search, roleFilter, statusFilter, sortKey, sortDir])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <>
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total',              value: stats.total,    icon: Users,      color: 'text-gray-700',   bg: 'bg-gray-50' },
          { label: 'Actifs',             value: stats.active,   icon: UserCheck,  color: 'text-green-700',  bg: 'bg-green-50' },
          { label: 'Invitations att.',   value: stats.pending,  icon: Mail,       color: 'text-amber-700',  bg: 'bg-amber-50' },
          { label: 'Désactivés',         value: stats.disabled, icon: UserX,      color: 'text-red-600',    bg: 'bg-red-50' },
        ].map(s => {
          const Icon = s.icon
          return (
            <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center gap-3">
                <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center', s.bg)}>
                  <Icon className={cn('w-4.5 h-4.5', s.color)} />
                </div>
                <div>
                  <div className={cn('text-2xl font-bold', s.color)}>{s.value}</div>
                  <div className="text-xs text-gray-500">{s.label}</div>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Filters bar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
        <div className="flex flex-wrap gap-3 items-center">
          {/* Search */}
          <div className="flex-1 min-w-56 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Rechercher par nom ou email…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
            />
          </div>

          {/* Role filter */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 min-w-40"
          >
            <option value="">Tous les rôles</option>
            <option value="admin">Administrateur</option>
            <option value="directeur">Directeur</option>
            <option value="chef_projet">Chef de projet</option>
            <option value="membre">Membre</option>
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-gray-700 min-w-44"
          >
            <option value="">Tous les statuts</option>
            <option value="active">Actif</option>
            <option value="pending">Invitation en attente</option>
            <option value="disabled">Désactivé</option>
          </select>

          {/* Reset */}
          {(search || roleFilter || statusFilter) && (
            <button
              onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter('') }}
              className="px-3 py-2 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
            >
              Réinitialiser
            </button>
          )}

          <div className="ml-auto flex items-center gap-2">
            {/* Refresh */}
            <button
              onClick={() => load(true)}
              className="p-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition"
              title="Rafraîchir"
            >
              <RefreshCw className={cn('w-4 h-4', refreshing && 'animate-spin')} />
            </button>

            {/* Add User */}
            {isAdmin && (
              <button
                onClick={() => setShowAdd(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Inviter un utilisateur
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-50 flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">
            {filtered.length} utilisateur{filtered.length !== 1 ? 's' : ''}
            {filtered.length !== users.length && (
              <span className="text-gray-400 font-normal"> sur {users.length}</span>
            )}
          </span>
          {filtered.length === 0 && search && (
            <span className="text-xs text-gray-400">Aucun résultat pour « {search} »</span>
          )}
        </div>

        {filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400">Aucun utilisateur trouvé</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-50 bg-gray-50/40">
                  <th className="px-5 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider w-10" />
                  <SortHeader label="Nom" sortKey="full_name" current={sortKey} direction={sortDir} onClick={handleSort} />
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-400 uppercase tracking-wider hidden md:table-cell">
                    Email
                  </th>
                  <SortHeader label="Rôle" sortKey="role" current={sortKey} direction={sortDir} onClick={handleSort} />
                  <SortHeader label="Statut" sortKey="status" current={sortKey} direction={sortDir} onClick={handleSort} />
                  <SortHeader label="Dernière connexion" sortKey="last_sign_in_at" current={sortKey} direction={sortDir} onClick={handleSort} />
                  <SortHeader label="Membre depuis" sortKey="created_at" current={sortKey} direction={sortDir} onClick={handleSort} />
                  <th className="px-4 py-3 w-12" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(user => {
                  const status = getUserStatus(user)
                  const isCurrentUser = user.id === currentUserId
                  return (
                    <tr
                      key={user.id}
                      className={cn(
                        'hover:bg-gray-50/60 transition-colors group',
                        user.disabled_at && 'opacity-60'
                      )}
                    >
                      {/* Avatar */}
                      <td className="px-5 py-3.5">
                        <Avatar user={user} />
                      </td>

                      {/* Name */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-semibold text-gray-800 text-sm leading-tight">
                              {user.full_name || '—'}
                              {isCurrentUser && (
                                <span className="ml-2 text-[10px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full">
                                  Vous
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5 md:hidden">{user.email}</div>
                          </div>
                        </div>
                      </td>

                      {/* Email */}
                      <td className="px-4 py-3.5 hidden md:table-cell">
                        <span className="text-xs text-gray-500">{user.email}</span>
                      </td>

                      {/* Role */}
                      <td className="px-4 py-3.5">
                        <RoleBadge role={user.role} />
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5">
                        <StatusBadge status={status} />
                      </td>

                      {/* Last login */}
                      <td className="px-4 py-3.5">
                        {user.last_sign_in_at ? (
                          <div className="flex items-center gap-1.5 text-xs text-gray-500">
                            <Clock className="w-3 h-3 text-gray-300" />
                            {timeAgo(user.last_sign_in_at)}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-300">Jamais</span>
                        )}
                      </td>

                      {/* Created at */}
                      <td className="px-4 py-3.5 text-xs text-gray-400">
                        {formatDate(user.created_at)}
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3.5 text-right">
                        <ActionsMenu
                          user={user}
                          isAdmin={isAdmin}
                          currentUserId={currentUserId}
                          onEdit={() => setEditUser(user)}
                          onViewProfile={() => setDrawerUser(user)}
                          onToggleDisable={() => handleToggleDisable(user)}
                          onSendReset={() => handleSendReset(user)}
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modals & Drawer */}
      {showAdd && (
        <AddUserModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => { setShowAdd(false); load(true) }}
        />
      )}
      {editUser && (
        <EditUserModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSuccess={() => { setEditUser(null); load(true) }}
        />
      )}
      {drawerUser && (
        <UserProfileDrawer
          user={drawerUser}
          isAdmin={isAdmin}
          onClose={() => setDrawerUser(null)}
          onEdit={() => { setDrawerUser(null); setEditUser(drawerUser) }}
        />
      )}
    </>
  )
}

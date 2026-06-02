'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

// ── Cache module-level pour throttler les appels sidebar (PERF-04) ────────────
// Évite les 3 requêtes DB à chaque navigation. TTL = 60s.
const SIDEBAR_CACHE_TTL = 60_000
const sidebarCache: {
  pendingTasks: number
  pendingResets: number
  trashCount: number
  lastFetch: number
} = { pendingTasks: 0, pendingResets: 0, trashCount: 0, lastFetch: 0 }
import type { UserRole } from '@/types/database'
import {
  LayoutDashboard,
  FolderKanban,
  CheckSquare,
  Users,
  Wallet,
  FileText,
  BarChart3,
  User,
  Settings,
  Layers,
  ShieldCheck,
  UserCog,
  KeyRound,
  Trash2,
  Plug,
} from 'lucide-react'
import { cn, getInitials } from '@/lib/utils'
import AppBrand from '@/components/ui/AppBrand'
import { LABELS } from '@/lib/utils'
import { PopcornIcon } from '@/components/ui/PopcornIcon'

const navItems = [
  { href: '/dashboard',    label: 'Mon espace',     icon: LayoutDashboard, roles: ['admin', 'directeur', 'chef_projet', 'membre'] },
  { href: '/programs',     label: 'Programs',       icon: Layers,          roles: ['admin', 'directeur', 'chef_projet', 'membre'] },
  { href: '/projects',     label: 'Projets',        icon: FolderKanban,    roles: ['admin', 'directeur', 'chef_projet', 'membre'] },
  { href: '/tasks',        label: 'Mes tâches',     icon: CheckSquare,     roles: ['admin', 'directeur', 'chef_projet', 'membre'] },
  { href: '/participants', label: 'Participants',    icon: Users,           roles: ['admin', 'directeur', 'chef_projet'] },
  { href: '/expenses',     label: 'Dépenses',       icon: Wallet,          roles: ['admin', 'directeur', 'chef_projet'] },
  { href: '/documents',    label: 'Documents',      icon: FileText,        roles: ['admin', 'directeur', 'chef_projet', 'membre'] },
  { href: '/reports',      label: 'Reporting',      icon: BarChart3,       roles: ['admin', 'directeur'] },
  { href: '/pops',         label: 'Pops',           icon: PopcornIcon,     roles: ['admin', 'directeur', 'chef_projet', 'membre'] },
]

const adminItems = [
  { href: '/admin',                        label: 'Administration',   icon: Settings,    roles: ['admin'] },
  { href: '/admin/users',                  label: 'Utilisateurs',     icon: UserCog,     roles: ['admin', 'directeur'] },
  { href: '/admin/reset-requests',         label: 'Reset MDP',        icon: KeyRound,    roles: ['admin', 'directeur'] },
  { href: '/admin/audit',                  label: 'Audit Logs',       icon: ShieldCheck, roles: ['admin'] },
  { href: '/admin/integrations',           label: 'Intégrations',     icon: Plug,        roles: ['admin'] },
]

interface SidebarProps {
  role: UserRole
  profile?: {
    full_name: string
    email?: string
    role: UserRole
  }
}

export default function Sidebar({ role, profile }: SidebarProps) {
  const pathname = usePathname()
  const visible = (roles: string[]) => roles.includes(role)
  const [pendingResets, setPendingResets] = useState(0)
  const [trashCount, setTrashCount] = useState(0)
  const [pendingTasks, setPendingTasks] = useState(0)

  useEffect(() => {
    const now = Date.now()
    const stale = now - sidebarCache.lastFetch > SIDEBAR_CACHE_TTL

    // Appliquer le cache immédiatement si disponible
    if (sidebarCache.lastFetch > 0) {
      setPendingTasks(sidebarCache.pendingTasks)
      setPendingResets(sidebarCache.pendingResets)
      setTrashCount(sidebarCache.trashCount)
    }

    // Re-fetcher seulement si le cache est expiré
    if (!stale) return

    const isPrivileged = ['admin', 'directeur'].includes(role)

    const fetches: Promise<void>[] = [
      fetch('/api/tasks?section=pending')
        .then(r => r.ok ? r.json() : [])
        .then(data => {
          const v = Array.isArray(data) ? data.length : 0
          sidebarCache.pendingTasks = v
          setPendingTasks(v)
        })
        .catch(() => {}),
    ]

    if (isPrivileged) {
      fetches.push(
        fetch('/api/admin/reset-requests?status=pending')
          .then(r => r.ok ? r.json() : { requests: [] })
          .then(data => {
            const v = data.requests?.length ?? 0
            sidebarCache.pendingResets = v
            setPendingResets(v)
          })
          .catch(() => {}),
        fetch('/api/trash')
          .then(r => r.ok ? r.json() : { total: 0 })
          .then(data => {
            const v = data.total ?? 0
            sidebarCache.trashCount = v
            setTrashCount(v)
          })
          .catch(() => {})
      )
    }

    Promise.all(fetches).then(() => {
      sidebarCache.lastFetch = Date.now()
    })
  }, [role])

  return (
    <aside className="w-60 shrink-0 bg-white border-r border-gray-100 flex flex-col overflow-y-auto">
      {/* Brand */}
      <div className="h-14 flex items-center px-4 border-b border-gray-100 shrink-0">
        <Link href="/dashboard">
          <AppBrand variant="full" />
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto">
        {navItems.filter(item => visible(item.roles)).map(item => {
          // /projects et /programs ne doivent pas être actifs sur leurs pages trash
          const isActive = item.href === '/projects'
            ? (pathname === '/projects' || (pathname.startsWith('/projects/') && !pathname.startsWith('/projects/trash')))
            : item.href === '/programs'
            ? (pathname === '/programs' || (pathname.startsWith('/programs/') && !pathname.startsWith('/programs/trash')))
            : (pathname === item.href || pathname.startsWith(item.href + '/'))
          const Icon = item.icon
          const showTasksBadge = item.href === '/tasks' && pendingTasks > 0
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-blue-50 text-blue-700 shadow-[inset_2px_0_0_0_#2563eb] pl-[10px]'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-[inset_2px_0_0_0_#e5e7eb]'
              )}
            >
              <Icon
                className={cn(
                  'w-4 h-4 shrink-0 transition-colors',
                  isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                )}
              />
              <span className="flex-1">{item.label}</span>
              {showTasksBadge && (
                <span className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 text-purple-700 text-[10px] font-bold shrink-0">
                  {pendingTasks > 9 ? '9+' : pendingTasks}
                </span>
              )}
            </Link>
          )
        })}

        {/* Global Trash — visible to admin + directeur */}
        {visible(['admin', 'directeur']) && (
          <Link
            href="/trash"
            className={cn(
              'group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
              pathname === '/trash' || pathname.startsWith('/trash/')
                ? 'bg-red-50 text-red-700 shadow-[inset_2px_0_0_0_#ef4444] pl-[10px]'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800 hover:shadow-[inset_2px_0_0_0_#e5e7eb]'
            )}
          >
            <Trash2
              className={cn(
                'w-4 h-4 shrink-0 transition-colors',
                pathname === '/trash' || pathname.startsWith('/trash/')
                  ? 'text-red-600'
                  : 'text-gray-400 group-hover:text-gray-600'
              )}
            />
            <span className="flex-1">Corbeille</span>
            {trashCount > 0 && (
              <span className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full bg-red-100 text-red-700 text-[10px] font-bold shrink-0">
                {trashCount > 9 ? '9+' : trashCount}
              </span>
            )}
          </Link>
        )}

        {visible(['admin', 'directeur']) && (
          <>
            <div className="my-2 mx-1 border-t border-gray-100" />
            {adminItems.filter(item => visible(item.roles)).map(item => {
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              const Icon = item.icon
              const showBadge = item.href === '/admin/reset-requests' && pendingResets > 0
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    'group flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-blue-50 text-blue-700 shadow-[inset_2px_0_0_0_#2563eb] pl-[10px]'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 hover:shadow-[inset_2px_0_0_0_#e5e7eb]'
                  )}
                >
                  <Icon
                    className={cn(
                      'w-4 h-4 shrink-0 transition-colors',
                      isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'
                    )}
                  />
                  <span className="flex-1">{item.label}</span>
                  {showBadge && (
                    <span className="ml-auto inline-flex items-center justify-center w-5 h-5 rounded-full bg-amber-500 text-white text-[10px] font-bold shrink-0">
                      {pendingResets > 9 ? '9+' : pendingResets}
                    </span>
                  )}
                </Link>
              )
            })}
          </>
        )}
      </nav>

      {/* User section */}
      <div className="shrink-0 border-t border-gray-100 p-3">
        <Link
          href="/profile"
          className="flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 transition-colors group"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {profile?.full_name ? getInitials(profile.full_name) : <User className="w-4 h-4" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-gray-800 truncate group-hover:text-gray-900">
              {profile?.full_name ?? '—'}
            </p>
            <p className="text-[10px] text-gray-400 truncate">
              {LABELS.user_role[role]}
            </p>
          </div>
        </Link>
      </div>
    </aside>
  )
}

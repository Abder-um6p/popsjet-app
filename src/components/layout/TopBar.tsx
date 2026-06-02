'use client'

import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { LABELS } from '@/lib/utils'
import { toast } from 'sonner'
import { LogOut } from 'lucide-react'
import type { UserRole } from '@/types/database'
import NotificationCenter from '@/components/ui/NotificationCenter'
import GlobalSearch from '@/components/ui/GlobalSearch'

interface TopBarProps {
  profile: {
    id: string
    full_name: string
    role: UserRole
    avatar_url?: string
  }
  leftSlot?: React.ReactNode
}

export default function TopBar({ profile, leftSlot }: TopBarProps) {
  const router = useRouter()

  async function handleLogout() {
    const supabase = createClient()
    await supabase.auth.signOut()
    toast.success('Déconnecté')
    router.push('/auth/login')
    router.refresh()
  }

  return (
    <header className="h-14 bg-white border-b border-gray-100 flex items-center px-4 sm:px-6 gap-3 shrink-0">
      {leftSlot}
      {/* Recherche globale Cmd+K */}
      <div className="flex-1 flex items-center">
        <GlobalSearch />
      </div>
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <NotificationCenter userId={profile.id} />

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Role badge */}
        <span className="text-xs font-medium bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full hidden sm:inline">
          {LABELS.user_role[profile.role]}
        </span>

        {/* Avatar + name */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-semibold shrink-0">
            {profile.full_name?.charAt(0).toUpperCase()}
          </div>
          <span className="text-sm font-semibold text-gray-800 hidden sm:block">
            {profile.full_name}
          </span>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          title="Se déconnecter"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  )
}

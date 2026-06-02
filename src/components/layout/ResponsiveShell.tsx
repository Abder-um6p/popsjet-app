'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Menu, X } from 'lucide-react'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import type { UserRole } from '@/types/database'
import { cn } from '@/lib/utils'

interface Props {
  profile: {
    id: string
    full_name: string
    role: UserRole
    avatar_url?: string
  }
  children: React.ReactNode
}

/**
 * ResponsiveShell — UX-04
 * Sidebar collapsible sur mobile avec hamburger + auto-fermeture après navigation.
 */
export default function ResponsiveShell({ profile, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  // Auto-fermeture après navigation sur mobile
  useEffect(() => { setSidebarOpen(false) }, [pathname])

  const hamburger = (
    <button
      onClick={() => setSidebarOpen(o => !o)}
      className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition shrink-0"
      aria-label="Menu"
    >
      {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
    </button>
  )

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — fixe sur desktop, drawer sur mobile */}
      <div className={cn(
        'fixed inset-y-0 left-0 z-40 lg:static lg:z-auto lg:translate-x-0 transition-transform duration-200',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <Sidebar role={profile.role} profile={profile as any} />
      </div>

      {/* Contenu principal */}
      <div className="flex flex-col flex-1 overflow-hidden min-w-0">
        <TopBar profile={profile} leftSlot={hamburger} />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          {children}
        </main>
      </div>
    </div>
  )
}

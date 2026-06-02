import { createClient, createAdminClient } from '@/lib/supabase/server'
import ProjectsUI from './_components/ProjectsUI'

export const dynamic = 'force-dynamic'

export default async function ProjectsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user!.id)
    .single()

  const admin = createAdminClient()

  // Fetch programs for filter dropdown
  const { data: programs } = await admin
    .from('programs')
    .select('id, name, code, color')
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('name')

  // Fetch trash count (for badge)
  // Utilise deleted_at (pré-existant) car is_deleted peut ne pas encore exister
  // si la migration add_project_trash.sql n'a pas été appliquée.
  let trashCount = 0
  if (['admin', 'directeur'].includes(profile?.role ?? '')) {
    try {
      // Essai 1 : is_deleted (migration appliquée)
      const { count: c1, error: e1 } = await admin
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('is_deleted', true)

      if (!e1) {
        trashCount = c1 ?? 0
      } else {
        // Fallback : deleted_at IS NOT NULL
        const { count: c2 } = await admin
          .from('projects')
          .select('id', { count: 'exact', head: true })
          .not('deleted_at', 'is', null)
        trashCount = c2 ?? 0
      }
    } catch {
      trashCount = 0
    }
  }

  const canCreate = ['admin', 'directeur', 'chef_projet'].includes(profile?.role ?? '')

  return (
    <div className="space-y-6 max-w-7xl">
      <ProjectsUI
        currentUserId={user!.id}
        userRole={profile?.role ?? 'membre'}
        programs={programs ?? []}
        trashCount={trashCount}
        canCreate={canCreate}
      />
    </div>
  )
}

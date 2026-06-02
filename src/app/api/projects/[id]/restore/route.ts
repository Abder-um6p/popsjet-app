import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/projects/[id]/restore — restaurer depuis la corbeille
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile || !['admin', 'directeur'].includes(profile.role)) {
    return NextResponse.json({ error: 'Réservé aux administrateurs et directeurs' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Utiliser deleted_at (toujours présent) pour vérifier l'état de suppression
  const { data: project, error: fetchError } = await admin
    .from('projects')
    .select('id, title, deleted_at')
    .eq('id', id)
    .single()

  if (fetchError || !project) {
    return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })
  }

  if (!project.deleted_at) {
    return NextResponse.json({ error: 'Ce projet n\'est pas dans la corbeille' }, { status: 409 })
  }

  // Tentative 1 : restauration complète (post-migration)
  const { error: e1 } = await admin
    .from('projects')
    .update({ deleted_at: null, deleted_by: null, is_deleted: false })
    .eq('id', id)

  if (e1) {
    console.warn('[projects RESTORE] Update complet échoué, fallback deleted_at :', e1.message)
    const { error: e2 } = await admin.from('projects').update({ deleted_at: null }).eq('id', id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  }

  // TR-03 — cascade : restaurer toutes les tâches soft-deleted de ce projet
  try {
    await admin
      .from('tasks')
      .update({ deleted_at: null, deleted_by: null })
      .eq('project_id', id)
      .not('deleted_at', 'is', null)
  } catch (ex) {
    console.warn('[projects RESTORE] Cascade tasks restauration échouée (non-bloquant) :', ex)
  }

  return NextResponse.json({ ok: true, title: project.title })
}

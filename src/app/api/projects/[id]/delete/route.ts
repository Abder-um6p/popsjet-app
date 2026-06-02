import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// DELETE /api/projects/[id]/delete — soft delete (corbeille)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const admin = createAdminClient()

  // Récupérer le projet — on utilise uniquement deleted_at (pré-existant)
  const { data: project, error: fetchError } = await admin
    .from('projects')
    .select('id, created_by, title, deleted_at')
    .eq('id', id)
    .single()

  if (fetchError || !project) {
    return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })
  }

  if (project.deleted_at) {
    return NextResponse.json({ error: 'Projet déjà dans la corbeille' }, { status: 409 })
  }

  // Vérification des permissions : admin, directeur, ou créateur
  const canDelete =
    ['admin', 'directeur'].includes(profile.role) ||
    project.created_by === user.id

  if (!canDelete) {
    return NextResponse.json(
      { error: 'Permission refusée. Seul l\'administrateur, le directeur ou le créateur peut supprimer ce projet.' },
      { status: 403 }
    )
  }

  const now = new Date().toISOString()

  // Tentative 1 : update complet (post-migration — deleted_by + is_deleted existent)
  const { error: e1 } = await admin
    .from('projects')
    .update({ deleted_at: now, deleted_by: user.id, is_deleted: true })
    .eq('id', id)

  if (e1) {
    // Fallback minimal
    console.warn('[projects DELETE] Update complet échoué, fallback deleted_at uniquement :', e1.message)
    const { error: e2 } = await admin.from('projects').update({ deleted_at: now }).eq('id', id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  }

  // TR-02 — cascade : soft-delete toutes les tâches actives du projet
  try {
    await admin
      .from('tasks')
      .update({ deleted_at: now, deleted_by: user.id })
      .eq('project_id', id)
      .is('deleted_at', null)
  } catch (ex) {
    console.warn('[projects DELETE] Cascade tasks échouée (non-bloquant) :', ex)
  }

  return NextResponse.json({ ok: true, title: project.title })
}

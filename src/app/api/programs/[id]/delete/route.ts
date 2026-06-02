import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// DELETE /api/programs/[id]/delete — soft delete (corbeille)
// Permissions : admin / directeur uniquement
export async function DELETE(
  _req: NextRequest,
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

  const { data: program, error: fetchError } = await admin
    .from('programs')
    .select('id, name, deleted_at')
    .eq('id', id)
    .single()

  if (fetchError || !program) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })
  if (program.deleted_at)    return NextResponse.json({ error: 'Programme déjà dans la corbeille' }, { status: 409 })

  const now = new Date().toISOString()

  // Tentative 1 : avec deleted_by
  const { error: e1 } = await admin
    .from('programs')
    .update({ deleted_at: now, deleted_by: user.id })
    .eq('id', id)

  if (e1) {
    // Fallback : sans deleted_by (migration pas encore appliquée)
    const { error: e2 } = await admin.from('programs').update({ deleted_at: now }).eq('id', id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  }

  // TR-02 — cascade : soft-delete les projets actifs du programme
  let deletedProjects = 0
  try {
    const { data: activeProjects } = await admin
      .from('projects')
      .select('id')
      .eq('program_id', id)
      .is('deleted_at', null)

    if (activeProjects && activeProjects.length > 0) {
      const projectIds = activeProjects.map((p: { id: string }) => p.id)
      await admin
        .from('projects')
        .update({ deleted_at: now, deleted_by: user.id, is_deleted: true })
        .in('id', projectIds)

      // Cascade tâches de ces projets aussi
      await admin
        .from('tasks')
        .update({ deleted_at: now, deleted_by: user.id })
        .in('project_id', projectIds)
        .is('deleted_at', null)

      deletedProjects = projectIds.length
    }
  } catch (ex) {
    console.warn('[programs DELETE] Cascade projets échouée (non-bloquant) :', ex)
  }

  return NextResponse.json({ ok: true, name: program.name, deletedProjects })
}

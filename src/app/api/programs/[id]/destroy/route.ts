import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// DELETE /api/programs/[id]/destroy — suppression définitive (admin/directeur uniquement)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, email').eq('id', user.id).single()

  if (!profile || !['admin', 'directeur'].includes(profile.role)) {
    return NextResponse.json({ error: 'Réservé aux administrateurs et directeurs' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: program, error: fetchError } = await admin
    .from('programs').select('id, name, deleted_at').eq('id', id).single()

  if (fetchError || !program) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })
  if (!program.deleted_at) return NextResponse.json(
    { error: 'Le programme doit être dans la corbeille avant suppression définitive' },
    { status: 409 }
  )

  // ── C-05 : vérification des projets liés ──────────────────────────────────
  // Bloquer la suppression définitive si des projets référencent encore ce
  // programme — cela évite des FK orphelines (project.program_id sans cible).
  // On compte TOUS les projets liés, y compris soft-deleted.
  const { count: linkedProjects } = await admin
    .from('projects')
    .select('id', { count: 'exact', head: true })
    .eq('program_id', id)

  if (linkedProjects && linkedProjects > 0) {
    return NextResponse.json(
      {
        error: `Impossible de supprimer définitivement ce programme : ${linkedProjects} projet${linkedProjects > 1 ? 's' : ''} y est encore rattaché${linkedProjects > 1 ? 's' : ''}. Supprimez définitivement ces projets ou désassociez-les d'abord.`,
        linkedProjects,
      },
      { status: 409 }
    )
  }

  // ── Audit snapshot avant suppression ─────────────────────────────────────
  try {
    await admin.from('audit_logs').insert({
      user_id:     user.id,
      user_email:  (profile as any).email ?? null,
      action:      'program_destroyed',
      entity_type: 'program',
      entity_id:   id,
      entity_name: program.name,
      old_data:    program as any,
    })
  } catch { /* swallow */ }

  const { error: destroyError } = await admin
    .from('programs').delete().eq('id', id)

  if (destroyError) return NextResponse.json({ error: destroyError.message }, { status: 500 })
  return NextResponse.json({ ok: true, name: program.name })
}

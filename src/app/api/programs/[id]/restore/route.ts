import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/programs/[id]/restore — restaure un programme depuis la corbeille
// M-10 : cascade vers les projets soft-deleted liés (supprimés dans la même fenêtre de temps ±5 min).
export async function POST(
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
    .from('programs').select('id, name, deleted_at').eq('id', id).single()

  if (fetchError || !program) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })
  if (!program.deleted_at)    return NextResponse.json({ error: 'Ce programme n\'est pas dans la corbeille' }, { status: 409 })

  // ── Restauration du programme ─────────────────────────────────────────────
  // Tentative 1 : reset complet (deleted_at + deleted_by)
  const { error: e1 } = await admin
    .from('programs')
    .update({ deleted_at: null, deleted_by: null })
    .eq('id', id)

  // Fallback : deleted_at uniquement (pre-migration deleted_by)
  if (e1) {
    const { error: e2 } = await admin
      .from('programs').update({ deleted_at: null }).eq('id', id)
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  }

  // ── M-10 : cascade vers projets liés soft-deleted ─────────────────────────
  // Restaure automatiquement les projets supprimés dans la même fenêtre de temps
  // que le programme (±5 min). Les projets indépendamment supprimés sont ignorés.
  let restoredProjects = 0
  try {
    const programDeletedAt = new Date(program.deleted_at)
    const windowMs = 5 * 60 * 1000 // tolérance 5 minutes

    const lowerBound = new Date(programDeletedAt.getTime() - windowMs).toISOString()
    const upperBound = new Date(programDeletedAt.getTime() + windowMs).toISOString()

    const { data: linkedDeleted } = await admin
      .from('projects')
      .select('id')
      .eq('program_id', id)
      .not('deleted_at', 'is', null)
      .gte('deleted_at', lowerBound)
      .lte('deleted_at', upperBound)

    if (linkedDeleted && linkedDeleted.length > 0) {
      const projectIds = linkedDeleted.map((p: { id: string }) => p.id)

      // Tentative 1 : reset complet
      const { error: rErr } = await admin
        .from('projects')
        .update({ deleted_at: null, deleted_by: null, is_deleted: false })
        .in('id', projectIds)

      if (rErr) {
        // Fallback : deleted_at uniquement
        await admin.from('projects').update({ deleted_at: null }).in('id', projectIds)
      }

      restoredProjects = projectIds.length
    }
  } catch (cascadeErr) {
    // Non-bloquant — programme restauré même si cascade échoue
    console.warn('[programs/restore] Cascade restore warning:', cascadeErr)
  }

  return NextResponse.json({
    ok:              true,
    name:            program.name,
    restoredProjects,
    ...(restoredProjects > 0
      ? { message: `Programme restauré avec ${restoredProjects} projet${restoredProjects > 1 ? 's' : ''} associé${restoredProjects > 1 ? 's' : ''}` }
      : {}),
  })
}

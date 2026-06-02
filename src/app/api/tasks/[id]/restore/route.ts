import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/tasks/[id]/restore — restaurer une tâche depuis la corbeille
// Permissions : admin, directeur, chef_projet, ou créateur de la tâche
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const admin = createAdminClient()

    // ── Étape 1 : la tâche doit exister ET être dans la corbeille ─────────────
    const { data: task, error: fetchError } = await admin
      .from('tasks')
      .select('id, project_id, title, assigned_to, created_by, status, deleted_at')
      .eq('id', id)
      .not('deleted_at', 'is', null)
      .single()

    if (fetchError || !task) {
      return NextResponse.json({ error: 'Tâche introuvable dans la corbeille' }, { status: 404 })
    }

    // ── Étape 1b : vérifier que le projet parent n'est pas lui-même supprimé ───
    const { data: parentProject } = await admin
      .from('projects')
      .select('id, title, deleted_at')
      .eq('id', task.project_id)
      .single()

    if (!parentProject) {
      return NextResponse.json(
        { error: 'Le projet parent de cette tâche est introuvable — restauration impossible.' },
        { status: 409 }
      )
    }

    if (parentProject.deleted_at) {
      return NextResponse.json(
        { error: `Impossible de restaurer cette tâche : le projet parent "${parentProject.title}" est lui-même dans la corbeille. Restaurez d'abord le projet.` },
        { status: 409 }
      )
    }

    // ── Étape 2 : rôle utilisateur ────────────────────────────────────────────
    const { data: profile } = await admin
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? 'membre'
    const isPrivileged = ['admin', 'directeur', 'chef_projet'].includes(role)
    const isCreator    = task.created_by === user.id

    if (!isPrivileged && !isCreator) {
      return NextResponse.json(
        { error: 'Permission refusée — seuls les administrateurs, directeurs, chefs de projet ou le créateur peuvent restaurer cette tâche' },
        { status: 403 }
      )
    }

    const now = new Date().toISOString()

    // ── Tentative 1 : update complet (reset deleted_at + deleted_by) ──────────
    const { data: updated, error: e1 } = await admin
      .from('tasks')
      .update({ deleted_at: null, deleted_by: null, updated_at: now })
      .eq('id', id)
      .select()
      .single()

    let finalTask = updated
    if (e1) {
      // Fallback : sans colonne v1.6 deleted_by
      console.warn('[restore] Update complet échoué, fallback:', e1.message)
      const { data: fallback, error: e2 } = await admin
        .from('tasks')
        .update({ deleted_at: null, updated_at: now })
        .eq('id', id)
        .select()
        .single()
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      finalTask = fallback
    }

    // Log d'activité (non-bloquant)
    try {
      await admin.from('task_activity_logs').insert({
        task_id: id, user_id: user.id, action: 'restored',
        old_value: 'deleted', new_value: task.status,
        note: `Tâche restaurée par ${profile?.full_name ?? 'un membre'}`,
        created_at: now,
      })
    } catch { /* swallow */ }

    // Notification à l'assigné si différent du restorer
    if (task.assigned_to && task.assigned_to !== user.id) {
      try {
        await admin.from('notifications').insert({
          user_id: task.assigned_to, type: 'task_restored',
          title: 'Tâche restaurée',
          message: `${profile?.full_name ?? 'Un membre'} a restauré la tâche "${task.title}"`,
          data: { task_id: id, project_id: task.project_id },
          is_read: false,
        })
      } catch { /* swallow */ }
    }

    return NextResponse.json({ ok: true, task: finalTask })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? (err.stack ?? '').slice(0, 600) : ''
    console.error('[restore] UNHANDLED EXCEPTION:', msg, stack)
    return NextResponse.json({ error: msg, stack }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { insertAuditLog } from '@/lib/api-helpers'

// DELETE /api/tasks/[id]/delete — soft-delete d'une tâche
// Permissions : admin, directeur, chef_projet, ou créateur de la tâche
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const admin = createAdminClient()

    // ── Étape 1 : colonnes garanties ──────────────────────────────────────────
    const { data: task, error: fetchError } = await admin
      .from('tasks')
      .select('id, project_id, title, assigned_to, created_by, status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (fetchError || !task) {
      return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })
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
        { error: 'Permission refusée — seuls les administrateurs, directeurs, chefs de projet ou le créateur peuvent supprimer cette tâche' },
        { status: 403 }
      )
    }

    const now = new Date().toISOString()

    // ── Tentative 1 : update complet avec colonne v1.6 deleted_by ─────────────
    const { data: updated, error: e1 } = await admin
      .from('tasks')
      .update({
        deleted_at: now,
        deleted_by: user.id,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single()

    let finalTask = updated
    if (e1) {
      // Fallback : sans colonne v1.6 deleted_by
      console.warn('[delete] Update complet échoué, fallback:', e1.message)
      const { data: fallback, error: e2 } = await admin
        .from('tasks')
        .update({ deleted_at: now, updated_at: now })
        .eq('id', id)
        .select()
        .single()
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      finalTask = fallback
    }

    // Log d'activité (non-bloquant)
    try {
      await admin.from('task_activity_logs').insert({
        task_id: id, user_id: user.id, action: 'deleted',
        old_value: task.status, new_value: 'deleted',
        note: `Tâche supprimée par ${profile?.full_name ?? 'un membre'}`,
        created_at: now,
      })
    } catch { /* swallow */ }

    // VH-05 — Audit log suppression tâche
    await insertAuditLog({
      admin, userId: user.id, userEmail: null,
      action: 'task_deleted', entityType: 'task', entityId: id, entityName: task.title,
      oldData: { status: task.status, project_id: task.project_id },
    })

    // Recalcul completion_pct du projet (non-bloquant)
    try {
      const { data: allTasks } = await admin
        .from('tasks')
        .select('status')
        .eq('project_id', task.project_id)
        .is('deleted_at', null)
      if (allTasks && allTasks.length > 0) {
        // Exclure cancelled et refused du dénominateur (tâches terminées négativement)
        const activeTasks = allTasks.filter(t => !['cancelled', 'refused'].includes(t.status))
        const done = activeTasks.filter(t => t.status === 'done').length
        const newPct = activeTasks.length > 0 ? Math.round((done / activeTasks.length) * 100) : 0
        await admin.from('projects').update({ completion_pct: newPct }).eq('id', task.project_id)
      } else {
        // Plus aucune tâche active → remise à 0
        await admin.from('projects').update({ completion_pct: 0 }).eq('id', task.project_id)
      }
    } catch { /* swallow */ }

    // Notification à l'assigné si différent du suppresseur
    if (task.assigned_to && task.assigned_to !== user.id) {
      try {
        await admin.from('notifications').insert({
          user_id: task.assigned_to, type: 'task_deleted',
          title: 'Tâche supprimée',
          message: `${profile?.full_name ?? 'Un membre'} a supprimé la tâche "${task.title}"`,
          related_id: id, related_type: 'task',
          is_read: false,
        })
      } catch { /* swallow */ }
    }

    return NextResponse.json({ ok: true, task: finalTask })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? (err.stack ?? '').slice(0, 600) : ''
    console.error('[delete] UNHANDLED EXCEPTION:', msg, stack)
    return NextResponse.json({ error: msg, stack }, { status: 500 })
  }
}

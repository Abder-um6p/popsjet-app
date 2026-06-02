import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const VALID_STATUSES = ['todo', 'in_progress', 'review', 'done', 'blocked', 'cancelled']
// 'blocked' et 'refused' peuvent ne pas exister avant migration — fallback vers cancelled

// PATCH /api/tasks/[id]/status — changer le statut d'une tâche active
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const { status, note } = body

  if (!status) {
    return NextResponse.json({ error: 'Le champ "status" est requis' }, { status: 400 })
  }

  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json(
      { error: `Statut invalide. Valeurs acceptées : ${VALID_STATUSES.join(', ')}` },
      { status: 400 }
    )
  }

  const admin = createAdminClient()

  const { data: task, error: fetchError } = await admin
    .from('tasks')
    .select('id, project_id, title, assigned_to, created_by, status')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !task) {
    return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })
  }

  // Vérifier si pending_acceptance (colonne optionnelle)
  if (task.status === 'pending_acceptance') {
    return NextResponse.json(
      { error: 'Cette tâche est en attente d\'acceptation. Utilisez /accept ou /refuse.' },
      { status: 409 }
    )
  }

  // Permissions
  const { data: profile } = await supabase
    .from('profiles').select('role, full_name').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const isAssignee   = task.assigned_to === user.id
  const isCreator    = task.created_by === user.id
  const isPrivileged = ['admin', 'directeur', 'chef_projet'].includes(profile.role)

  if (!isAssignee && !isCreator && !isPrivileged) {
    const { data: membership } = await admin
      .from('project_members')
      .select('role')
      .eq('project_id', task.project_id)
      .eq('profile_id', user.id)
      .maybeSingle()
    if (!membership || !['admin', 'directeur', 'chef_projet'].includes(membership.role ?? '')) {
      return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
    }
  }

  const oldStatus = task.status
  const now = new Date().toISOString()

  // Tentative 1 : statut demandé (peut échouer si 'blocked' absent de l'enum DB)
  const { data: updated, error: e1 } = await admin
    .from('tasks')
    .update({ status, updated_at: now })
    .eq('id', id)
    .select()
    .single()

  let finalTask = updated
  if (e1) {
    // Fallback : 'blocked' → 'in_progress', 'refused' → 'cancelled'
    const fallbackStatus = status === 'blocked' ? 'in_progress' : 'cancelled'
    console.warn(`[status] Update ${status} échoué, fallback ${fallbackStatus}:`, e1.message)
    const { data: fallback, error: e2 } = await admin
      .from('tasks')
      .update({ status: fallbackStatus, updated_at: now })
      .eq('id', id)
      .select()
      .single()
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    finalTask = fallback
  }

  // Log (non-bloquant). PostgrestBuilder n'a pas `.catch()`, vrai try/catch requis.
  try {
    await admin.from('task_activity_logs').insert({
      task_id: id, user_id: user.id, action: 'status_change',
      old_value: oldStatus, new_value: finalTask?.status ?? status,
      note: note ?? `Statut changé par ${profile.full_name}`,
      created_at: now,
    })
  } catch { /* swallow */ }

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
    }
  } catch { /* swallow */ }

  // Notification si done
  if (status === 'done' && task.created_by !== user.id) {
    try {
      await admin.from('notifications').insert({
        user_id: task.created_by, type: 'task_done',
        title: 'Tâche terminée',
        message: `${profile.full_name} a marqué la tâche "${task.title}" comme terminée`,
        related_id: id, related_type: 'task',
        is_read: false,
      })
    } catch { /* swallow */ }
  }

  return NextResponse.json({ ok: true, task: finalTask })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? (err.stack ?? '').slice(0, 600) : ''
    console.error('[status] UNHANDLED EXCEPTION:', msg, stack)
    return NextResponse.json({ error: msg, stack }, { status: 500 })
  }
}

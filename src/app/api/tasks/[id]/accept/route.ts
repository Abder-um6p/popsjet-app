import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/tasks/[id]/accept — accepter une tâche assignée
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

  if (task.assigned_to !== user.id) {
    return NextResponse.json({ error: 'Seul l\'assigné peut accepter cette tâche' }, { status: 403 })
  }

  // ── Étape 2 : colonnes v1.4 (optionnelles) ────────────────────────────────
  const { data: acc } = await admin
    .from('tasks')
    .select('assigned_by, pending_acceptance')
    .eq('id', id)
    .maybeSingle()

  const pendingAcceptance = acc?.pending_acceptance ?? false
  const assignedBy        = acc?.assigned_by ?? null

  // Si la migration n'est pas appliquée, on vérifie via le statut
  const isPending = pendingAcceptance || task.status === 'pending_acceptance'

  if (!isPending) {
    return NextResponse.json({ error: 'Cette tâche n\'est pas en attente d\'acceptation' }, { status: 409 })
  }

  const now = new Date().toISOString()

  // ── Tentative 1 : update avec colonnes v1.4 ───────────────────────────────
  const { data: updated, error: e1 } = await admin
    .from('tasks')
    .update({ status: 'todo', pending_acceptance: false, accepted_at: now, updated_at: now })
    .eq('id', id)
    .select()
    .single()

  let finalTask = updated
  if (e1) {
    // Fallback : update sans colonnes v1.4
    console.warn('[accept] Update complet échoué, fallback:', e1.message)
    const { data: fallback, error: e2 } = await admin
      .from('tasks')
      .update({ status: 'todo', updated_at: now })
      .eq('id', id)
      .select()
      .single()
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    finalTask = fallback
  }

  // Log d'activité (non-bloquant, table peut ne pas exister).
  // NOTE: PostgrestBuilder n'a pas `.catch()` — il faut un vrai try/catch.
  try {
    await admin.from('task_activity_logs').insert({
      task_id: id, user_id: user.id, action: 'accepted',
      old_value: 'pending_acceptance', new_value: 'todo',
      note: 'Tâche acceptée', created_at: now,
    })
  } catch { /* swallow */ }

  // Notifications
  const { data: accepterProfile } = await admin
    .from('profiles').select('full_name').eq('id', user.id).single()
  const accepterName = accepterProfile?.full_name ?? 'Un membre'

  const notifyIds = new Set<string>()
  if (assignedBy && assignedBy !== user.id)   notifyIds.add(assignedBy)
  if (task.created_by && task.created_by !== user.id) notifyIds.add(task.created_by)

  for (const recipientId of notifyIds) {
    try {
      await admin.from('notifications').insert({
        user_id: recipientId, type: 'task_accepted',
        title: 'Tâche acceptée',
        message: `${accepterName} a accepté la tâche "${task.title}"`,
        related_id: id, related_type: 'task',
        is_read: false,
      })
    } catch { /* swallow */ }
  }

  return NextResponse.json({ ok: true, task: finalTask })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? (err.stack ?? '').slice(0, 600) : ''
    console.error('[accept] UNHANDLED EXCEPTION:', msg, stack)
    return NextResponse.json({ error: msg, stack }, { status: 500 })
  }
}

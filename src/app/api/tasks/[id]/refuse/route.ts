import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/tasks/[id]/refuse — refuser une tâche assignée
export async function POST(
  req: NextRequest,
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
    return NextResponse.json({ error: 'Seul l\'assigné peut refuser cette tâche' }, { status: 403 })
  }

  // ── Étape 2 : colonnes v1.4 (optionnelles) ────────────────────────────────
  const { data: acc } = await admin
    .from('tasks')
    .select('assigned_by, pending_acceptance')
    .eq('id', id)
    .maybeSingle()

  const pendingAcceptance = acc?.pending_acceptance ?? false
  const assignedBy        = acc?.assigned_by ?? null
  const isPending         = pendingAcceptance || task.status === 'pending_acceptance'

  if (!isPending) {
    return NextResponse.json({ error: 'Cette tâche n\'est pas en attente d\'acceptation' }, { status: 409 })
  }

  // Raison optionnelle
  let reason: string | null = null
  try { const body = await req.json(); reason = body?.reason ?? null } catch { /* pas de body */ }

  const now = new Date().toISOString()

  // ── Tentative 1 : update avec colonnes v1.4 ───────────────────────────────
  const { data: updated, error: e1 } = await admin
    .from('tasks')
    .update({ status: 'refused', pending_acceptance: false, refused_at: now, refused_by: user.id, refused_reason: reason, updated_at: now })
    .eq('id', id)
    .select()
    .single()

  let finalTask = updated
  if (e1) {
    // Fallback : statut cancelled (pré-migration, pas de colonne 'refused')
    console.warn('[refuse] Update complet échoué, fallback:', e1.message)
    const { data: fallback, error: e2 } = await admin
      .from('tasks')
      .update({ status: 'cancelled', updated_at: now })
      .eq('id', id)
      .select()
      .single()
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    finalTask = fallback
  }

  // Log d'activité (non-bloquant). PostgrestBuilder n'a pas `.catch()`.
  try {
    await admin.from('task_activity_logs').insert({
      task_id: id, user_id: user.id, action: 'refused',
      old_value: 'pending_acceptance', new_value: finalTask?.status ?? 'refused',
      note: reason ?? 'Tâche refusée sans raison', created_at: now,
    })
  } catch { /* swallow */ }

  // Notifications
  const { data: refuserProfile } = await admin
    .from('profiles').select('full_name').eq('id', user.id).single()
  const refuserName = refuserProfile?.full_name ?? 'Un membre'

  const notifyIds = new Set<string>()
  if (assignedBy && assignedBy !== user.id)         notifyIds.add(assignedBy)
  if (task.created_by && task.created_by !== user.id) notifyIds.add(task.created_by)

  const msg = reason
    ? `${refuserName} a refusé la tâche "${task.title}" : "${reason}"`
    : `${refuserName} a refusé la tâche "${task.title}"`

  for (const recipientId of notifyIds) {
    try {
      await admin.from('notifications').insert({
        user_id: recipientId, type: 'task_refused',
        title: 'Tâche refusée', message: msg,
        related_id: id, related_type: 'task',
        is_read: false,
      })
    } catch { /* swallow */ }
  }

  return NextResponse.json({ ok: true, task: finalTask })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? (err.stack ?? '').slice(0, 600) : ''
    console.error('[refuse] UNHANDLED EXCEPTION:', msg, stack)
    return NextResponse.json({ error: msg, stack }, { status: 500 })
  }
}

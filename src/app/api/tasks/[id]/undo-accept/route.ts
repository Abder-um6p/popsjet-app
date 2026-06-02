import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/tasks/[id]/undo-accept — annuler l'acceptation d'une tâche (la repasser en pending_acceptance)
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
      return NextResponse.json({ error: 'Seul l\'assigné peut annuler l\'acceptation' }, { status: 403 })
    }

    if (task.status !== 'todo') {
      return NextResponse.json(
        { error: 'Annulation impossible : la tâche n\'est plus dans le statut « À faire »' },
        { status: 409 }
      )
    }

    // ── Étape 2 : colonnes v1.4 (optionnelles) ────────────────────────────────
    const { data: acc } = await admin
      .from('tasks')
      .select('assigned_by, accepted_at')
      .eq('id', id)
      .maybeSingle()

    const assignedBy = acc?.assigned_by ?? null
    const acceptedAt = acc?.accepted_at ?? null

    if (!acceptedAt) {
      return NextResponse.json(
        { error: 'Cette tâche n\'a pas été acceptée — rien à annuler' },
        { status: 409 }
      )
    }

    const now = new Date().toISOString()

    // ── Tentative 1 : update complet avec colonnes v1.6 ───────────────────────
    const { data: updated, error: e1 } = await admin
      .from('tasks')
      .update({
        status: 'pending_acceptance',
        pending_acceptance: true,
        acceptance_reset_at: now,
        accepted_at: null,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single()

    let finalTask = updated
    if (e1) {
      // Fallback : sans colonne v1.6 acceptance_reset_at
      console.warn('[undo-accept] Update complet échoué, fallback:', e1.message)
      const { data: fallback, error: e2 } = await admin
        .from('tasks')
        .update({
          status: 'pending_acceptance',
          pending_acceptance: true,
          accepted_at: null,
          updated_at: now,
        })
        .eq('id', id)
        .select()
        .single()
      if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
      finalTask = fallback
    }

    // Log d'activité (non-bloquant)
    try {
      await admin.from('task_activity_logs').insert({
        task_id: id, user_id: user.id, action: 'acceptance_reset',
        old_value: 'todo', new_value: 'pending_acceptance',
        note: 'Acceptation annulée par l\'assigné', created_at: now,
      })
    } catch { /* swallow */ }

    // Notifications
    const { data: userProfile } = await admin
      .from('profiles').select('full_name').eq('id', user.id).single()
    const userName = userProfile?.full_name ?? 'Un membre'

    const notifyIds = new Set<string>()
    if (assignedBy && assignedBy !== user.id)           notifyIds.add(assignedBy)
    if (task.created_by && task.created_by !== user.id) notifyIds.add(task.created_by)

    for (const recipientId of notifyIds) {
      try {
        await admin.from('notifications').insert({
          user_id: recipientId, type: 'task_acceptance_reset',
          title: 'Acceptation annulée',
          message: `${userName} a annulé son acceptation de la tâche "${task.title}"`,
          related_id: id, related_type: 'task',
          is_read: false,
        })
      } catch { /* swallow */ }
    }

    return NextResponse.json({ ok: true, task: finalTask })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? (err.stack ?? '').slice(0, 600) : ''
    console.error('[undo-accept] UNHANDLED EXCEPTION:', msg, stack)
    return NextResponse.json({ error: msg, stack }, { status: 500 })
  }
}

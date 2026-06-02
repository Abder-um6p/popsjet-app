import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/tasks/[id]/undo-refuse — accepter une tâche précédemment refusée
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
      return NextResponse.json({ error: 'Seul l\'assigné peut annuler son refus' }, { status: 403 })
    }

    if (task.status !== 'refused') {
      return NextResponse.json(
        { error: 'Cette tâche n\'est pas refusée — rien à annuler' },
        { status: 409 }
      )
    }

    // ── Étape 2 : colonnes v1.4 (optionnelles) ────────────────────────────────
    const { data: acc } = await admin
      .from('tasks')
      .select('assigned_by')
      .eq('id', id)
      .maybeSingle()

    const assignedBy = acc?.assigned_by ?? null

    const now = new Date().toISOString()

    // ── Tentative 1 : update complet avec colonnes v1.6 ───────────────────────
    const { data: updated, error: e1 } = await admin
      .from('tasks')
      .update({
        status: 'todo',
        pending_acceptance: false,
        refusal_override_at: now,
        refused_at: null,
        refused_by: null,
        refused_reason: null,
        updated_at: now,
      })
      .eq('id', id)
      .select()
      .single()

    let finalTask = updated
    if (e1) {
      // Fallback : sans colonne v1.6 refusal_override_at
      console.warn('[undo-refuse] Update complet échoué, fallback:', e1.message)
      const { data: fallback, error: e2 } = await admin
        .from('tasks')
        .update({
          status: 'todo',
          pending_acceptance: false,
          refused_at: null,
          refused_by: null,
          refused_reason: null,
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
        task_id: id, user_id: user.id, action: 'refusal_overridden',
        old_value: 'refused', new_value: 'todo',
        note: 'Refus annulé — tâche réactivée par l\'assigné', created_at: now,
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
          user_id: recipientId, type: 'task_refusal_overridden',
          title: 'Refus annulé',
          message: `${userName} a accepté finalement la tâche "${task.title}"`,
          related_id: id, related_type: 'task',
          is_read: false,
        })
      } catch { /* swallow */ }
    }

    return NextResponse.json({ ok: true, task: finalTask })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? (err.stack ?? '').slice(0, 600) : ''
    console.error('[undo-refuse] UNHANDLED EXCEPTION:', msg, stack)
    return NextResponse.json({ error: msg, stack }, { status: 500 })
  }
}

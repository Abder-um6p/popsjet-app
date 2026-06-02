import { NextRequest, NextResponse } from 'next/server'
import { requireRole, insertAuditLog } from '@/lib/api-helpers'

/**
 * POST /api/tasks/[id]/reassign
 *
 * Réassigne une tâche refusée à un nouvel assigné.
 * Workflow : refused → pending_acceptance (nouvel assigné doit accepter)
 *
 * Permissions : créateur de la tâche, chef_projet, directeur, admin.
 * Body : { new_assignee_id: string, note?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const result = await requireRole(['admin', 'directeur', 'chef_projet', 'membre'])
  if ('error' in result) return result.error
  const { ctx, admin } = result

  // ── Fetch tâche ───────────────────────────────────────────────────────────
  const { data: task, error: fetchError } = await admin
    .from('tasks')
    .select('id, project_id, title, status, assigned_to, created_by, refused_by, refused_reason, refused_at')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (fetchError || !task) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })

  if ((task as any).status !== 'refused') {
    return NextResponse.json(
      { error: `Seules les tâches refusées peuvent être réassignées (statut actuel : "${(task as any).status}").` },
      { status: 409 }
    )
  }

  // ── Permissions : créateur ou rôle qualifié ───────────────────────────────
  const isCreator    = (task as any).created_by === ctx.userId
  const isPrivileged = ['admin', 'directeur', 'chef_projet'].includes(ctx.role)

  if (!isCreator && !isPrivileged) {
    const { data: membership } = await admin
      .from('project_members').select('role')
      .eq('project_id', (task as any).project_id).eq('profile_id', ctx.userId).maybeSingle()
    if (!membership) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}))
  const newAssigneeId: string | null = body.new_assignee_id ?? null
  const note: string | null          = body.note ?? null

  if (!newAssigneeId) return NextResponse.json({ error: 'new_assignee_id est requis' }, { status: 400 })

  // Vérifier que le nouvel assigné existe
  const { data: assigneeProfile } = await admin
    .from('profiles').select('id, full_name').eq('id', newAssigneeId).single()
  if (!assigneeProfile) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })

  const { data: actorProfile } = await admin
    .from('profiles').select('full_name').eq('id', ctx.userId).single()
  const actorName = (actorProfile as any)?.full_name ?? 'Quelqu\'un'

  const now = new Date().toISOString()
  const oldAssignee = (task as any).assigned_to

  // ── Mise à jour tâche → pending_acceptance ────────────────────────────────
  const { data: updated, error: updateError } = await admin
    .from('tasks')
    .update({
      assigned_to:        newAssigneeId,
      assigned_by:        ctx.userId,
      status:             'pending_acceptance',
      pending_acceptance: true,
      refused_at:         null,
      refused_by:         null,
      refused_reason:     null,
      acceptance_reset_at: now,
      updated_at:         now,
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  // ── Activity log ──────────────────────────────────────────────────────────
  try {
    await admin.from('task_activity_logs').insert({
      task_id:   id,
      user_id:   ctx.userId,
      action:    'reassigned',
      old_value: oldAssignee ?? null,
      new_value: newAssigneeId,
      note:      note
        ? `Réassigné par ${actorName} à ${(assigneeProfile as any).full_name} : ${note}`
        : `Réassigné par ${actorName} à ${(assigneeProfile as any).full_name}`,
    })
  } catch { /* swallow */ }

  // ── Audit log ─────────────────────────────────────────────────────────────
  await insertAuditLog({
    admin,
    userId:     ctx.userId,
    userEmail:  ctx.userEmail,
    action:     'task_reassigned',
    entityType: 'task',
    entityId:   id,
    entityName: (task as any).title,
    oldData:    { assigned_to: oldAssignee, status: 'refused' },
    newData:    { assigned_to: newAssigneeId, status: 'pending_acceptance' },
  })

  // ── Notification au nouvel assigné ────────────────────────────────────────
  if (newAssigneeId !== ctx.userId) {
    try {
      await admin.from('notifications').insert({
        user_id:      newAssigneeId,
        type:         'task_assigned',
        title:        'Nouvelle tâche assignée',
        message:      `${actorName} vous a assigné la tâche "${(task as any).title}"${note ? ` : ${note}` : ''}`,
        related_id:   id,
        related_type: 'task',
        is_read:      false,
      })
    } catch { /* swallow */ }
  }

  return NextResponse.json({ ok: true, task: updated })
}

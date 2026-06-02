import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/projects/[id]/tasks/bulk
// Body: { tasks: Array<{ title, description, priority, status, due_date, assigned_to }> }
//
// ⚠️ Acceptance flow : si assigned_to est défini et différent du créateur,
//    la tâche est créée avec status=pending_acceptance + pending_acceptance=true,
//    exactement comme la création unitaire (POST /api/tasks).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const tasks: any[] = body.tasks ?? []
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return NextResponse.json({ error: 'Aucune tâche à créer' }, { status: 400 })
  }
  if (tasks.length > 50) {
    return NextResponse.json({ error: 'Maximum 50 tâches par import' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Vérifier que le projet existe
  const { data: project } = await admin
    .from('projects').select('id, code, created_by').eq('id', projectId).is('deleted_at', null).single()
  if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })

  // P-05 — vérifier le membership (créateur du projet ou membre qualifié)
  const { data: callerProfile } = await admin
    .from('profiles').select('role').eq('id', user.id).single()
  const isPrivileged = ['admin', 'directeur'].includes((callerProfile as any)?.role ?? '')
  const isProjectCreator = (project as any).created_by === user.id

  if (!isPrivileged && !isProjectCreator) {
    const { data: membership } = await admin
      .from('project_members').select('role')
      .eq('project_id', projectId).eq('profile_id', user.id).maybeSingle()
    if (!membership) {
      return NextResponse.json(
        { error: 'Accès refusé — vous n\'êtes pas membre de ce projet.' },
        { status: 403 }
      )
    }
    // Les observateurs ne peuvent pas créer de tâches
    if ((membership as any).role === 'observateur') {
      return NextResponse.json(
        { error: 'Les observateurs ne peuvent pas créer de tâches.' },
        { status: 403 }
      )
    }
  }

  // Profil du créateur (pour les notifications)
  const { data: creatorProfile } = await admin
    .from('profiles').select('full_name').eq('id', user.id).single()
  const creatorName = creatorProfile?.full_name ?? 'Un membre'

  // Compteur courant pour les ref_number
  const { count: existingCount } = await admin
    .from('tasks').select('id', { count: 'exact', head: true }).eq('project_id', projectId)
  let taskCounter = existingCount ?? 0

  const payload = tasks
    .map(t => {
      const assignedTo     = t.assigned_to || null
      const needsAcceptance = !!assignedTo && assignedTo !== user.id

      // Calculer le statut final
      let finalStatus: string
      if (needsAcceptance) {
        finalStatus = 'pending_acceptance'
      } else {
        finalStatus = ['todo', 'in_progress', 'review'].includes(t.status) ? t.status : 'todo'
      }

      // Générer un ref_number séquentiel
      taskCounter++
      const ref_number = `${project.code ?? 'PRJ'}-T${String(taskCounter).padStart(3, '0')}`

      return {
        project_id:         projectId,
        title:              String(t.title ?? '').trim().slice(0, 200),
        description:        t.description ? String(t.description).trim() : null,
        priority:           ['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium',
        status:             finalStatus,
        due_date:           t.due_date || null,
        assigned_to:        assignedTo,
        assigned_by:        assignedTo ? user.id : null,
        pending_acceptance: needsAcceptance,
        ref_number,
        created_by:         user.id,
      }
    })
    .filter(t => t.title.length > 0)

  // Tentative 1 : insert complet (post-migration — colonnes acceptance présentes)
  const { data: created, error: e1 } = await admin
    .from('tasks').insert(payload).select('id, title, assigned_to, pending_acceptance')

  if (e1) {
    // Fallback : insert minimal sans colonnes v1.4
    console.warn('[bulk] Insert complet échoué, fallback minimal:', e1.message)
    const minimalPayload = payload.map(t => ({
      project_id:  t.project_id,
      title:       t.title,
      description: t.description,
      priority:    t.priority,
      status:      t.status === 'pending_acceptance' ? 'todo' : t.status,
      due_date:    t.due_date,
      assigned_to: t.assigned_to,
      created_by:  t.created_by,
    }))
    const { data: fallback, error: e2 } = await admin
      .from('tasks').insert(minimalPayload).select('id, title, assigned_to')
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })

    return NextResponse.json({ ok: true, created: fallback?.length ?? 0, tasks: fallback })
  }

  // Envoyer les notifications aux assignés (non-bloquant, fire & forget)
  if (created && created.length > 0) {
    const tasksNeedingNotif = created.filter(
      (t: any) => t.assigned_to && t.assigned_to !== user.id && t.pending_acceptance
    )
    for (const t of tasksNeedingNotif) {
      try {
        await admin.from('notifications').insert({
          user_id: t.assigned_to,
          type:    'task_assigned',
          title:   'Nouvelle tâche assignée',
          message: `${creatorName} vous a assigné la tâche "${t.title}"`,
          related_id:   t.id,
          related_type: 'task',
          is_read: false,
        })
      } catch { /* swallow */ }
    }

    // Log d'activité bulk (non-bloquant)
    try {
      await admin.from('task_activity_logs').insert(
        created.map((t: any) => ({
          task_id:   t.id,
          user_id:   user.id,
          action:    t.pending_acceptance ? 'assigned' : 'created',
          new_value: t.status ?? 'todo',
          note:      `Tâche créée par import bulk (${creatorName})`,
        }))
      )
    } catch { /* swallow */ }
  }

  return NextResponse.json({ ok: true, created: created?.length ?? 0, tasks: created })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { insertAuditLog } from '@/lib/api-helpers'

// ─── GET /api/tasks/[id] ──────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  // ── Round 1 : UNE seule requête large sur tasks (fusion étapes 1+2+3+7.5) ─
  // Toutes les colonnes connues — nulles si migration pas encore appliquée.
  const { data: task, error } = await admin
    .from('tasks')
    .select([
      'id, project_id, title, description, assigned_to, status, priority',
      'due_date, created_by, created_at, updated_at',
      'estimated_hours, actual_hours, sort_order',
      'assigned_by, pending_acceptance, accepted_at, refused_at, refused_reason, refused_by',
      'budget_reference_id, label, ref_number, is_draft',
    ].join(', '))
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !task) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })

  // ── Vérification accès (avant les requêtes parallèles) ────────────────────
  const isAssignee = task.assigned_to === user.id
  const isCreator  = task.created_by  === user.id

  if (!isAssignee && !isCreator) {
    const [{ data: profile }, { data: membership }] = await Promise.all([
      admin.from('profiles').select('role').eq('id', user.id).single(),
      admin.from('project_members').select('id')
        .eq('project_id', task.project_id).eq('profile_id', user.id).maybeSingle(),
    ])
    const isPrivileged = profile && ['admin', 'directeur'].includes((profile as any).role)
    if (!isPrivileged && !membership) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  // ── Round 2 : toutes les requêtes restantes EN PARALLÈLE ──────────────────
  const budgetRefId = (task as any).budget_reference_id as string | null

  const [
    { data: project },
    { data: comments },
    { data: activityLogs },
    { data: budgetRefRow },
  ] = await Promise.all([
    admin.from('projects').select('id, code, title, status, type').eq('id', task.project_id).single(),
    admin.from('task_comments')
      .select('id, task_id, author_id, content, created_at, updated_at')
      .eq('task_id', id).order('created_at', { ascending: true }),
    admin.from('task_activity_logs')
      .select('id, task_id, user_id, action, old_value, new_value, note, created_at')
      .eq('task_id', id).order('created_at', { ascending: false }).limit(50),
    budgetRefId
      ? admin.from('budget_references').select('id, code, designation').eq('id', budgetRefId).maybeSingle()
      : Promise.resolve({ data: null }),
  ])

  // ── Round 3 : batch profiles (toutes sources) ─────────────────────────────
  const profileMap: Record<string, { id: string; full_name: string; email: string; avatar_url: string | null }> = {}
  const userIds = new Set<string>([
    task.assigned_to, (task as any).assigned_by, task.created_by, (task as any).refused_by,
    ...(comments ?? []).map((c: any) => c.author_id),
    ...(activityLogs ?? []).map((l: any) => l.user_id),
  ].filter((x): x is string => !!x))

  if (userIds.size > 0) {
    const { data: profiles } = await admin
      .from('profiles').select('id, full_name, email, avatar_url').in('id', Array.from(userIds))
    profiles?.forEach((p: any) => { profileMap[p.id] = p })
  }

  // ── Assemblage final ───────────────────────────────────────────────────────
  const enrichedComments = (comments ?? []).map((c: any) => ({
    ...c, author: c.author_id ? profileMap[c.author_id] ?? null : null,
  }))
  const enrichedLogs = (activityLogs ?? []).map((l: any) => ({
    ...l, user: l.user_id ? profileMap[l.user_id] ?? null : null,
  }))

  return NextResponse.json({
    ...task,
    estimated_hours:    (task as any).estimated_hours    ?? null,
    actual_hours:       (task as any).actual_hours       ?? null,
    sort_order:         (task as any).sort_order         ?? 0,
    pending_acceptance: (task as any).pending_acceptance ?? false,
    assignee:         task.assigned_to             ? profileMap[task.assigned_to]             ?? null : null,
    assigner:         (task as any).assigned_by    ? profileMap[(task as any).assigned_by]    ?? null : null,
    creator:          task.created_by              ? profileMap[task.created_by]              ?? null : null,
    refuser:          (task as any).refused_by     ? profileMap[(task as any).refused_by]     ?? null : null,
    project:          project ?? null,
    budget_reference: (budgetRefRow as any)?.data ?? budgetRefRow ?? null,
    comments:         enrichedComments,
    activity:         enrichedLogs,
  })
}

// ─── PATCH /api/tasks/[id] ────────────────────────────────────────────────────

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const { data: task, error: fetchError } = await admin
    .from('tasks')
    .select('id, project_id, assigned_to, created_by, status, title')
    .eq('id', id).is('deleted_at', null).single()

  if (fetchError || !task) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })

  const { data: profile } = await supabase
    .from('profiles').select('role, full_name').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const isAssignee   = task.assigned_to === user.id
  const isCreator    = task.created_by === user.id
  const isPrivileged = ['admin', 'directeur', 'chef_projet'].includes(profile.role)

  if (!isAssignee && !isCreator && !isPrivileged) {
    const { data: m } = await admin.from('project_members')
      .select('role').eq('project_id', task.project_id).eq('profile_id', user.id).maybeSingle()
    if (!m || !['admin', 'directeur', 'chef_projet'].includes(m.role ?? '')) return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }

  const body = await req.json()
  // Seulement colonnes qui existent avec certitude
  const safeFields = ['title', 'description', 'status', 'priority', 'due_date', 'assigned_to']
  // Colonnes optionnelles (peuvent ne pas exister)
  const optionalFields = ['estimated_hours', 'actual_hours', 'sort_order', 'label', 'is_draft', 'budget_reference_id']
  const updates: Record<string, unknown> = {}

  for (const f of safeFields)    if (f in body) updates[f] = body[f]
  for (const f of optionalFields) if (f in body) updates[f] = body[f]

  if (Object.keys(updates).length === 0) return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })

  const oldStatus = task.status
  const newStatus = updates.status as string | undefined

  // ── State machine : valider la transition de statut ───────────────────────
  // Empêche les bypass du workflow (ex: pending_acceptance → done directement)
  if (newStatus && newStatus !== oldStatus) {
    // Les statuts gérés par des routes dédiées ne peuvent pas être atteints via PATCH général
    const DEDICATED_ROUTE_STATUSES = ['pending_acceptance', 'refused'] as const

    if (DEDICATED_ROUTE_STATUSES.includes(oldStatus as any)) {
      return NextResponse.json(
        {
          error: `La tâche est en statut "${oldStatus}" — utilisez les routes dédiées (/accept, /refuse, /undo-accept, /undo-refuse) pour changer ce statut.`,
        },
        { status: 409 }
      )
    }

    // Transitions autorisées depuis chaque statut
    const ALLOWED_TRANSITIONS: Record<string, string[]> = {
      todo:        ['in_progress', 'blocked', 'cancelled'],
      in_progress: ['todo', 'review', 'done', 'blocked', 'cancelled'],
      review:      ['in_progress', 'done', 'todo', 'blocked', 'cancelled'],
      done:        ['todo', 'in_progress', 'cancelled'],   // réouverture autorisée
      blocked:     ['todo', 'in_progress', 'cancelled'],
      cancelled:   ['todo'],                                // seule réouverture possible
    }

    const allowed = ALLOWED_TRANSITIONS[oldStatus] ?? []
    if (!allowed.includes(newStatus)) {
      return NextResponse.json(
        {
          error: `Transition de statut invalide : "${oldStatus}" → "${newStatus}". Transitions autorisées depuis "${oldStatus}" : ${allowed.join(', ') || 'aucune'}.`,
        },
        { status: 422 }
      )
    }
  }

  // ── FIN-05 : valider budget_reference_id actif si fourni ────────────────────
  if ('budget_reference_id' in updates && updates.budget_reference_id) {
    const { data: budgetRef } = await admin
      .from('budget_references').select('id, is_active').eq('id', updates.budget_reference_id as string).maybeSingle()
    if (!budgetRef) {
      return NextResponse.json({ error: 'Référence budgétaire introuvable.' }, { status: 400 })
    }
    if (!(budgetRef as any).is_active) {
      return NextResponse.json(
        { error: 'Cette référence budgétaire est inactive et ne peut plus être utilisée.' },
        { status: 400 }
      )
    }
  }

  // Tentative 1 : update complet
  const { data: updated, error: e1 } = await admin
    .from('tasks').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()

  let finalTask = updated
  if (e1) {
    // Fallback : seulement les champs sûrs
    const safeUpdates: Record<string, unknown> = {}
    for (const f of safeFields) if (f in updates) safeUpdates[f] = updates[f]
    if (Object.keys(safeUpdates).length === 0) return NextResponse.json({ error: e1.message }, { status: 500 })
    const { data: fb, error: e2 } = await admin
      .from('tasks').update({ ...safeUpdates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    finalTask = fb
  }

  if (newStatus && newStatus !== oldStatus) {
    try {
      await admin.from('task_activity_logs').insert({
        task_id: id, user_id: user.id, action: 'status_change',
        old_value: oldStatus, new_value: newStatus,
        note: `Statut changé par ${profile.full_name}`,
      })
    } catch { /* swallow */ }

    // VH-05 — Audit log changement statut
    await insertAuditLog({
      admin, userId: user.id, userEmail: null,
      action: 'task_status_changed', entityType: 'task', entityId: id, entityName: task.title,
      oldData: { status: oldStatus }, newData: { status: newStatus },
    })
  }

  // Si assigned_to vient d'être défini → créer dossier Drive/SharePoint + notif Slack
  const newAssignee = updates.assigned_to as string | undefined
  if (newAssignee && newAssignee !== task.assigned_to) {
    try {
      await admin.from('task_activity_logs').insert({
        task_id: id, user_id: user.id, action: 'assigned',
        note: `Tâche assignée par ${profile.full_name}`,
      })
    } catch { /* swallow */ }

    // Fire & forget — intégrations (import dynamique pour éviter les dépendances circulaires)
    const { getGoogleIntegration } = await import('@/lib/integrations/google/index')
    const { createTaskFolder, shareWithUser } = await import('@/lib/integrations/google/drive')
    const google = await getGoogleIntegration().catch(() => null)

    if (google?.options.create_task_subfolder) {
      const { data: project } = await admin.from('projects').select('google_folder_id, title').eq('id', task.project_id).single()
      if (project?.google_folder_id) {
        const result = await createTaskFolder(google.config, { id, title: task.title }, project.google_folder_id).catch(() => null)
        if (result && google.options.auto_share_members) {
          const { data: assigneeProf } = await admin.from('profiles').select('email').eq('id', newAssignee).single()
          if (assigneeProf?.email) {
            await shareWithUser(google.config, result.folderId, assigneeProf.email, google.options.share_role, true).catch(() => {})
          }
        }
      }
    }

    // Slack notification
    const { data: assigneeProfile } = await admin.from('profiles').select('full_name').eq('id', newAssignee).single()
    const { data: proj } = await admin.from('projects').select('title').eq('id', task.project_id).single()
    const baseUrl = process.env.NEXTAUTH_URL ?? process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
    fetch(`${baseUrl}/api/slack/notify`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event: { type: 'task_assigned', task: task.title, member: assigneeProfile?.full_name ?? '', project: proj?.title ?? '' } }),
    }).catch(() => {})
  }

  return NextResponse.json(finalTask)
}

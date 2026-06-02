import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { insertAuditLog } from '@/lib/api-helpers'

// ─── GET /api/tasks ────────────────────────────────────────────────────────────
// Architecture ultra-défensive : query de base avec colonnes minimales garanties.
// Colonnes optionnelles récupérées en étapes séparées avec fallback silencieux.

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { searchParams } = new URL(req.url)
  const projectId = searchParams.get('project_id')
  const status    = searchParams.get('status')
  const priority  = searchParams.get('priority')
  const section   = searchParams.get('section')

  const admin = createAdminClient()

  // ── Étape 1 : colonnes noyau — ne peuvent PAS manquer ────────────────────
  // BL-01 : retourner les tâches assignées À l'user OU créées PAR l'user.
  // Le chef de projet qui crée des tâches pour d'autres doit les voir dans Mon Espace.
  let query = admin
    .from('tasks')
    .select('id, project_id, title, description, assigned_to, status, priority, due_date, created_by, created_at, updated_at')
    .is('deleted_at', null)
    .or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`)
    .order('created_at', { ascending: false })

  if (projectId) query = query.eq('project_id', projectId)
  if (status)    query = query.eq('status', status)
  if (priority)  query = query.eq('priority', priority)

  const { data: tasks, error: tasksError } = await query

  if (tasksError) {
    console.error('[GET /api/tasks] Erreur base:', tasksError.message)
    return NextResponse.json({ error: tasksError.message }, { status: 500 })
  }

  if (!tasks || tasks.length === 0) return NextResponse.json([])

  const taskIds = tasks.map(t => t.id)

  // ── Étape 2 : colonnes optionnelles pré-v1.4 (estimated_hours, actual_hours, sort_order) ──
  const hoursMap: Record<string, { estimated_hours: number | null; actual_hours: number | null; sort_order: number }> = {}
  const { data: hoursData } = await admin
    .from('tasks')
    .select('id, estimated_hours, actual_hours, sort_order')
    .in('id', taskIds)

  if (hoursData) {
    hoursData.forEach((r, i) => {
      hoursMap[r.id] = {
        estimated_hours: r.estimated_hours ?? null,
        actual_hours:    r.actual_hours ?? null,
        sort_order:      r.sort_order ?? i,
      }
    })
  }

  // ── Étape 3 : colonnes v1.4 (assigned_by, pending_acceptance, etc.) ───────
  const acceptanceMap: Record<string, {
    assigned_by: string | null
    pending_acceptance: boolean
    accepted_at: string | null
    refused_at: string | null
    refused_reason: string | null
    refused_by: string | null
  }> = {}

  const { data: accData } = await admin
    .from('tasks')
    .select('id, assigned_by, pending_acceptance, accepted_at, refused_at, refused_reason, refused_by')
    .in('id', taskIds)

  if (accData) {
    accData.forEach(r => {
      acceptanceMap[r.id] = {
        assigned_by:       r.assigned_by ?? null,
        pending_acceptance: r.pending_acceptance ?? false,
        accepted_at:       r.accepted_at ?? null,
        refused_at:        r.refused_at ?? null,
        refused_reason:    r.refused_reason ?? null,
        refused_by:        r.refused_by ?? null,
      }
    })
  }

  // ── Étape 4 : assembler + filtrer par section ─────────────────────────────
  let merged = tasks.map((t, i) => ({
    ...t,
    ...(hoursMap[t.id] ?? { estimated_hours: null, actual_hours: null, sort_order: i }),
    ...(acceptanceMap[t.id] ?? {
      assigned_by: null, pending_acceptance: false,
      accepted_at: null, refused_at: null, refused_reason: null, refused_by: null,
    }),
  }))

  if (section === 'pending') {
    merged = merged.filter(t => t.pending_acceptance === true || t.status === 'pending_acceptance')
  } else if (section === 'mine') {
    merged = merged.filter(t => !t.pending_acceptance && t.status !== 'pending_acceptance')
  }

  if (merged.length === 0) return NextResponse.json([])

  // ── Étape 5 : profils ─────────────────────────────────────────────────────
  const userIds = new Set<string>()
  merged.forEach(t => {
    if (t.assigned_to) userIds.add(t.assigned_to)
    if (t.assigned_by) userIds.add(t.assigned_by)
    if (t.created_by)  userIds.add(t.created_by)
    if (t.refused_by)  userIds.add(t.refused_by)
  })

  const profileMap: Record<string, { id: string; full_name: string; email: string; avatar_url: string | null }> = {}
  if (userIds.size > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', Array.from(userIds))
    profiles?.forEach(p => { profileMap[p.id] = p })
  }

  // ── Étape 6 : projets ─────────────────────────────────────────────────────
  const projectIds = [...new Set(merged.map(t => t.project_id).filter(Boolean))]
  const projectMap: Record<string, { id: string; code: string; title: string }> = {}
  if (projectIds.length > 0) {
    const { data: projects } = await admin
      .from('projects')
      .select('id, code, title')
      .in('id', projectIds)
    projects?.forEach(p => { projectMap[p.id] = p })
  }

  // ── Assemblage final ──────────────────────────────────────────────────────
  const enriched = merged.map(t => ({
    ...t,
    assignee: t.assigned_to ? profileMap[t.assigned_to] ?? null : null,
    assigner: t.assigned_by ? profileMap[t.assigned_by] ?? null : null,
    creator:  t.created_by  ? profileMap[t.created_by]  ?? null : null,
    refuser:  t.refused_by  ? profileMap[t.refused_by]  ?? null : null,
    project:  t.project_id  ? projectMap[t.project_id]  ?? null : null,
  }))

  return NextResponse.json(enriched)
}

// ─── POST /api/tasks ───────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, full_name').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const body = await req.json()
  const { project_id, title, description, assigned_to, priority, due_date, estimated_hours, label, is_draft, budget_reference_id } = body

  if (!project_id || !title) {
    return NextResponse.json({ error: 'project_id et title sont requis' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── P-05 : RBAC membership projet (même règle que bulk) ───────────────────
  const isPrivilegedRole = ['admin', 'directeur'].includes((profile as any).role)
  if (!isPrivilegedRole) {
    const { data: project } = await admin
      .from('projects').select('id, created_by').eq('id', project_id).is('deleted_at', null).single()

    if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })

    const isProjectCreator = (project as any).created_by === user.id
    if (!isProjectCreator) {
      const { data: membership } = await admin
        .from('project_members').select('role')
        .eq('project_id', project_id).eq('profile_id', user.id).maybeSingle()

      if (!membership) {
        // Audit log du refus (non-bloquant)
        await insertAuditLog({
          admin, userId: user.id, userEmail: null,
          action: 'task_create_forbidden', entityType: 'project', entityId: project_id, entityName: null,
          oldData: null, newData: { reason: 'not_member', role: (profile as any).role },
        })
        return NextResponse.json(
          { error: 'Accès refusé — vous n\'êtes pas membre de ce projet.' },
          { status: 403 }
        )
      }

      if ((membership as any).role === 'observateur') {
        await insertAuditLog({
          admin, userId: user.id, userEmail: null,
          action: 'task_create_forbidden', entityType: 'project', entityId: project_id, entityName: null,
          oldData: null, newData: { reason: 'observateur_role' },
        })
        return NextResponse.json(
          { error: 'Les observateurs ne peuvent pas créer de tâches.' },
          { status: 403 }
        )
      }
    }
  }

  // ── FIN-05 : valider budget_reference_id actif ────────────────────────────
  if (budget_reference_id) {
    const { data: budgetRef } = await admin
      .from('budget_references').select('id, is_active').eq('id', budget_reference_id).maybeSingle()
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

  const needsAcceptance = !!assigned_to && assigned_to !== user.id

  // ── Génère le numéro de référence ──────────────────────────────────────────
  let ref_number: string | null = null
  try {
    const { data: proj } = await admin.from('projects').select('code').eq('id', project_id).single()
    const { count } = await admin.from('tasks').select('id', { count: 'exact', head: true }).eq('project_id', project_id)
    const n = ((count ?? 0) + 1).toString().padStart(3, '0')
    ref_number = `${proj?.code ?? 'PRJ'}-T${n}`
  } catch { /* ref_number restera null */ }

  // Tentative 1 : insert complet (post-migration)
  const { data: taskFull, error: e1 } = await admin
    .from('tasks')
    .insert({
      project_id, title,
      description: description ?? null,
      assigned_to: assigned_to ?? null,
      assigned_by: assigned_to ? user.id : null,
      status: needsAcceptance ? 'pending_acceptance' : (is_draft ? 'todo' : 'todo'),
      priority: priority ?? 'medium',
      due_date: due_date ?? null,
      estimated_hours: estimated_hours ?? null,
      created_by: user.id,
      pending_acceptance: needsAcceptance,
      label: label ?? null,
      ref_number,
      is_draft: is_draft ?? false,
      budget_reference_id: budget_reference_id ?? null,
    })
    .select()
    .single()

  if (!e1) {
    try {
      await admin.from('task_activity_logs').insert({
        task_id: taskFull.id, user_id: user.id,
        action: needsAcceptance ? 'assigned' : 'created',
        new_value: taskFull.status,
        note: `Tâche créée par ${profile.full_name}`,
      })
    } catch { /* swallow */ }

    if (assigned_to && assigned_to !== user.id) {
      try {
        await admin.from('notifications').insert({
          user_id: assigned_to, type: 'task_assigned',
          title: 'Nouvelle tâche assignée',
          message: `${profile.full_name} vous a assigné la tâche "${title}"`,
          related_id: taskFull.id, related_type: 'task', is_read: false,
        })
      } catch { /* swallow */ }
    }
    // Recalcul completion_pct du projet (non-bloquant)
    try {
      const { data: allTasks } = await admin
        .from('tasks').select('status')
        .eq('project_id', project_id).is('deleted_at', null)
      if (allTasks && allTasks.length > 0) {
        // Exclure cancelled et refused du dénominateur (tâches terminées négativement)
        const activeTasks = allTasks.filter(t => !['cancelled', 'refused'].includes(t.status))
        const done = activeTasks.filter(t => t.status === 'done').length
        const newPct = activeTasks.length > 0 ? Math.round((done / activeTasks.length) * 100) : 0
        await admin.from('projects').update({ completion_pct: newPct }).eq('id', project_id)
      }
    } catch { /* swallow */ }

    // Google Drive : créer le sous-dossier de la tâche dans Tâches/ du projet (fire & forget)
    if (assigned_to) {
      try {
        const { getGoogleIntegration } = await import('@/lib/integrations/google/index')
        const { createTaskFolder, shareWithUser } = await import('@/lib/integrations/google/drive')
        const google = await getGoogleIntegration().catch(() => null)

        if (google?.options.create_task_subfolder) {
          const { data: project } = await admin
            .from('projects').select('google_folder_id, title').eq('id', project_id).single()
          if (project?.google_folder_id) {
            const folderTitle = ref_number ? `${ref_number} — ${title}` : title
            const result = await createTaskFolder(
              google.config,
              { id: taskFull.id, title: folderTitle },
              project.google_folder_id
            ).catch(() => null)
            if (result) {
              // Stocker l'ID du dossier Drive sur la tâche
              await admin.from('tasks').update({
                google_folder_id: result.folderId,
                google_folder_url: result.folderUrl,
              }).eq('id', taskFull.id).catch(() => {})

              if (google.options.auto_share_members) {
                const { data: assigneeProf } = await admin
                  .from('profiles').select('email').eq('id', assigned_to).single()
                if (assigneeProf?.email) {
                  await shareWithUser(
                    google.config, result.folderId, assigneeProf.email,
                    google.options.share_role, true
                  ).catch(() => {})
                }
              }
            }
          }
        }
      } catch { /* swallow — intégration non bloquante */ }
    }

    // VH-05 — Audit log création tâche
    await insertAuditLog({
      admin, userId: user.id, userEmail: null,
      action: 'task_created', entityType: 'task',
      entityId: taskFull.id, entityName: taskFull.title,
      newData: { project_id, status: taskFull.status, priority: taskFull.priority },
    })

    return NextResponse.json({ ...taskFull, ref_number }, { status: 201 })
  }

  // Tentative 2 : insert minimal (pré-migration)
  console.warn('[POST /api/tasks] Insert complet échoué, fallback minimal:', e1.message)
  const { data: taskMin, error: e2 } = await admin
    .from('tasks')
    .insert({
      project_id, title,
      description: description ?? null,
      assigned_to: assigned_to ?? null,
      status: 'todo',
      priority: priority ?? 'medium',
      due_date: due_date ?? null,
      created_by: user.id,
    })
    .select()
    .single()

  if (e2) {
    console.error('[POST /api/tasks] Erreur fallback:', e2.message)
    return NextResponse.json({ error: e2.message }, { status: 500 })
  }

  // Recalcul completion_pct du projet (fallback, non-bloquant)
  try {
    const { data: allTasks } = await admin
      .from('tasks').select('status')
      .eq('project_id', project_id).is('deleted_at', null)
    if (allTasks && allTasks.length > 0) {
      const done = allTasks.filter(t => t.status === 'done').length
      const newPct = Math.round((done / allTasks.length) * 100)
      await admin.from('projects').update({ completion_pct: newPct }).eq('id', project_id)
    }
  } catch { /* swallow */ }

  return NextResponse.json(taskMin, { status: 201 })
}

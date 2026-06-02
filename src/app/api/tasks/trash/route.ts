import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/tasks/trash — liste des tâches dans la corbeille
// Permissions :
//   - admin / directeur / chef_projet  → toutes les tâches supprimées (corbeille globale)
//   - membre                           → uniquement les tâches qu'IL a lui-même supprimées
//                                        (deleted_by = user.id). Si zéro, retourne un
//                                        tableau vide (l'UI masquera l'onglet).

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const admin = createAdminClient()

    const { data: profile } = await admin
      .from('profiles').select('role').eq('id', user.id).single()
    const role = profile?.role ?? 'membre'
    const isPrivileged = ['admin', 'directeur', 'chef_projet'].includes(role)

    // ── Étape 1 : colonnes garanties + scope par rôle ────────────────────────
    let baseQuery = admin
      .from('tasks')
      .select('id, project_id, title, description, assigned_to, status, priority, due_date, created_by, created_at, updated_at, deleted_at')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })

    // Membre simple : uniquement les tâches qu'il a lui-même supprimées
    if (!isPrivileged) {
      baseQuery = baseQuery.eq('deleted_by', user.id)
    }

    const { data: tasks, error: tasksError } = await baseQuery

    if (tasksError) {
      console.error('[GET /api/tasks/trash] Erreur base:', tasksError.message)
      return NextResponse.json({ error: tasksError.message }, { status: 500 })
    }

    if (!tasks || tasks.length === 0) return NextResponse.json([])

    const taskIds = tasks.map(t => t.id)

    // ── Étape 2 : colonnes optionnelles pré-v1.4 ─────────────────────────────
    const hoursMap: Record<string, { sort_order: number }> = {}
    const { data: hoursData } = await admin
      .from('tasks').select('id, sort_order').in('id', taskIds)
    hoursData?.forEach((r, i) => { hoursMap[r.id] = { sort_order: r.sort_order ?? i } })

    // ── Étape 3 : colonnes v1.4 + v1.6 (optionnelles) ────────────────────────
    const extraMap: Record<string, {
      assigned_by: string | null
      pending_acceptance: boolean
      accepted_at: string | null
      refused_at: string | null
      refused_reason: string | null
      refused_by: string | null
      deleted_by: string | null
    }> = {}
    const { data: extras } = await admin
      .from('tasks')
      .select('id, assigned_by, pending_acceptance, accepted_at, refused_at, refused_reason, refused_by, deleted_by')
      .in('id', taskIds)
    extras?.forEach(r => {
      extraMap[r.id] = {
        assigned_by:       r.assigned_by ?? null,
        pending_acceptance: r.pending_acceptance ?? false,
        accepted_at:       r.accepted_at ?? null,
        refused_at:        r.refused_at ?? null,
        refused_reason:    r.refused_reason ?? null,
        refused_by:        r.refused_by ?? null,
        deleted_by:        r.deleted_by ?? null,
      }
    })

    // ── Étape 4 : merge ──────────────────────────────────────────────────────
    const merged = tasks.map((t, i) => ({
      ...t,
      ...(hoursMap[t.id] ?? { sort_order: i }),
      ...(extraMap[t.id] ?? {
        assigned_by: null, pending_acceptance: false,
        accepted_at: null, refused_at: null, refused_reason: null, refused_by: null,
        deleted_by: null,
      }),
    }))

    // ── Étape 5 : profils ────────────────────────────────────────────────────
    const userIds = new Set<string>()
    merged.forEach(t => {
      if (t.assigned_to) userIds.add(t.assigned_to)
      if (t.assigned_by) userIds.add(t.assigned_by)
      if (t.created_by)  userIds.add(t.created_by)
      if (t.refused_by)  userIds.add(t.refused_by)
      if (t.deleted_by)  userIds.add(t.deleted_by)
    })

    const profileMap: Record<string, { id: string; full_name: string; email: string; avatar_url: string | null }> = {}
    if (userIds.size > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', Array.from(userIds))
      profiles?.forEach(p => { profileMap[p.id] = p })
    }

    // ── Étape 6 : projets ────────────────────────────────────────────────────
    const projectIds = [...new Set(merged.map(t => t.project_id).filter(Boolean))]
    const projectMap: Record<string, { id: string; code: string; title: string }> = {}
    if (projectIds.length > 0) {
      const { data: projects } = await admin
        .from('projects')
        .select('id, code, title')
        .in('id', projectIds)
      projects?.forEach(p => { projectMap[p.id] = p })
    }

    // ── Assemblage final ─────────────────────────────────────────────────────
    const enriched = merged.map(t => ({
      ...t,
      assignee: t.assigned_to ? profileMap[t.assigned_to] ?? null : null,
      assigner: t.assigned_by ? profileMap[t.assigned_by] ?? null : null,
      creator:  t.created_by  ? profileMap[t.created_by]  ?? null : null,
      refuser:  t.refused_by  ? profileMap[t.refused_by]  ?? null : null,
      deleter:  t.deleted_by  ? profileMap[t.deleted_by]  ?? null : null,
      project:  t.project_id  ? projectMap[t.project_id]  ?? null : null,
    }))

    return NextResponse.json(enriched)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? (err.stack ?? '').slice(0, 600) : ''
    console.error('[GET /api/tasks/trash] UNHANDLED EXCEPTION:', msg, stack)
    return NextResponse.json({ error: msg, stack }, { status: 500 })
  }
}

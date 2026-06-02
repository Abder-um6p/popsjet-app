import { requireAuth } from '@/lib/api-helpers'
import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/search?q=<query>&limit=10
 *
 * Recherche globale cross-entités : projets, tâches, documents, membres.
 * Permissions respectées : membres voient uniquement leurs projets accessibles.
 */
export async function GET(req: NextRequest) {
  const result = await requireAuth()
  if ('error' in result) return result.error
  const { ctx, admin } = result

  const q     = req.nextUrl.searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(parseInt(req.nextUrl.searchParams.get('limit') ?? '8'), 20)

  if (q.length < 2) return NextResponse.json({ results: [] })

  const like = `%${q}%`
  const isPrivileged = ['admin', 'directeur'].includes(ctx.role)

  // ── Projets accessibles ───────────────────────────────────────────────────
  let accessibleProjectIds: string[] | null = null
  if (!isPrivileged) {
    const [{ data: memberships }, { data: owned }] = await Promise.all([
      admin.from('project_members').select('project_id').eq('profile_id', ctx.userId),
      admin.from('projects').select('id').eq('created_by', ctx.userId).is('deleted_at', null),
    ])
    accessibleProjectIds = [
      ...new Set([
        ...(memberships ?? []).map((m: any) => m.project_id),
        ...(owned ?? []).map((p: any) => p.id),
      ])
    ]
  }

  // ── Recherches en parallèle ───────────────────────────────────────────────
  const projectQuery = admin
    .from('projects')
    .select('id, code, title, status, type')
    .is('deleted_at', null)
    .or(`title.ilike.${like},code.ilike.${like},description.ilike.${like}`)
    .limit(limit)

  const taskQuery = admin
    .from('tasks')
    .select('id, title, status, priority, project_id')
    .is('deleted_at', null)
    .or(`title.ilike.${like},description.ilike.${like}`)
    .limit(limit)

  const documentQuery = admin
    .from('documents')
    .select('id, title, file_name, project_id, mime_type')
    .is('deleted_at', null)
    .or(`title.ilike.${like},file_name.ilike.${like}`)
    .limit(limit)

  const memberQuery = admin
    .from('profiles')
    .select('id, full_name, email, role')
    .or(`full_name.ilike.${like},email.ilike.${like}`)
    .limit(limit)

  // Appliquer les filtres de projet si non-privilégié
  if (accessibleProjectIds !== null) {
    const ids = accessibleProjectIds.length > 0 ? accessibleProjectIds : ['__none__']
    taskQuery.in('project_id', ids)
    documentQuery.in('project_id', ids)
    projectQuery.in('id', ids)
  }

  const [
    { data: projects },
    { data: tasks },
    { data: documents },
    { data: members },
  ] = await Promise.all([projectQuery, taskQuery, documentQuery, memberQuery])

  // ── Assembler les résultats ───────────────────────────────────────────────
  const results = [
    ...(projects ?? []).map((p: any) => ({
      type:     'project' as const,
      id:       p.id,
      title:    p.title,
      subtitle: p.code,
      status:   p.status,
      href:     `/projects/${p.id}`,
    })),
    ...(tasks ?? []).map((t: any) => ({
      type:     'task' as const,
      id:       t.id,
      title:    t.title,
      subtitle: t.status,
      priority: t.priority,
      href:     `/tasks/${t.id}`,
    })),
    ...(documents ?? []).map((d: any) => ({
      type:     'document' as const,
      id:       d.id,
      title:    d.title || d.file_name,
      subtitle: d.file_name,
      mime:     d.mime_type,
      href:     `/projects/${d.project_id}`,
    })),
    // Membres uniquement pour admin/directeur
    ...(isPrivileged ? (members ?? []).map((m: any) => ({
      type:     'member' as const,
      id:       m.id,
      title:    m.full_name,
      subtitle: m.email,
      role:     m.role,
      href:     `/admin/users`,
    })) : []),
  ]

  return NextResponse.json({ results, query: q })
}

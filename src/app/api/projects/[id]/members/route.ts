import { requireAuth, Err } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'

/**
 * GET /api/projects/[id]/members
 *
 * Security: auth required.
 * - admin / directeur : accès à tous les projets
 * - chef_projet / membre : doit être membre ou créateur du projet
 *
 * Retourne la liste des membres avec profil (id, full_name, email, role, avatar_url).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // ── Auth guard ────────────────────────────────────────────────────────────
  const result = await requireAuth()
  if ('error' in result) return result.error
  const { ctx, admin } = result

  // ── Membership / creator check pour rôles non-privilegiés ─────────────────
  if (!['admin', 'directeur'].includes(ctx.role)) {
    const { data: selfMembership } = await admin
      .from('project_members')
      .select('id')
      .eq('project_id', id)
      .eq('profile_id', ctx.userId)
      .maybeSingle()

    if (!selfMembership) {
      const { data: proj } = await admin
        .from('projects')
        .select('created_by')
        .eq('id', id)
        .is('deleted_at', null)
        .maybeSingle()

      if (!proj) return Err.notFound('Projet introuvable')
      if ((proj as { created_by?: string | null }).created_by !== ctx.userId) {
        return Err.forbidden('Accès refusé — vous n\'êtes pas membre de ce projet')
      }
    }
  }

  // ── Fetch members ─────────────────────────────────────────────────────────
  const { data: members, error } = await admin
    .from('project_members')
    .select('id, profile_id, role')
    .eq('project_id', id)

  if (error) return Err.internal(error.message)

  // ── Load profiles ─────────────────────────────────────────────────────────
  const profileIds = (members ?? []).map(m => m.profile_id).filter(Boolean) as string[]
  const { data: profiles } = profileIds.length
    ? await admin
        .from('profiles')
        .select('id, full_name, email, role, avatar_url')
        .in('id', profileIds)
    : { data: [] }

  const profileMap = Object.fromEntries(
    (profiles ?? []).map(p => [(p as { id: string }).id, p])
  )

  return NextResponse.json(
    (members ?? []).map(m => ({
      id:              m.id,
      role_in_project: m.role,
      profile:         profileMap[m.profile_id] ?? null,
    }))
  )
}

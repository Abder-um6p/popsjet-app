import { requireAuth, Err } from '@/lib/api-helpers'
import { NextResponse } from 'next/server'

/**
 * GET /api/projects/[id]
 *
 * Security: auth required.
 * - admin / directeur : accès à tout projet actif
 * - chef_projet / membre : doit être membre OU créateur du projet
 *
 * Retourne des colonnes nommées uniquement (pas de select('*')).
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

  // ── Fetch project (colonnes nommées) ──────────────────────────────────────
  const { data, error } = await admin
    .from('projects')
    .select(
      'id, code, title, type, status, budget, completion_pct, program_id, ' +
      'created_by, is_structured, metadata, created_at, updated_at, deleted_at'
    )
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (error || !data) return Err.notFound('Projet introuvable')

  // ── Membership check pour les rôles non-privilegiés ───────────────────────
  if (!['admin', 'directeur'].includes(ctx.role)) {
    const [{ data: membership }] = await Promise.all([
      admin
        .from('project_members')
        .select('id')
        .eq('project_id', id)
        .eq('profile_id', ctx.userId)
        .maybeSingle(),
    ])

    const isCreator = (data as { created_by?: string | null }).created_by === ctx.userId

    if (!membership && !isCreator) {
      return Err.forbidden('Accès refusé — vous n\'êtes pas membre de ce projet')
    }
  }

  return NextResponse.json(data)
}

/**
 * PATCH /api/projects/[id]
 * Met à jour un projet. NT-04 : notifie les membres si le statut change.
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const result = await requireAuth()
  if ('error' in result) return result.error
  const { ctx, admin } = result

  // Seuls admin, directeur, chef_projet peuvent modifier
  if (!['admin', 'directeur', 'chef_projet'].includes(ctx.role)) {
    return Err.forbidden('Modification réservée aux admins, directeurs et chefs de projet')
  }

  const { data: project } = await admin
    .from('projects').select('id, title, status, created_by').eq('id', id).is('deleted_at', null).single()
  if (!project) return Err.notFound('Projet introuvable')

  const body = await req.json().catch(() => ({}))
  const allowed = ['title', 'description', 'type', 'status', 'start_date', 'end_date', 'budget', 'completion_pct', 'budget_currency']
  const updates: Record<string, unknown> = {}
  for (const f of allowed) if (f in body) updates[f] = body[f]
  if (Object.keys(updates).length === 0) return Err.badRequest('Aucun champ à mettre à jour')

  const oldStatus = (project as any).status
  const newStatus = updates.status as string | undefined

  const { data: updated, error } = await admin
    .from('projects').update({ ...updates, updated_at: new Date().toISOString() }).eq('id', id).select().single()
  if (error) return Err.internal(error.message)

  // NT-04 — notifier les membres si le statut change
  if (newStatus && newStatus !== oldStatus) {
    try {
      const { data: members } = await admin
        .from('project_members').select('profile_id').eq('project_id', id)
      const recipientIds = new Set<string>([
        ...(members ?? []).map((m: any) => m.profile_id),
        (project as any).created_by,
      ].filter((uid): uid is string => !!uid && uid !== ctx.userId))

      const STATUS_FR: Record<string, string> = {
        draft: 'Brouillon', active: 'Actif', completed: 'Terminé', archived: 'Archivé',
        on_hold: 'En pause', cancelled: 'Annulé',
      }
      for (const uid of recipientIds) {
        await admin.from('notifications').insert({
          user_id:      uid,
          type:         'project_update',
          title:        'Statut projet modifié',
          message:      `Le projet "${(project as any).title}" est passé à ${STATUS_FR[newStatus] ?? newStatus}`,
          related_id:   id,
          related_type: 'project',
          is_read:      false,
        }).catch(() => {})
      }
    } catch { /* swallow */ }
  }

  return NextResponse.json(updated)
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { requireAuth, Err } from '@/lib/api-helpers'

const WRITE_ROLES = ['admin', 'directeur']

// GET /api/programs/[id]
// Security: auth required — tout utilisateur authentifié peut lire un programme.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // ── Auth guard ──────────────────────────────────────────────────────────
    const authResult = await requireAuth()
    if ('error' in authResult) return authResult.error
    const { admin } = authResult

    // Colonnes nommées — pas de select('*')
    const { data, error } = await admin
      .from('programs')
      .select('id, code, name, description, is_active, start_date, end_date, created_by, created_at, updated_at, deleted_at')
      .eq('id', id)
      .single()

    if (error || !data) return Err.notFound('Programme introuvable')
    return NextResponse.json(data)
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// PATCH /api/programs/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !WRITE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await req.json()
    const { name, description, objectives, is_active, is_confidential, start_date, end_date } = body

    if (name !== undefined && !name?.trim()) {
      return NextResponse.json({ error: 'Le nom ne peut pas être vide' }, { status: 400 })
    }

    const now = new Date().toISOString()

    const updateBase: Record<string, unknown> = { updated_at: now }
    if (name        !== undefined) updateBase.name        = name.trim()
    if (description !== undefined) updateBase.description = description?.trim() || null
    if (is_active   !== undefined) updateBase.is_active   = is_active
    if (start_date  !== undefined) updateBase.start_date  = start_date || null
    if (end_date    !== undefined) updateBase.end_date     = end_date || null

    // Tentative 1 : avec colonnes v2
    const { data: p1, error: e1 } = await admin
      .from('programs')
      .update({
        ...updateBase,
        objectives:      objectives !== undefined ? (objectives?.trim() || null) : undefined,
        is_confidential: is_confidential !== undefined ? is_confidential : undefined,
      })
      .eq('id', id)
      .select()
      .single()

    if (!e1) return NextResponse.json({ ok: true, program: p1 })

    // Tentative 2 : sans colonnes v2
    console.warn('[PATCH /api/programs] Update complet échoué, fallback base:', e1.message)
    const { data: p2, error: e2 } = await admin
      .from('programs')
      .update(updateBase)
      .eq('id', id)
      .select()
      .single()

    if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
    return NextResponse.json({ ok: true, program: p2 })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[PATCH /api/programs] EXCEPTION:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const WRITE_ROLES = ['admin', 'directeur', 'chef_projet']
const DELETE_ROLES = ['admin', 'directeur']

// ─── PATCH /api/budget-references/[id] ───────────────────────────────────────
// Met à jour designation, notes, is_active. Le code n'est PAS modifiable
// (il sert d'ancrage stable pour les références déjà liées à des tâches/dépenses).

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile || !WRITE_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  let body: {
    designation?: string
    notes?: string | null
    is_active?: boolean
  } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const updates: {
    designation?: string
    notes?: string | null
    is_active?: boolean
    updated_at?: string
  } = {}

  if (typeof body.designation === 'string') {
    const designation = body.designation.trim()
    if (!designation) return NextResponse.json({ error: 'La désignation ne peut pas être vide' }, { status: 400 })
    updates.designation = designation
  }
  if ('notes' in body) {
    updates.notes = (body.notes ?? '').toString().trim() || null
  }
  if (typeof body.is_active === 'boolean') {
    updates.is_active = body.is_active
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Aucun champ à mettre à jour' }, { status: 400 })
  }

  updates.updated_at = new Date().toISOString()

  const { data, error } = await admin
    .from('budget_references')
    .update(updates)
    .eq('id', id)
    .select('id, program_id, code, designation, notes, is_active, created_by, created_at, updated_at')
    .single()

  if (error) {
    console.error('[PATCH /api/budget-references/[id]] Erreur:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Référence introuvable' }, { status: 404 })

  return NextResponse.json(data)
}

// ─── DELETE /api/budget-references/[id] ──────────────────────────────────────
// Hard delete. Réservé admin/directeur. Les FK sur tasks/expenses passent à
// NULL via ON DELETE SET NULL (cf. migration).

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile || !DELETE_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const { error } = await admin
    .from('budget_references')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('[DELETE /api/budget-references/[id]] Erreur:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

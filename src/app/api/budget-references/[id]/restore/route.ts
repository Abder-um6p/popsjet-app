import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/budget-references/[id]/restore (admin/directeur uniquement)
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile || !['admin', 'directeur'].includes(profile.role)) {
    return NextResponse.json({ error: 'Réservé aux administrateurs et directeurs' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: ref, error: fetchError } = await admin
    .from('budget_references')
    .select('id, code, label, deleted_at')
    .eq('id', id)
    .single()

  if (fetchError || !ref) return NextResponse.json({ error: 'Référence budgétaire introuvable' }, { status: 404 })
  if (!ref.deleted_at)    return NextResponse.json({ error: 'Cette référence n\'est pas dans la corbeille' }, { status: 409 })

  const { error: e1 } = await admin
    .from('budget_references').update({ deleted_at: null, deleted_by: null }).eq('id', id)

  if (!e1) return NextResponse.json({ ok: true, code: ref.code, label: ref.label })

  const { error: e2 } = await admin
    .from('budget_references').update({ deleted_at: null }).eq('id', id)

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  return NextResponse.json({ ok: true, code: ref.code, label: ref.label })
}

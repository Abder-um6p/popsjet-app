import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// DELETE /api/pops/[id]/destroy — suppression définitive (admin/directeur uniquement)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, email').eq('id', user.id).single()

  if (!profile || !['admin', 'directeur'].includes(profile.role)) {
    return NextResponse.json({ error: 'Réservé aux administrateurs et directeurs' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: pop, error: fetchError } = await admin
    .from('pops')
    .select('id, content, deleted_at, author_id')
    .eq('id', id)
    .single()

  if (fetchError || !pop) return NextResponse.json({ error: 'Pop introuvable' }, { status: 404 })
  if (!pop.deleted_at) {
    return NextResponse.json(
      { error: 'Le pop doit être dans la corbeille avant suppression définitive' },
      { status: 409 }
    )
  }

  // Audit snapshot avant suppression
  try {
    await admin.from('audit_logs').insert({
      user_id:     user.id,
      user_email:  (profile as any).email ?? null,
      action:      'pop_destroyed',
      entity_type: 'pop',
      entity_id:   id,
      entity_name: pop.content?.slice(0, 80) ?? '',
      old_data:    pop as any,
    })
  } catch { /* swallow */ }

  const { error: destroyError } = await admin
    .from('pops').delete().eq('id', id)

  if (destroyError) return NextResponse.json({ error: destroyError.message }, { status: 500 })
  return NextResponse.json({ ok: true, title: pop.content })
}

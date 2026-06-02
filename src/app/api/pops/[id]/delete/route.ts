import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// DELETE /api/pops/[id]/delete — soft delete
// Règles :
//  - Auteur du pop OU admin/directeur
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const admin = createAdminClient()

  const { data: pop, error: fetchError } = await admin
    .from('pops')
    .select('id, content, author_id, deleted_at')
    .eq('id', id)
    .single()

  if (fetchError || !pop) return NextResponse.json({ error: 'Pop introuvable' }, { status: 404 })
  if (pop.deleted_at)      return NextResponse.json({ error: 'Pop déjà dans la corbeille' }, { status: 409 })

  const isPrivileged = ['admin', 'directeur'].includes(profile.role)
  const isAuthor     = pop.author_id === user.id

  if (!isPrivileged && !isAuthor) {
    return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }

  const { error: e1 } = await admin
    .from('pops')
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq('id', id)

  if (!e1) return NextResponse.json({ ok: true, title: pop.content })

  const { error: e2 } = await admin
    .from('pops').update({ deleted_at: new Date().toISOString() }).eq('id', id)

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  return NextResponse.json({ ok: true, title: pop.content })
}

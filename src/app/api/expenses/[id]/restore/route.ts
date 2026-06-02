import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/expenses/[id]/restore
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
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const admin = createAdminClient()

  const { data: expense, error: fetchError } = await admin
    .from('expenses').select('id, title, deleted_at, submitted_by').eq('id', id).single()

  if (fetchError || !expense) return NextResponse.json({ error: 'Dépense introuvable' }, { status: 404 })
  if (!expense.deleted_at)    return NextResponse.json({ error: 'Cette dépense n\'est pas dans la corbeille' }, { status: 409 })

  const isPrivileged = ['admin', 'directeur'].includes(profile.role)
  const isOwner      = expense.submitted_by === user.id
  if (!isPrivileged && !isOwner) return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })

  const { error: e1 } = await admin
    .from('expenses').update({ deleted_at: null, deleted_by: null }).eq('id', id)

  if (!e1) return NextResponse.json({ ok: true, title: expense.title })

  const { error: e2 } = await admin
    .from('expenses').update({ deleted_at: null }).eq('id', id)

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  return NextResponse.json({ ok: true, title: expense.title })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// DELETE /api/expenses/[id]/delete — soft delete
// Règles :
//  - Dépense pending  → auteur OU admin/directeur
//  - Dépense approved → admin/directeur uniquement
//  - Dépense rejected → auteur OU admin/directeur
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

  const { data: expense, error: fetchError } = await admin
    .from('expenses')
    .select('id, title, status, submitted_by, deleted_at')
    .eq('id', id)
    .single()

  if (fetchError || !expense) return NextResponse.json({ error: 'Dépense introuvable' }, { status: 404 })
  if (expense.deleted_at)     return NextResponse.json({ error: 'Dépense déjà dans la corbeille' }, { status: 409 })

  const isPrivileged = ['admin', 'directeur'].includes(profile.role)
  const isOwner      = expense.submitted_by === user.id

  // Dépense approuvée : admin/directeur uniquement
  if (expense.status === 'approved' && !isPrivileged) {
    return NextResponse.json(
      { error: 'Une dépense approuvée ne peut être supprimée que par un administrateur ou directeur' },
      { status: 403 }
    )
  }

  if (!isPrivileged && !isOwner) {
    return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
  }

  const { error: e1 } = await admin
    .from('expenses')
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq('id', id)

  if (!e1) return NextResponse.json({ ok: true, title: expense.title })

  const { error: e2 } = await admin
    .from('expenses').update({ deleted_at: new Date().toISOString() }).eq('id', id)

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  return NextResponse.json({ ok: true, title: expense.title })
}

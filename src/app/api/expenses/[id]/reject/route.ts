import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/expenses/[id]/reject — rejeter une dépense
// Permissions : admin, directeur, chef_projet
// Body optionnel : { note: string }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, full_name, email').eq('id', user.id).single()

  if (!profile || !['admin', 'directeur', 'chef_projet'].includes(profile.role)) {
    return NextResponse.json(
      { error: 'Seuls les administrateurs, directeurs et chefs de projet peuvent rejeter une dépense.' },
      { status: 403 }
    )
  }

  // Note de rejet optionnelle
  let rejectionNote: string | null = null
  try {
    const body = await req.json()
    rejectionNote = body?.note?.trim() || null
  } catch { /* pas de body */ }

  const admin = createAdminClient()

  const { data: expense, error: fetchError } = await admin
    .from('expenses')
    .select('id, title, amount, status, submitted_by, project_id, deleted_at')
    .eq('id', id)
    .single()

  if (fetchError || !expense) {
    return NextResponse.json({ error: 'Dépense introuvable' }, { status: 404 })
  }

  if (expense.deleted_at) {
    return NextResponse.json({ error: 'Cette dépense est dans la corbeille' }, { status: 409 })
  }

  if (expense.status !== 'pending') {
    return NextResponse.json(
      { error: `Impossible de rejeter : la dépense est déjà "${expense.status}". Seules les dépenses en attente peuvent être rejetées.` },
      { status: 409 }
    )
  }

  const now = new Date().toISOString()

  const { data: updated, error: updateError } = await admin
    .from('expenses')
    .update({
      status:         'rejected',
      approved_by:    user.id,
      approved_at:    now,
      rejection_note: rejectionNote,
      updated_at:     now,
    })
    .eq('id', id)
    .select()
    .single()

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Audit log (non-bloquant)
  try {
    await admin.from('audit_logs').insert({
      user_id:     user.id,
      user_email:  profile.email ?? null,
      action:      'expense_rejected',
      entity_type: 'expense',
      entity_id:   id,
      entity_name: expense.title,
      old_data:    { status: 'pending' },
      new_data:    { status: 'rejected', rejected_by: user.id, rejected_at: now, rejection_note: rejectionNote },
    })
  } catch { /* swallow */ }

  // Notification au soumetteur (non-bloquant)
  if (expense.submitted_by && expense.submitted_by !== user.id) {
    try {
      const msg = rejectionNote
        ? `${profile.full_name ?? 'Un responsable'} a rejeté votre dépense "${expense.title}" : "${rejectionNote}"`
        : `${profile.full_name ?? 'Un responsable'} a rejeté votre dépense "${expense.title}"`

      await admin.from('notifications').insert({
        user_id: expense.submitted_by,
        type:    'expense_rejected',
        title:   'Dépense rejetée',
        message: msg,
        related_id:   id,
        related_type: 'expense',
        is_read: false,
      })
    } catch { /* swallow */ }
  }

  return NextResponse.json({ ok: true, expense: updated })
}

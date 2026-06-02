import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// DELETE /api/expenses/[id]/destroy — suppression définitive (admin/directeur uniquement)
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

  const { data: expense, error: fetchError } = await admin
    .from('expenses')
    .select('id, title, deleted_at, amount, status, submitted_by, receipt_path')
    .eq('id', id)
    .single()

  if (fetchError || !expense) return NextResponse.json({ error: 'Dépense introuvable' }, { status: 404 })
  if (!expense.deleted_at) {
    return NextResponse.json(
      { error: 'La dépense doit être dans la corbeille avant suppression définitive' },
      { status: 409 }
    )
  }

  // ── Suppression du reçu Storage (non-bloquant) ───────────────────────────
  const receiptPath: string | null = (expense as any).receipt_path ?? null
  if (receiptPath) {
    try {
      const { error: storageErr } = await admin.storage
        .from('receipts')
        .remove([receiptPath])
      if (storageErr) {
        console.warn('[expenses/destroy] Storage remove warning:', storageErr.message)
      }
    } catch (ex) {
      console.warn('[expenses/destroy] Storage remove exception (continuing):', ex)
    }
  }

  // Audit snapshot avant suppression
  try {
    await admin.from('audit_logs').insert({
      user_id:     user.id,
      user_email:  (profile as any).email ?? null,
      action:      'expense_destroyed',
      entity_type: 'expense',
      entity_id:   id,
      entity_name: expense.title,
      old_data:    expense as any,
    })
  } catch { /* swallow */ }

  const { error: destroyError } = await admin
    .from('expenses').delete().eq('id', id)

  if (destroyError) return NextResponse.json({ error: destroyError.message }, { status: 500 })
  return NextResponse.json({ ok: true, title: expense.title })
}

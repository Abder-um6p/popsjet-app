import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/api-helpers'

/**
 * POST /api/expenses
 * Crée une dépense avec validation budget_reference_id (FIN-05).
 */
export async function POST(req: NextRequest) {
  const result = await requireAuth()
  if ('error' in result) return result.error
  const { ctx, admin } = result

  const body = await req.json().catch(() => ({}))
  const {
    project_id, title, amount, category, expense_date,
    notes, budget_reference_id, mode, assignees,
    receipt_url, receipt_path,
  } = body

  if (!project_id || !title || !amount || !expense_date) {
    return NextResponse.json(
      { error: 'project_id, title, amount et expense_date sont requis.' },
      { status: 400 }
    )
  }

  // ── FIN-05 : valider budget_reference_id actif ─────────────────────────────
  if (budget_reference_id) {
    const { data: budgetRef } = await admin
      .from('budget_references').select('id, is_active').eq('id', budget_reference_id).maybeSingle()
    if (!budgetRef) {
      return NextResponse.json({ error: 'Référence budgétaire introuvable.' }, { status: 400 })
    }
    if (!(budgetRef as any).is_active) {
      return NextResponse.json(
        { error: 'Cette référence budgétaire est inactive et ne peut plus être utilisée.' },
        { status: 400 }
      )
    }
  }

  const isSelfReported = mode === 'archive'
  const now = new Date().toISOString()

  const payload: Record<string, unknown> = {
    project_id,
    title:        String(title).trim(),
    amount:       Number(amount),
    category:     category ?? 'autre',
    expense_date,
    notes:        notes ?? null,
    submitted_by: ctx.userId,
    status:       isSelfReported ? 'approved' : 'pending',
    ...(isSelfReported ? { approved_by: ctx.userId, approved_at: now } : {}),
    ...(budget_reference_id ? { budget_reference_id } : {}),
    ...(assignees?.length ? { assignees } : {}),
    ...(receipt_url  ? { receipt_url }  : {}),
    ...(receipt_path ? { receipt_path } : {}),
  }

  const { data, error } = await admin.from('expenses').insert(payload).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json(data, { status: 201 })
}

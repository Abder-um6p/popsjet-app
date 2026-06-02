import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// DELETE /api/budget-references/[id]/delete — soft delete (admin/directeur uniquement)
// Avertit si des tâches ou dépenses actives référencent cette entrée budgétaire
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

  if (!profile || !['admin', 'directeur'].includes(profile.role)) {
    return NextResponse.json({ error: 'Réservé aux administrateurs et directeurs' }, { status: 403 })
  }

  const admin = createAdminClient()

  const { data: ref, error: fetchError } = await admin
    .from('budget_references')
    .select('id, code, designation, deleted_at')
    .eq('id', id)
    .single()

  if (fetchError || !ref) return NextResponse.json({ error: 'Référence budgétaire introuvable' }, { status: 404 })
  if (ref.deleted_at)      return NextResponse.json({ error: 'Référence budgétaire déjà dans la corbeille' }, { status: 409 })

  // Vérification des liaisons actives (avertissement non bloquant)
  let linkedTasksCount  = 0
  let linkedExpensesCount = 0

  try {
    const { data: linkedTasks } = await admin
      .from('tasks')
      .select('id')
      .eq('budget_reference_id', id)
      .is('deleted_at', null)
    linkedTasksCount = linkedTasks?.length ?? 0
  } catch { /* ignore */ }

  try {
    const { data: linkedExpenses } = await admin
      .from('expenses')
      .select('id')
      .eq('budget_reference_id', id)
      .is('deleted_at', null)
    linkedExpensesCount = linkedExpenses?.length ?? 0
  } catch { /* ignore */ }

  // Suppression douce (non bloquée même si des items sont liés)
  const { error: e1 } = await admin
    .from('budget_references')
    .update({ deleted_at: new Date().toISOString(), deleted_by: user.id })
    .eq('id', id)

  if (!e1) {
    return NextResponse.json({
      ok: true,
      code: ref.code,
      designation: (ref as any).designation,
      warnings: linkedTasksCount > 0 || linkedExpensesCount > 0
        ? {
            linked_tasks:    linkedTasksCount,
            linked_expenses: linkedExpensesCount,
            message:         `Cette référence est encore utilisée par ${linkedTasksCount} tâche(s) et ${linkedExpensesCount} dépense(s) actives.`,
          }
        : null,
    })
  }

  const { error: e2 } = await admin
    .from('budget_references').update({ deleted_at: new Date().toISOString() }).eq('id', id)

  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 })
  return NextResponse.json({
    ok: true,
    code: ref.code,
    label: ref.designation,
    warnings: linkedTasksCount > 0 || linkedExpensesCount > 0
      ? {
          linked_tasks:    linkedTasksCount,
          linked_expenses: linkedExpensesCount,
          message:         `Cette référence est encore utilisée par ${linkedTasksCount} tâche(s) et ${linkedExpensesCount} dépense(s) actives.`,
        }
      : null,
  })
}

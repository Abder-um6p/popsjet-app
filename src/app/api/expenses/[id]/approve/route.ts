import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// POST /api/expenses/[id]/approve — approuver une dépense
// Permissions : admin, directeur, chef_projet
export async function POST(
  _req: NextRequest,
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
      { error: 'Seuls les administrateurs, directeurs et chefs de projet peuvent approuver une dépense.' },
      { status: 403 }
    )
  }

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
      { error: `Impossible d'approuver : la dépense est déjà "${expense.status}". Seules les dépenses en attente peuvent être approuvées.` },
      { status: 409 }
    )
  }

  // ── P-04 : chef_projet doit être membre du projet concerné ────────────────
  if (profile.role === 'chef_projet') {
    const { data: membership } = await admin
      .from('project_members')
      .select('id')
      .eq('project_id', expense.project_id)
      .eq('profile_id', user.id)
      .maybeSingle()

    if (!membership) {
      return NextResponse.json(
        { error: 'Accès refusé — vous n\'êtes pas membre du projet associé à cette dépense.' },
        { status: 403 }
      )
    }
  }

  const now = new Date().toISOString()

  // ── Vérification budgétaire (warning, pas blocage) ─────────────────────────
  // Calcule le total des dépenses déjà approuvées sur ce projet + celle-ci.
  // Si le budget projet est défini et dépassé, on retourne un budget_warning.
  let budgetWarning: string | null = null
  try {
    const [{ data: project }, { data: approvedExpenses }] = await Promise.all([
      admin.from('projects').select('budget, title').eq('id', expense.project_id).single(),
      admin.from('expenses')
        .select('amount')
        .eq('project_id', expense.project_id)
        .eq('status', 'approved')
        .is('deleted_at', null),
    ])

    const projectBudget = project?.budget ?? null
    if (projectBudget && projectBudget > 0) {
      const totalApproved = (approvedExpenses ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)
      const newTotal = totalApproved + (expense.amount ?? 0)
      if (newTotal > projectBudget) {
        const over = newTotal - projectBudget
        budgetWarning = `Le budget du projet est dépassé de ${over.toLocaleString('fr-FR')} MAD (budget : ${projectBudget.toLocaleString('fr-FR')} MAD, total approuvé après cette dépense : ${newTotal.toLocaleString('fr-FR')} MAD).`
      }
    }
  } catch { /* non-bloquant */ }

  const { data: updated, error: updateError } = await admin
    .from('expenses')
    .update({ status: 'approved', approved_by: user.id, approved_at: now, updated_at: now })
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
      action:      'expense_approved',
      entity_type: 'expense',
      entity_id:   id,
      entity_name: expense.title,
      old_data:    { status: 'pending' },
      new_data:    { status: 'approved', approved_by: user.id, approved_at: now },
    })
  } catch { /* swallow */ }

  // Notification au soumetteur (non-bloquant)
  if (expense.submitted_by && expense.submitted_by !== user.id) {
    try {
      await admin.from('notifications').insert({
        user_id: expense.submitted_by,
        type:    'expense_approved',
        title:   'Dépense approuvée',
        message: `${profile.full_name ?? 'Un responsable'} a approuvé votre dépense "${expense.title}" (${expense.amount} MAD)`,
        related_id:   id,
        related_type: 'expense',
        is_read: false,
      })
    } catch { /* swallow */ }
  }

  return NextResponse.json({ ok: true, expense: updated, budget_warning: budgetWarning })
}

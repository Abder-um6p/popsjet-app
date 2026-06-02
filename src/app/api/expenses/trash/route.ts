import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/expenses/trash
// - admin/directeur : voient toutes les dépenses supprimées
// - autres          : voient uniquement leurs propres dépenses supprimées
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const admin = createAdminClient()
  const isPrivileged = ['admin', 'directeur'].includes(profile.role)

  // Étape 1 : dépenses supprimées (scope selon rôle)
  let query = admin
    .from('expenses')
    .select('id, title, amount, status, category, program_id, submitted_by, deleted_at, created_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (!isPrivileged) {
    query = query.eq('submitted_by', user.id)
  }

  const { data: expenses, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!expenses || expenses.length === 0) return NextResponse.json([])

  const ids = expenses.map(e => e.id)

  // Étape 2 : deleted_by (optionnel)
  const deletedByMap: Record<string, string | null> = {}
  const { data: dbData } = await admin
    .from('expenses').select('id, deleted_by').in('id', ids)
  ;(dbData ?? []).forEach((e: any) => { deletedByMap[e.id] = e.deleted_by ?? null })

  // Étape 3 : profils
  const profileIds = [
    ...new Set([
      ...Object.values(deletedByMap).filter(Boolean),
      ...expenses.map(e => e.submitted_by).filter(Boolean),
    ]),
  ] as string[]

  const profileMap: Record<string, { id: string; full_name: string }> = {}
  if (profileIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles').select('id, full_name').in('id', profileIds)
    ;(profiles ?? []).forEach((p: any) => { profileMap[p.id] = p })
  }

  const result = expenses.map(e => ({
    ...e,
    deleted_by:         deletedByMap[e.id] ?? null,
    deleted_by_profile: deletedByMap[e.id] ? (profileMap[deletedByMap[e.id]!] ?? null) : null,
    submitter:          e.submitted_by ? (profileMap[e.submitted_by] ?? null) : null,
  }))

  return NextResponse.json(result)
}

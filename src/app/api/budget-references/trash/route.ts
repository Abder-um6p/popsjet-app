import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/budget-references/trash (admin/directeur uniquement)
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile || !['admin', 'directeur'].includes(profile.role)) {
    return NextResponse.json({ error: 'Réservé aux administrateurs et directeurs' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Étape 1 : références supprimées
  const { data: refs, error } = await admin
    .from('budget_references')
    .select('id, code, label, program_id, created_by, deleted_at, created_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!refs || refs.length === 0) return NextResponse.json([])

  const ids = refs.map(r => r.id)

  // Étape 2 : deleted_by (optionnel)
  const deletedByMap: Record<string, string | null> = {}
  const { data: dbData } = await admin
    .from('budget_references').select('id, deleted_by').in('id', ids)
  ;(dbData ?? []).forEach((r: any) => { deletedByMap[r.id] = r.deleted_by ?? null })

  // Étape 3 : profils
  const profileIds = [
    ...new Set([
      ...Object.values(deletedByMap).filter(Boolean),
      ...refs.map(r => r.created_by).filter(Boolean),
    ]),
  ] as string[]

  const profileMap: Record<string, { id: string; full_name: string }> = {}
  if (profileIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles').select('id, full_name').in('id', profileIds)
    ;(profiles ?? []).forEach((p: any) => { profileMap[p.id] = p })
  }

  const result = refs.map(r => ({
    ...r,
    deleted_by:         deletedByMap[r.id] ?? null,
    deleted_by_profile: deletedByMap[r.id] ? (profileMap[deletedByMap[r.id]!] ?? null) : null,
    creator:            r.created_by ? (profileMap[r.created_by] ?? null) : null,
  }))

  return NextResponse.json(result)
}

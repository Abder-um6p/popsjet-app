import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/programs/trash
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

  // Step 1: programmes supprimés
  const { data: programs, error } = await admin
    .from('programs')
    .select('id, code, name, description, is_active, deleted_at, created_by, created_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!programs || programs.length === 0) return NextResponse.json([])

  const ids = programs.map(p => p.id)

  // Step 2 : deleted_by (optionnel)
  const deletedByMap: Record<string, string | null> = {}
  const { data: dbData } = await admin
    .from('programs').select('id, deleted_by').in('id', ids)
  ;(dbData ?? []).forEach((p: any) => { deletedByMap[p.id] = p.deleted_by ?? null })

  // Step 3 : profils
  const profileIds = [
    ...new Set([
      ...Object.values(deletedByMap).filter(Boolean),
      ...programs.map(p => p.created_by).filter(Boolean),
    ]),
  ] as string[]

  const profileMap: Record<string, { id: string; full_name: string }> = {}
  if (profileIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles').select('id, full_name').in('id', profileIds)
    ;(profiles ?? []).forEach((p: any) => { profileMap[p.id] = p })
  }

  const result = programs.map(p => ({
    ...p,
    deleted_by:         deletedByMap[p.id] ?? null,
    deleted_by_profile: deletedByMap[p.id] ? (profileMap[deletedByMap[p.id]!] ?? null) : null,
    creator:            p.created_by ? (profileMap[p.created_by] ?? null) : null,
  }))

  return NextResponse.json(result)
}

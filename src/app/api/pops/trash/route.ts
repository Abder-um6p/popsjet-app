import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/pops/trash
// - admin/directeur : voient tous les pops supprimés
// - autres          : voient uniquement leurs propres pops supprimés
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const admin = createAdminClient()
  const isPrivileged = ['admin', 'directeur'].includes(profile.role)

  // Étape 1 : pops supprimés
  let query = admin
    .from('pops')
    .select('id, content, author_id, deleted_at, created_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (!isPrivileged) {
    query = query.eq('author_id', user.id)
  }

  const { data: pops, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!pops || pops.length === 0) return NextResponse.json([])

  const ids = pops.map(p => p.id)

  // Étape 2 : deleted_by (optionnel)
  const deletedByMap: Record<string, string | null> = {}
  const { data: dbData } = await admin
    .from('pops').select('id, deleted_by').in('id', ids)
  ;(dbData ?? []).forEach((p: any) => { deletedByMap[p.id] = p.deleted_by ?? null })

  // Étape 3 : profils
  const profileIds = [
    ...new Set([
      ...Object.values(deletedByMap).filter(Boolean),
      ...pops.map(p => p.author_id).filter(Boolean),
    ]),
  ] as string[]

  const profileMap: Record<string, { id: string; full_name: string }> = {}
  if (profileIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles').select('id, full_name').in('id', profileIds)
    ;(profiles ?? []).forEach((p: any) => { profileMap[p.id] = p })
  }

  const result = pops.map(p => ({
    ...p,
    deleted_by:         deletedByMap[p.id] ?? null,
    deleted_by_profile: deletedByMap[p.id] ? (profileMap[deletedByMap[p.id]!] ?? null) : null,
    author:             p.author_id ? (profileMap[p.author_id] ?? null) : null,
  }))

  return NextResponse.json(result)
}

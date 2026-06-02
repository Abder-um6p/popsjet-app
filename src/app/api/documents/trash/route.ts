import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/documents/trash
// - admin/directeur : voient tous les documents supprimés
// - autres          : voient uniquement leurs propres documents supprimés
export async function GET(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const admin = createAdminClient()
  const isPrivileged = ['admin', 'directeur'].includes(profile.role)

  // Étape 1 : documents supprimés
  let query = admin
    .from('documents')
    .select('id, title, file_url, file_type, file_size, uploaded_by, project_id, task_id, deleted_at, created_at')
    .not('deleted_at', 'is', null)
    .order('deleted_at', { ascending: false })

  if (!isPrivileged) {
    query = query.eq('uploaded_by', user.id)
  }

  const { data: docs, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!docs || docs.length === 0) return NextResponse.json([])

  const ids = docs.map(d => d.id)

  // Étape 2 : deleted_by (optionnel)
  const deletedByMap: Record<string, string | null> = {}
  const { data: dbData } = await admin
    .from('documents').select('id, deleted_by').in('id', ids)
  ;(dbData ?? []).forEach((d: any) => { deletedByMap[d.id] = d.deleted_by ?? null })

  // Étape 3 : profils
  const profileIds = [
    ...new Set([
      ...Object.values(deletedByMap).filter(Boolean),
      ...docs.map(d => d.uploaded_by).filter(Boolean),
    ]),
  ] as string[]

  const profileMap: Record<string, { id: string; full_name: string }> = {}
  if (profileIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles').select('id, full_name').in('id', profileIds)
    ;(profiles ?? []).forEach((p: any) => { profileMap[p.id] = p })
  }

  const result = docs.map(d => ({
    ...d,
    deleted_by:         deletedByMap[d.id] ?? null,
    deleted_by_profile: deletedByMap[d.id] ? (profileMap[deletedByMap[d.id]!] ?? null) : null,
    uploader:           d.uploaded_by ? (profileMap[d.uploaded_by] ?? null) : null,
  }))

  return NextResponse.json(result)
}

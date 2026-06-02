import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/projects/trash — liste les projets soft-deleted
export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile || !['admin', 'directeur'].includes(profile.role)) {
    return NextResponse.json({ error: 'Réservé aux administrateurs et directeurs' }, { status: 403 })
  }

  const admin = createAdminClient()

  // ── Step 1 : colonnes garanties uniquement (id, code, title, type, status, created_by, created_at) ──
  // deleted_by et is_deleted sont OPTIONNELS — ajoutés séparément après
  // programs est récupéré séparément aussi pour éviter les erreurs de FK join

  let trashData: any[] | null = null

  // Essai A : is_deleted = true (migration appliquée)
  const { data: dA, error: eA } = await admin
    .from('projects')
    .select('id, code, title, type, status, deleted_at, created_by, created_at, program_id')
    .eq('is_deleted', true)
    .order('deleted_at', { ascending: false })

  if (!eA) {
    trashData = dA ?? []
    console.log('[projects/trash] Filtre is_deleted=true OK, count:', trashData.length)
  } else {
    // Essai B : deleted_at IS NOT NULL (pré-migration, is_deleted absent)
    console.warn('[projects/trash] is_deleted absent ou erreur:', eA.message, '— fallback deleted_at')

    const { data: dB, error: eB } = await admin
      .from('projects')
      .select('id, code, title, type, status, deleted_at, created_by, created_at, program_id')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })

    if (eB) {
      console.error('[projects/trash] Erreur fatale même avec fallback:', {
        code: eB.code,
        message: eB.message,
        details: (eB as any).details,
        hint: (eB as any).hint,
      })
      return NextResponse.json(
        { error: eB.message, code: eB.code, hint: (eB as any).hint ?? null },
        { status: 500 }
      )
    }

    trashData = dB ?? []
    console.log('[projects/trash] Fallback deleted_at OK, count:', trashData.length)
  }

  if (!trashData || trashData.length === 0) {
    return NextResponse.json([])
  }

  const ids = trashData.map(p => p.id)

  // ── Step 2 : deleted_by (optionnel — migration) ───────────────────────────────
  let deletedByMap: Record<string, string | null> = {}
  {
    const { data, error } = await admin
      .from('projects')
      .select('id, deleted_by')
      .in('id', ids)

    if (!error && data) {
      data.forEach((p: any) => { deletedByMap[p.id] = p.deleted_by ?? null })
    } else if (error) {
      console.warn('[projects/trash] deleted_by absent:', error.message)
    }
  }

  // ── Step 3 : programmes ───────────────────────────────────────────────────────
  let programMap: Record<string, any> = {}
  {
    const uniqueProgramIds = [...new Set(trashData.map(p => p.program_id).filter(Boolean))] as string[]
    if (uniqueProgramIds.length > 0) {
      // Essai avec join
      const { data: joinData, error: joinError } = await admin
        .from('projects')
        .select('id, programs ( id, name, code, color )')
        .in('id', ids)

      if (!joinError && joinData) {
        joinData.forEach((p: any) => { programMap[p.id] = p.programs ?? null })
      } else {
        // Fallback : lookup direct sur programs
        if (joinError) console.warn('[projects/trash] Join programs échoué:', joinError.message)
        const { data: progData } = await admin
          .from('programs')
          .select('id, name, code, color')
          .in('id', uniqueProgramIds)
        const byId: Record<string, any> = {}
        ;(progData ?? []).forEach((p: any) => { byId[p.id] = p })
        trashData.forEach(p => { programMap[p.id] = p.program_id ? (byId[p.program_id] ?? null) : null })
      }
    }
  }

  // ── Step 4 : profils (deleted_by + created_by) ────────────────────────────────
  const profileIds = [
    ...new Set([
      ...Object.values(deletedByMap).filter(Boolean),
      ...trashData.map(p => p.created_by).filter(Boolean),
    ]),
  ] as string[]

  let profileMap: Record<string, { id: string; full_name: string }> = {}
  if (profileIds.length > 0) {
    const { data: profiles, error: profilesError } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', profileIds)

    if (profilesError) {
      console.warn('[projects/trash] Profils inaccessibles:', profilesError.message)
    } else {
      ;(profiles ?? []).forEach((p: any) => { profileMap[p.id] = p })
    }
  }

  // ── Assembler la réponse ───────────────────────────────────────────────────────
  const result = trashData.map(p => {
    const deletedBy = deletedByMap[p.id] ?? null
    return {
      ...p,
      programs:           programMap[p.id] ?? null,
      deleted_by:         deletedBy,
      deleted_by_profile: deletedBy ? (profileMap[deletedBy] ?? null) : null,
      creator:            p.created_by ? (profileMap[p.created_by] ?? null) : null,
    }
  })

  return NextResponse.json(result)
}

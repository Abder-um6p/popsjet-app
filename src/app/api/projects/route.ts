import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/projects?search=&status=&type=&program_id=&mine=true
export async function GET(req: NextRequest) {

  // ── Auth ──────────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    console.error('[/api/projects] Auth error:', authError?.message)
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams
  const search    = sp.get('search')?.trim() ?? ''
  const status    = sp.get('status') ?? ''
  const type      = sp.get('type') ?? ''
  const programId = sp.get('program_id') ?? ''
  const mine      = sp.get('mine') === 'true'

  const admin = createAdminClient()

  // ── Step 1 : query minimale garantie ─────────────────────────────────────────
  // On commence avec uniquement des colonnes fondamentales (id, title, code, type,
  // status, created_by, program_id). Si même ça échoue, on log et on remonte l'erreur.
  const baseSelect = 'id, code, title, type, status, created_by, program_id'

  let baseQuery = admin
    .from('projects')
    .select(baseSelect)
    .order('created_at', { ascending: false })

  // Filtre deleted_at IS NULL — si la colonne n'existe pas, ce filtre échouera.
  // Dans ce cas on retente sans le filtre (pour ne pas bloquer complètement).
  let filteredQuery = baseQuery.is('deleted_at', null)

  if (search)    filteredQuery = filteredQuery.or(`title.ilike.%${search}%,code.ilike.%${search}%`)
  if (status)    filteredQuery = filteredQuery.eq('status', status)
  if (type)      filteredQuery = filteredQuery.eq('type', type)
  if (programId) filteredQuery = filteredQuery.eq('program_id', programId)

  let { data: baseProjects, error: baseError } = await filteredQuery

  if (baseError) {
    console.error('[/api/projects] Erreur query de base avec deleted_at:', {
      code: baseError.code,
      message: baseError.message,
      details: (baseError as any).details,
      hint: (baseError as any).hint,
    })

    // Tentative sans le filtre deleted_at
    let fallbackQuery = admin
      .from('projects')
      .select(baseSelect)
      .order('created_at', { ascending: false })

    if (search)    fallbackQuery = fallbackQuery.or(`title.ilike.%${search}%,code.ilike.%${search}%`)
    if (status)    fallbackQuery = fallbackQuery.eq('status', status)
    if (type)      fallbackQuery = fallbackQuery.eq('type', type)
    if (programId) fallbackQuery = fallbackQuery.eq('program_id', programId)

    const { data: fallbackData, error: fallbackError } = await fallbackQuery

    if (fallbackError) {
      console.error('[/api/projects] Erreur query fallback (sans deleted_at):', {
        code: fallbackError.code,
        message: fallbackError.message,
        details: (fallbackError as any).details,
        hint: (fallbackError as any).hint,
      })
      return NextResponse.json(
        {
          error: fallbackError.message,
          code: fallbackError.code,
          hint: (fallbackError as any).hint ?? null,
          debug: 'Contactez le support. Erreur sur la table projects.',
        },
        { status: 500 }
      )
    }

    baseProjects = fallbackData
    console.warn('[/api/projects] Fallback sans deleted_at utilisé — affichage sans filtre de suppression')
  }

  let list = (baseProjects ?? []) as any[]

  // ── Step 2 : colonnes optionnelles — completion_pct ──────────────────────────
  if (list.length > 0) {
    const ids = list.map(p => p.id)
    const { data: extra, error: extraError } = await admin
      .from('projects')
      .select('id, completion_pct, start_date, end_date, budget')
      .in('id', ids)

    if (!extraError && extra) {
      const extraMap: Record<string, any> = {}
      extra.forEach((p: any) => { extraMap[p.id] = p })
      list = list.map(p => ({
        ...p,
        completion_pct:  extraMap[p.id]?.completion_pct  ?? 0,
        start_date:      extraMap[p.id]?.start_date      ?? null,
        end_date:        extraMap[p.id]?.end_date        ?? null,
        budget:          extraMap[p.id]?.budget          ?? null,
      }))
    } else if (extraError) {
      console.warn('[/api/projects] Colonnes optionnelles non disponibles:', extraError.message)
      list = list.map(p => ({ ...p, completion_pct: 0, start_date: null, end_date: null, budget: null }))
    }
  }

  // ── Step 3 : join programs ────────────────────────────────────────────────────
  if (list.length > 0) {
    const ids = list.map(p => p.id)
    const { data: withPrograms, error: programsError } = await admin
      .from('projects')
      .select('id, programs ( id, name, code, color )')
      .in('id', ids)

    if (!programsError && withPrograms) {
      const progMap: Record<string, any> = {}
      withPrograms.forEach((p: any) => { progMap[p.id] = p.programs })
      list = list.map(p => ({ ...p, programs: progMap[p.id] ?? null }))
    } else if (programsError) {
      console.warn('[/api/projects] Join programs échoué:', programsError.message)
      // Fallback : récupérer les programmes séparément
      const uniqueProgramIds = [...new Set(list.map(p => p.program_id).filter(Boolean))] as string[]
      if (uniqueProgramIds.length > 0) {
        const { data: progData } = await admin
          .from('programs')
          .select('id, name, code, color')
          .in('id', uniqueProgramIds)
        const progMap: Record<string, any> = {}
        ;(progData ?? []).forEach((p: any) => { progMap[p.id] = p })
        list = list.map(p => ({ ...p, programs: p.program_id ? (progMap[p.program_id] ?? null) : null }))
      } else {
        list = list.map(p => ({ ...p, programs: null }))
      }
    }
  }

  // ── Step 4 : responsible (responsible_id ou chef_projet_id) ──────────────────
  if (list.length > 0) {
    const ids = list.map(p => p.id)
    const responsibleIdMap = await getResponsibleIds(admin, ids)

    const uniqueIds = [...new Set(Object.values(responsibleIdMap).filter(Boolean))] as string[]
    let profileMap: Record<string, { id: string; full_name: string; avatar_url: string | null }> = {}

    if (uniqueIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', uniqueIds)
      ;(profiles ?? []).forEach((p: any) => { profileMap[p.id] = p })
    }

    list = list.map(p => {
      const rid = responsibleIdMap[p.id] ?? null
      return { ...p, responsible_id: rid, responsible: rid ? (profileMap[rid] ?? null) : null }
    })
  }

  // ── Step 5 : filtre "Mes projets" ─────────────────────────────────────────────
  if (mine) {
    const { data: memberRows, error: memberError } = await admin
      .from('project_members')
      .select('project_id')
      .eq('profile_id', user.id)

    if (memberError) {
      console.warn('[/api/projects] project_members inaccessible:', memberError.message)
    }

    const memberIds = new Set((memberRows ?? []).map((r: any) => r.project_id))

    list = list.filter(p =>
      p.created_by === user.id ||
      memberIds.has(p.id) ||
      (p.responsible_id && p.responsible_id === user.id)
    )
  }

  return NextResponse.json(list)
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper : responsible_id avec fallback chef_projet_id
// ─────────────────────────────────────────────────────────────────────────────
async function getResponsibleIds(
  admin: ReturnType<typeof createAdminClient>,
  projectIds: string[]
): Promise<Record<string, string | null>> {
  if (projectIds.length === 0) return {}

  const { data: r1, error: e1 } = await admin
    .from('projects')
    .select('id, responsible_id')
    .in('id', projectIds)

  if (!e1 && r1) {
    const map: Record<string, string | null> = {}
    r1.forEach((p: any) => { map[p.id] = p.responsible_id ?? null })
    return map
  }

  if (e1) {
    console.warn('[getResponsibleIds] responsible_id:', e1.message, '— essai chef_projet_id')
    const { data: r2, error: e2 } = await admin
      .from('projects')
      .select('id, chef_projet_id')
      .in('id', projectIds)

    if (!e2 && r2) {
      const map: Record<string, string | null> = {}
      r2.forEach((p: any) => { map[p.id] = p.chef_projet_id ?? null })
      return map
    }

    if (e2) console.warn('[getResponsibleIds] chef_projet_id:', e2.message)
  }

  const map: Record<string, string | null> = {}
  projectIds.forEach(id => { map[id] = null })
  return map
}

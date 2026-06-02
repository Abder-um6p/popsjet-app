import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// GET /api/trash — agrégateur global de la corbeille
// Paramètres optionnels :
//   ?category=programs|projects|tasks|expenses|documents|pops|budget_references
//
// Permissions :
//   - admin/directeur : voient TOUT
//   - autres          : voient uniquement leurs propres éléments supprimés
//     (programmes, budget_refs exclus — réservés admin/directeur)
//
// M-07 : toutes les requêtes catégorie s'exécutent en parallèle via Promise.all
// + une seule résolution de profils groupée à la fin.

type Category =
  | 'programs'
  | 'projects'
  | 'tasks'
  | 'expenses'
  | 'documents'
  | 'pops'
  | 'budget_references'

interface TrashItem {
  id:                 string
  category:           Category
  name:               string
  deleted_at:         string
  deleted_by:         string | null
  deleted_by_profile: { id: string; full_name: string } | null
  owner_id:           string | null
  owner:              { id: string; full_name: string } | null
  meta:               Record<string, unknown>
}

// Raw record collected per category before profile resolution
interface RawTrashRecord {
  id:         string
  category:   Category
  name:       string
  deleted_at: string
  deleted_by: string | null
  owner_id:   string | null
  meta:       Record<string, unknown>
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()
  if (!profile) return NextResponse.json({ error: 'Profil introuvable' }, { status: 403 })

  const isPrivileged = ['admin', 'directeur'].includes(profile.role)

  const { searchParams } = new URL(req.url)
  const categoryFilter = searchParams.get('category') as Category | null

  const admin = createAdminClient()

  // ── Helper : fetch deleted_by column (optionnel — ajouté par migration) ────
  async function fetchDeletedBy(table: string, ids: string[]): Promise<Record<string, string | null>> {
    if (ids.length === 0) return {}
    try {
      const { data } = await (admin.from(table as any) as any)
        .select('id, deleted_by')
        .in('id', ids)
      const map: Record<string, string | null> = {}
      ;(data ?? []).forEach((x: any) => { map[x.id] = x.deleted_by ?? null })
      return map
    } catch {
      return {}
    }
  }

  // ── Fetch programs ────────────────────────────────────────────────────────
  async function fetchPrograms(): Promise<RawTrashRecord[]> {
    if (!isPrivileged || (categoryFilter && categoryFilter !== 'programs')) return []
    const { data } = await admin
      .from('programs')
      .select('id, name, deleted_at, created_by, deleted_by')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    return (data ?? []).map((x: any) => ({
      id:         x.id,
      category:   'programs' as Category,
      name:       x.name,
      deleted_at: x.deleted_at ?? '',
      deleted_by: x.deleted_by ?? null,
      owner_id:   x.created_by ?? null,
      meta:       {},
    }))
  }

  // ── Fetch projects ────────────────────────────────────────────────────────
  async function fetchProjects(): Promise<RawTrashRecord[]> {
    if (categoryFilter && categoryFilter !== 'projects') return []
    // deleted_at IS NOT NULL (fiable depuis v1.3)
    let q = admin
      .from('projects')
      .select('id, title, code, deleted_at, created_by, deleted_by')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (!isPrivileged) q = (q as any).eq('created_by', user.id)
    const { data } = await q
    return (data ?? []).map((x: any) => ({
      id:         x.id,
      category:   'projects' as Category,
      name:       x.title,
      deleted_at: x.deleted_at ?? '',
      deleted_by: x.deleted_by ?? null,
      owner_id:   x.created_by ?? null,
      meta:       { code: x.code },
    }))
  }

  // ── Fetch tasks ───────────────────────────────────────────────────────────
  async function fetchTasks(): Promise<RawTrashRecord[]> {
    if (categoryFilter && categoryFilter !== 'tasks') return []
    let q = admin
      .from('tasks')
      .select('id, title, deleted_at, created_by, deleted_by, status, project_id')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (!isPrivileged) q = (q as any).eq('created_by', user.id)
    const { data } = await q
    return (data ?? []).map((x: any) => ({
      id:         x.id,
      category:   'tasks' as Category,
      name:       x.title,
      deleted_at: x.deleted_at ?? '',
      deleted_by: x.deleted_by ?? null,
      owner_id:   x.created_by ?? null,
      meta:       { status: x.status, project_id: x.project_id },
    }))
  }

  // ── Fetch expenses ────────────────────────────────────────────────────────
  async function fetchExpenses(): Promise<RawTrashRecord[]> {
    if (categoryFilter && categoryFilter !== 'expenses') return []
    let q = admin
      .from('expenses')
      .select('id, title, amount, status, deleted_at, submitted_by, deleted_by')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (!isPrivileged) q = (q as any).eq('submitted_by', user.id)
    const { data } = await q
    return (data ?? []).map((x: any) => ({
      id:         x.id,
      category:   'expenses' as Category,
      name:       x.title,
      deleted_at: x.deleted_at ?? '',
      deleted_by: x.deleted_by ?? null,
      owner_id:   x.submitted_by ?? null,
      meta:       { amount: x.amount, status: x.status },
    }))
  }

  // ── Fetch documents ───────────────────────────────────────────────────────
  async function fetchDocuments(): Promise<RawTrashRecord[]> {
    if (categoryFilter && categoryFilter !== 'documents') return []
    let q = admin
      .from('documents')
      .select('id, title, deleted_at, uploaded_by, deleted_by')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (!isPrivileged) q = (q as any).eq('uploaded_by', user.id)
    const { data } = await q
    return (data ?? []).map((x: any) => ({
      id:         x.id,
      category:   'documents' as Category,
      name:       x.title,
      deleted_at: x.deleted_at ?? '',
      deleted_by: x.deleted_by ?? null,
      owner_id:   x.uploaded_by ?? null,
      meta:       {},
    }))
  }

  // ── Fetch pops ────────────────────────────────────────────────────────────
  async function fetchPops(): Promise<RawTrashRecord[]> {
    if (categoryFilter && categoryFilter !== 'pops') return []
    let q = admin
      .from('pops')
      .select('id, content, deleted_at, author_id, deleted_by')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    if (!isPrivileged) q = (q as any).eq('author_id', user.id)
    const { data } = await q
    return (data ?? []).map((x: any) => ({
      id:         x.id,
      category:   'pops' as Category,
      name:       (x.content ?? '').slice(0, 80),
      deleted_at: x.deleted_at ?? '',
      deleted_by: x.deleted_by ?? null,
      owner_id:   x.author_id ?? null,
      meta:       {},
    }))
  }

  // ── Fetch budget references ───────────────────────────────────────────────
  async function fetchBudgetRefs(): Promise<RawTrashRecord[]> {
    if (!isPrivileged || (categoryFilter && categoryFilter !== 'budget_references')) return []
    const { data } = await admin
      .from('budget_references')
      .select('id, code, designation, deleted_at, created_by, deleted_by')
      .not('deleted_at', 'is', null)
      .order('deleted_at', { ascending: false })
    return (data ?? []).map((x: any) => ({
      id:         x.id,
      category:   'budget_references' as Category,
      name:       `${x.code} — ${x.designation ?? ''}`,
      deleted_at: x.deleted_at ?? '',
      deleted_by: x.deleted_by ?? null,
      owner_id:   x.created_by ?? null,
      meta:       { code: x.code, designation: x.designation },
    }))
  }

  // ── Exécution parallèle de toutes les catégories ──────────────────────────
  const [programs, projects, tasks, expenses, documents, pops, budgetRefs] =
    await Promise.all([
      fetchPrograms(),
      fetchProjects(),
      fetchTasks(),
      fetchExpenses(),
      fetchDocuments(),
      fetchPops(),
      fetchBudgetRefs(),
    ])

  const raw: RawTrashRecord[] = [
    ...programs, ...projects, ...tasks, ...expenses, ...documents, ...pops, ...budgetRefs,
  ]

  // ── Résolution de profils — un seul appel pour toutes les catégories ───────
  const allUids = [...new Set(
    raw.flatMap(r => [r.owner_id, r.deleted_by]).filter(Boolean) as string[]
  )]

  const profileMap: Record<string, { id: string; full_name: string }> = {}
  if (allUids.length > 0) {
    const { data: profileRows } = await admin
      .from('profiles')
      .select('id, full_name')
      .in('id', allUids)
    ;(profileRows ?? []).forEach((p: any) => { profileMap[p.id] = p })
  }

  // ── Assembler les TrashItems finaux ───────────────────────────────────────
  const items: TrashItem[] = raw.map(r => ({
    id:                 r.id,
    category:           r.category,
    name:               r.name,
    deleted_at:         r.deleted_at,
    deleted_by:         r.deleted_by,
    deleted_by_profile: r.deleted_by ? (profileMap[r.deleted_by] ?? null) : null,
    owner_id:           r.owner_id,
    owner:              r.owner_id ? (profileMap[r.owner_id] ?? null) : null,
    meta:               r.meta,
  }))

  // ── Tri global par deleted_at décroissant ─────────────────────────────────
  items.sort((a, b) => {
    const da = a.deleted_at ? new Date(a.deleted_at).getTime() : 0
    const db2 = b.deleted_at ? new Date(b.deleted_at).getTime() : 0
    return db2 - da
  })

  // ── Compteurs par catégorie ───────────────────────────────────────────────
  const counts: Record<string, number> = {}
  items.forEach(i => { counts[i.category] = (counts[i.category] ?? 0) + 1 })

  return NextResponse.json({ items, counts, total: items.length })
}

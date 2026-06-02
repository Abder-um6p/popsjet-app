import { createAdminClient, createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Layers, Plus, Trash2 } from 'lucide-react'
import ProgramCard from './_components/ProgramCard'

export default async function ProgramsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  // ── Étape 1 : colonnes garanties — filtre deleted_at best-effort ────────────
  // On tente d'abord avec le filtre deleted_at. Si la colonne n'existe pas dans
  // ce schéma, on retombe sur la query sans filtre (le filtre JS à l'étape 3
  // reste la dernière ligne de défense).
  let baseRows: { id: string; code: string; name: string; description: string | null; created_at: string }[] | null = null
  {
    const { data: filtered, error: filterErr } = await admin
      .from('programs')
      .select('id, code, name, description, created_at')
      .is('deleted_at', null)
      .order('created_at', { ascending: false })
    if (!filterErr) {
      baseRows = filtered
    } else {
      // Fallback : colonne absente du schéma → charger tout, le filtre JS prendra le relais
      const { data: all } = await admin
        .from('programs')
        .select('id, code, name, description, created_at')
        .order('created_at', { ascending: false })
      baseRows = all
    }
  }

  const [{ data: profile }] = await Promise.all([
    supabase.from('profiles').select('role').eq('id', user.id).single(),
  ])

  const programIds = (baseRows ?? []).map(p => p.id)

  // ── Étape 2 : colonnes optionnelles (peuvent être absentes selon le schéma) ──
  // Si la requête échoue (colonne manquante), on traite tous les programmes
  // comme actifs et non supprimés.
  const optionalMap: Record<string, {
    is_active: boolean
    start_date: string | null
    end_date: string | null
    deleted_at: string | null
  }> = {}

  if (programIds.length > 0) {
    const { data: optionalRows } = await admin
      .from('programs')
      .select('id, is_active, start_date, end_date, deleted_at')
      .in('id', programIds)

    optionalRows?.forEach(r => {
      optionalMap[r.id] = {
        is_active:  r.is_active ?? true,
        start_date: r.start_date ?? null,
        end_date:   r.end_date ?? null,
        deleted_at: r.deleted_at ?? null,
      }
    })
  }

  const programs = (baseRows ?? [])
    .map(p => {
      const opt = optionalMap[p.id] ?? { is_active: true, start_date: null, end_date: null, deleted_at: null }
      return { ...p, ...opt }
    })
    .filter(p => p.deleted_at === null)

  const canCreate = ['admin', 'directeur'].includes((profile as any)?.role ?? '')

  // Fetch all projects grouped by program
  const { data: allProjects } = await admin
    .from('projects')
    .select('id, program_id, status, completion_pct')
    .is('deleted_at', null)

  const projectsByProgram = (allProjects ?? []).reduce<Record<string, typeof allProjects>>((acc, p) => {
    if (!p.program_id) return acc
    if (!acc[p.program_id]) acc[p.program_id] = []
    acc[p.program_id]!.push(p)
    return acc
  }, {})

  const enriched = (programs ?? []).map(p => {
    const projs = projectsByProgram[p.id] ?? []
    const active    = projs.filter(x => x.status === 'active').length
    const completed = projs.filter(x => x.status === 'completed').length
    const avg = projs.length > 0
      ? Math.round(projs.reduce((acc, x) => acc + (x.completion_pct ?? 0), 0) / projs.length)
      : 0
    return {
      id: p.id,
      code: p.code,
      name: p.name,
      description: p.description,
      is_active: p.is_active,
      start_date: p.start_date,
      end_date: p.end_date,
      projectCount: projs.length,
      activeCount: active,
      completedCount: completed,
      avgCompletion: avg,
    }
  })

  const activePrograms   = enriched.filter(p => p.is_active)
  const inactivePrograms = enriched.filter(p => !p.is_active)

  const canCreateProgram = ['admin', 'directeur'].includes(
    (profile as any)?.data?.role ?? (profile as any)?.role ?? ''
  )

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Layers className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900">Programs</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {enriched.length} programme{enriched.length !== 1 ? 's' : ''} ·{' '}
              {enriched.reduce((s, p) => s + p.projectCount, 0)} projet{enriched.reduce((s, p) => s + p.projectCount, 0) !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canCreateProgram && (
            <Link
              href="/programs/trash"
              className="inline-flex items-center gap-2 px-3 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
              title="Corbeille des programmes"
            >
              <Trash2 className="w-4 h-4" />
              Corbeille
            </Link>
          )}
          {canCreateProgram && (
            <Link
              href="/programs/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Nouveau program
            </Link>
          )}
        </div>
      </div>

      {/* Active programs */}
      {activePrograms.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Programs actifs ({activePrograms.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activePrograms.map(p => <ProgramCard key={p.id} program={p} canDelete={canCreateProgram} />)}
          </div>
        </div>
      )}

      {/* Inactive programs */}
      {inactivePrograms.length > 0 && (
        <div>
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
            Programs inactifs ({inactivePrograms.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 opacity-70">
            {inactivePrograms.map(p => <ProgramCard key={p.id} program={p} canDelete={canCreateProgram} />)}
          </div>
        </div>
      )}

      {enriched.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-20 text-center">
          <Layers className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <h3 className="text-base font-semibold text-gray-600 mb-1">Aucun program</h3>
          <p className="text-sm text-gray-400 mb-4">Les programs regroupent vos projets par thème ou initiative.</p>
          {canCreateProgram && (
            <Link
              href="/programs/new"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition"
            >
              <Plus className="w-4 h-4" />
              Créer un program
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

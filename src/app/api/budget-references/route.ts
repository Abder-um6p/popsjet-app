import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const WRITE_ROLES = ['admin', 'directeur', 'chef_projet']

// ─── GET /api/budget-references?program_id=xxx[&active=true] ─────────────────
// Liste les références d'un programme. Lecture ouverte (anon autorisé) pour
// permettre l'usage du sélecteur dans des formulaires publics futurs.

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const programId = searchParams.get('program_id')
  const activeOnly = searchParams.get('active') === 'true'

  if (!programId) {
    return NextResponse.json({ error: 'program_id requis' }, { status: 400 })
  }

  const admin = createAdminClient()

  let query = admin
    .from('budget_references')
    .select('id, program_id, code, designation, notes, is_active, created_by, created_at, updated_at')
    .eq('program_id', programId)
    .order('code', { ascending: true })

  if (activeOnly) query = query.eq('is_active', true)

  const { data, error } = await query

  if (error) {
    console.error('[GET /api/budget-references] Erreur:', error.message)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}

// ─── POST /api/budget-references ─────────────────────────────────────────────
// Body: { program_id, code, designation, notes?, is_active? }
// Auth requis. Rôle: admin / directeur / chef_projet.

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile || !WRITE_ROLES.includes(profile.role)) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  let body: {
    program_id?: string
    code?: string
    designation?: string
    notes?: string | null
    is_active?: boolean
  } = {}
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Corps invalide' }, { status: 400 })
  }

  const programId = body.program_id?.trim()
  const code = body.code?.trim().toUpperCase()
  const designation = body.designation?.trim()

  if (!programId) return NextResponse.json({ error: 'program_id requis' }, { status: 400 })
  if (!code) return NextResponse.json({ error: 'Le code est requis' }, { status: 400 })
  if (!designation) return NextResponse.json({ error: 'La désignation est requise' }, { status: 400 })

  const { data: program } = await admin
    .from('programs').select('id').eq('id', programId).maybeSingle()
  if (!program) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })

  const now = new Date().toISOString()

  try {
    const { data, error } = await admin
      .from('budget_references')
      .insert({
        program_id: programId,
        code,
        designation,
        notes: body.notes?.trim() || null,
        is_active: body.is_active ?? true,
        created_by: user.id,
        created_at: now,
        updated_at: now,
      })
      .select('id, program_id, code, designation, notes, is_active, created_by, created_at, updated_at')
      .single()

    if (error) {
      // 23505 = unique_violation (program_id + code)
      if (error.code === '23505') {
        return NextResponse.json({ error: 'Ce code existe déjà pour ce programme' }, { status: 409 })
      }
      console.error('[POST /api/budget-references] Erreur:', error.message)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/budget-references] EXCEPTION:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

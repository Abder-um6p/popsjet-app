import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// ── Génération de code unique PRG-XXX-NNNN ────────────────────────────────────
function buildCode(name: string): string {
  const prefix = name
    .toUpperCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Z0-9\s]/g, '')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(w => w.slice(0, 3))
    .join('-')
  const suffix = String(Math.floor(1000 + Math.random() * 9000))
  return `PRG-${prefix}-${suffix}`.slice(0, 20)
}

async function uniqueCode(name: string, admin: ReturnType<typeof createAdminClient>): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = buildCode(name)
    const { data } = await admin.from('programs').select('id').eq('code', code).maybeSingle()
    if (!data) return code
  }
  // Fallback ultra-unique
  return `PRG-${Date.now().toString(36).toUpperCase()}`
}

// POST /api/programs — créer un nouveau programme
export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const admin = createAdminClient()

    // Vérifier le rôle
    const { data: profile } = await admin
      .from('profiles').select('role').eq('id', user.id).single()

    if (!['admin', 'directeur'].includes(profile?.role ?? '')) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await req.json()
    const { name, description, objectives, is_active, is_confidential, start_date, end_date } = body

    if (!name?.trim()) return NextResponse.json({ error: 'Le nom est requis' }, { status: 400 })

    // Code généré automatiquement côté serveur
    const code = await uniqueCode(name.trim(), admin)
    const now = new Date().toISOString()

    // Tentative 1 : avec objectives (colonne v2)
    let program: Record<string, unknown> | null = null
    const base = {
      name: name.trim(),
      code,
      description: description?.trim() || null,
      is_active: is_active ?? true,
      start_date: start_date || null,
      end_date: end_date || null,
      created_by: user.id,
      created_at: now,
      updated_at: now,
    }

    // Tentative 1 : avec toutes les colonnes v2 (objectives + is_confidential)
    const { data: p1, error: e1 } = await admin
      .from('programs')
      .insert({
        ...base,
        objectives: objectives?.trim() || null,
        is_confidential: is_confidential ?? false,
      })
      .select()
      .single()

    if (!e1) {
      program = p1
    } else {
      // Tentative 2 : avec objectives seulement
      console.warn('[POST /api/programs] Insert complet échoué, fallback objectifs seul:', e1.message)
      const { data: p2, error: e2 } = await admin
        .from('programs')
        .insert({ ...base, objectives: objectives?.trim() || null })
        .select()
        .single()

      if (!e2) {
        program = p2
      } else {
        // Tentative 3 : insert minimal
        console.warn('[POST /api/programs] Fallback objectives échoué, insert minimal:', e2.message)
        const { data: p3, error: e3 } = await admin
          .from('programs')
          .insert(base)
          .select()
          .single()
        if (e3) return NextResponse.json({ error: e3.message }, { status: 500 })
        program = p3
      }
    }

    return NextResponse.json({ ok: true, program })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[POST /api/programs] EXCEPTION:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

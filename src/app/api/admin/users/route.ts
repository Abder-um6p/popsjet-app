import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function getAdminAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

/** GET /api/admin/users — list all users with auth metadata */
export async function GET() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (!['admin', 'directeur'].includes(caller?.role ?? '')) {
    return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
  }

  const adminClient = getAdminAuthClient()

  // Get all profiles
  const { data: profiles, error } = await adminClient
    .from('profiles')
    .select('id, full_name, email, role, avatar_url, onboarding_completed, disabled_at, invited_by, created_at, updated_at')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get auth users for last_sign_in_at
  const { data: authUsers } = await adminClient.auth.admin.listUsers({ perPage: 1000 })
  const authMap: Record<string, string | null> = {}
  for (const u of authUsers?.users ?? []) {
    authMap[u.id] = u.last_sign_in_at ?? null
  }

  const enriched = (profiles ?? []).map(p => ({
    ...p,
    last_sign_in_at: authMap[p.id] ?? null,
  }))

  return NextResponse.json(enriched)
}

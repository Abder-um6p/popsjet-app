import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function getAdminAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function getAdminUser(supabase: ReturnType<typeof createServerClient>) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (!profile || !['admin', 'directeur'].includes(profile.role)) return null
  return { user, profile }
}

// GET /api/admin/reset-requests — list all pending/all requests
export async function GET(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => toSet.forEach(({ name, value, options }) =>
          cookieStore.set(name, value, options)
        ),
      },
    }
  )

  const admin = await getAdminUser(supabase)
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const status = req.nextUrl.searchParams.get('status') ?? 'pending'

  let query = supabase
    .from('password_reset_requests')
    .select(`
      id,
      email,
      status,
      requested_at,
      reviewed_at,
      review_note,
      user_id,
      profiles!password_reset_requests_user_id_fkey (
        full_name,
        role,
        avatar_url
      ),
      reviewer:profiles!password_reset_requests_reviewed_by_fkey (
        full_name
      )
    `)
    .order('requested_at', { ascending: false })

  if (status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ requests: data ?? [] })
}

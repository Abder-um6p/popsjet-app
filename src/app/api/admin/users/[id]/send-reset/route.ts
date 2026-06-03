import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function getAdminAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false, flowType: 'implicit' } }
  )
}

// POST /api/admin/users/[id]/send-reset
// Admin directly sends a password reset link to a user (no pending request needed)
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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

  // Auth guard: admin only
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!adminProfile || adminProfile.role !== 'admin') {
    return NextResponse.json({ error: 'Réservé aux administrateurs' }, { status: 403 })
  }

  // Get target user profile
  const { data: targetProfile, error: profileError } = await supabase
    .from('profiles')
    .select('id, email, disabled_at')
    .eq('id', id)
    .single()

  if (profileError || !targetProfile) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  }

  if (targetProfile.disabled_at) {
    return NextResponse.json({ error: 'Ce compte est désactivé' }, { status: 400 })
  }

  const adminAuthClient = getAdminAuthClient()
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
    ?? req.headers.get('origin')
    ?? 'https://popsjet-app.vercel.app'

  const { error: resetError } = await adminAuthClient.auth.resetPasswordForEmail(
    targetProfile.email,
    { redirectTo: `${siteUrl}/auth/reset-password` }
  )

  if (resetError) {
    console.error('Admin send-reset error:', resetError)
    return NextResponse.json({ error: 'Erreur lors de l\'envoi du lien' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

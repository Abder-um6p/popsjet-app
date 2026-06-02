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
    .select('id, role')
    .eq('id', user.id)
    .single()
  if (!profile || !['admin', 'directeur'].includes(profile.role)) return null
  return { user, profile }
}

// PATCH /api/admin/reset-requests/[id]
// body: { action: 'approve' | 'reject', note?: string }
export async function PATCH(
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

  const admin = await getAdminUser(supabase)
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const { action, note } = await req.json()
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'Action invalide' }, { status: 400 })
  }

  // Get the request
  const { data: resetReq, error: fetchError } = await supabase
    .from('password_reset_requests')
    .select('id, email, status, user_id')
    .eq('id', id)
    .single()

  if (fetchError || !resetReq) {
    return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 })
  }

  if (resetReq.status !== 'pending') {
    return NextResponse.json({ error: 'Demande déjà traitée' }, { status: 409 })
  }

  if (action === 'approve') {
    // Use the regular supabase client (anon key) to trigger the reset email
    // This sends via Supabase's email service
    const adminAuthClient = getAdminAuthClient()
    const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? ''

    const { error: resetError } = await adminAuthClient.auth.resetPasswordForEmail(
      resetReq.email,
      { redirectTo: `${origin}/auth/reset-password` }
    )

    if (resetError) {
      console.error('Reset email error:', resetError)
      return NextResponse.json({ error: 'Erreur lors de l\'envoi du lien' }, { status: 500 })
    }
  }

  // Update request status
  const { error: updateError } = await supabase
    .from('password_reset_requests')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.profile.id,
      review_note: note ?? null,
    })
    .eq('id', id)

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, action })
}

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

  // Utiliser le service role pour toutes les opérations DB (évite les problèmes RLS)
  const adminClient = getAdminAuthClient()

  const { data: resetReq, error: fetchError } = await adminClient
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
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://popsjet-app.vercel.app'

    // Utilise l'email intégré Supabase (pas besoin de domaine Resend vérifié)
    const { error: resetError } = await adminClient.auth.resetPasswordForEmail(
      resetReq.email,
      { redirectTo: `${siteUrl}/auth/reset-password` }
    )

    if (resetError) {
      console.error('resetPasswordForEmail error:', resetError)
      return NextResponse.json({ error: 'Erreur envoi email de réinitialisation' }, { status: 500 })
    }

    // Notifier l'utilisateur dans l'app (service role, pas de problème RLS)
    await adminClient.from('notifications').insert({
      user_id: resetReq.user_id,
      type: 'password_reset_approved',
      title: 'Demande approuvée',
      message: 'Votre demande de réinitialisation de mot de passe a été approuvée. Vérifiez votre email.',
      is_read: false,
    })
  }

  if (action === 'reject') {
    await adminClient.from('notifications').insert({
      user_id: resetReq.user_id,
      type: 'password_reset_rejected',
      title: 'Demande refusée',
      message: note ? `Votre demande a été refusée : ${note}` : 'Votre demande de réinitialisation de mot de passe a été refusée.',
      is_read: false,
    })
  }

  // Mettre à jour le statut (service role)
  const { error: updateError } = await adminClient
    .from('password_reset_requests')
    .update({
      status: action === 'approve' ? 'approved' : 'rejected',
      reviewed_at: new Date().toISOString(),
      reviewed_by: admin.profile.id,
      review_note: note ?? null,
    })
    .eq('id', id)

  if (updateError) {
    console.error('Status update error:', updateError)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, action })
}

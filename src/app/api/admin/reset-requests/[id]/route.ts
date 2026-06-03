import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

const RESEND_FROM = process.env.RESEND_FROM_EMAIL ?? 'PopsJet <onboarding@resend.dev>'

function getAdminAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function sendViaResend(to: string, subject: string, html: string): Promise<boolean> {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) { console.error('RESEND_API_KEY missing'); return false }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: RESEND_FROM, to: [to], subject, html }),
  })
  if (!res.ok) {
    const body = await res.text()
    console.error(`Resend error ${res.status}:`, body)
    return false
  }
  return true
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

    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: resetReq.email,
      options: { redirectTo: `${siteUrl}/auth/reset-password` },
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('generateLink error:', linkError)
      return NextResponse.json({ error: 'Erreur génération du lien' }, { status: 500 })
    }

    const emailSent = await sendViaResend(
      resetReq.email,
      'Votre demande de réinitialisation a été approuvée — PopsJet',
      `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h1 style="font-size:24px;font-weight:700;color:#111">PopsJet</h1>
        <p style="color:#444;margin-top:16px">Votre demande de réinitialisation a été approuvée.</p>
        <a href="${linkData.properties.action_link}" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
          Réinitialiser mon mot de passe
        </a>
        <p style="color:#888;font-size:13px;margin-top:24px">Ce lien est valable 1 heure.</p>
      </div>`
    )

    if (!emailSent) {
      return NextResponse.json({ error: 'Erreur envoi email — vérifiez les logs Resend' }, { status: 500 })
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

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
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://popsjet-app.vercel.app'

  const { data: linkData, error: linkError } = await adminAuthClient.auth.admin.generateLink({
    type: 'recovery',
    email: targetProfile.email,
    options: { redirectTo: `${siteUrl}/auth/reset-password` },
  })

  if (linkError || !linkData?.properties?.action_link) {
    console.error('Admin generateLink error:', linkError)
    return NextResponse.json({ error: 'Erreur lors de la génération du lien' }, { status: 500 })
  }

  const recoveryLink = linkData.properties.action_link
  const fromEmail = 'onboarding@resend.dev' // domaine vérifié Resend — changer après vérification @um6p.ma
  const resendKey = process.env.RESEND_API_KEY

  if (!resendKey) {
    return NextResponse.json({ error: 'RESEND_API_KEY manquant' }, { status: 500 })
  }

  const emailRes = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: `PopsJet <${fromEmail}>`,
      to: [targetProfile.email],
      subject: 'Réinitialisation de votre mot de passe — PopsJet',
      html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
        <h1 style="font-size:24px;font-weight:700;color:#111">PopsJet</h1>
        <p style="color:#444;margin-top:16px">Un administrateur vous a envoyé un lien de réinitialisation.</p>
        <a href="${recoveryLink}" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
          Réinitialiser mon mot de passe
        </a>
        <p style="color:#888;font-size:13px;margin-top:24px">Ce lien est valable 1 heure.</p>
      </div>`,
    }),
  })

  if (!emailRes.ok) {
    const errBody = await emailRes.text()
    console.error('Resend error:', emailRes.status, errBody)
    return NextResponse.json({ error: 'Erreur envoi email' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

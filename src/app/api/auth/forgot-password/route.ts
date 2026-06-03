import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

    const adminClient = getAdminClient()
    const normalizedEmail = email.trim().toLowerCase()

    // Vérifier que le compte existe et n'est pas désactivé
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, disabled_at')
      .eq('email', normalizedEmail)
      .maybeSingle()

    // Toujours ok pour ne pas révéler si l'email existe
    if (!profile || profile.disabled_at) {
      return NextResponse.json({ ok: true })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://popsjet-app.vercel.app'

    // Générer le lien de récupération (pas de PKCE, flux implicite)
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: normalizedEmail,
      options: { redirectTo: `${siteUrl}/auth/reset-password` },
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('generateLink error:', linkError)
      return NextResponse.json({ ok: true })
    }

    const recoveryLink = linkData.properties.action_link
    const resendKey = process.env.RESEND_API_KEY

    if (!resendKey) {
      console.error('RESEND_API_KEY manquant')
      return NextResponse.json({ ok: true })
    }

    // Toujours utiliser onboarding@resend.dev si le domaine custom n'est pas vérifié
    const fromEmail = 'onboarding@resend.dev'

    const emailRes = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `PopsJet <${fromEmail}>`,
        to: [normalizedEmail],
        subject: 'Réinitialisation de votre mot de passe — PopsJet',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
            <h1 style="font-size:24px;font-weight:700;color:#111">PopsJet</h1>
            <p style="color:#444;margin-top:16px">Vous avez demandé la réinitialisation de votre mot de passe.</p>
            <p style="color:#444">Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :</p>
            <a href="${recoveryLink}"
               style="display:inline-block;margin-top:24px;padding:12px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
              Réinitialiser mon mot de passe
            </a>
            <p style="color:#888;font-size:13px;margin-top:24px">
              Ce lien est valable 1 heure. Si vous n'avez pas fait cette demande, ignorez cet email.
            </p>
          </div>
        `,
      }),
    })

    if (!emailRes.ok) {
      const errBody = await emailRes.text()
      console.error('Resend send error:', emailRes.status, errBody)
    }

    // Créer aussi une demande dans password_reset_requests pour le suivi admin
    await adminClient.from('password_reset_requests').insert({
      user_id: profile.id,
      email: normalizedEmail,
      status: 'approved', // Directement approuvé — email déjà envoyé
    }).then(() => {}).catch(() => {}) // Non-bloquant

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('forgot-password error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

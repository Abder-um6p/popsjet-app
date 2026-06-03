import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'abderrahmane.haddad@um6p.ma').toLowerCase()

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function sendViaResend(to: string, subject: string, html: string) {
  const resendKey = process.env.RESEND_API_KEY
  if (!resendKey) { console.error('RESEND_API_KEY missing'); return false }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'PopsJet <onboarding@resend.dev>', to: [to], subject, html }),
  })
  if (!res.ok) { console.error('Resend error:', await res.text()); return false }
  return true
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

    const normalizedEmail = email.trim().toLowerCase()
    const isAdmin = normalizedEmail === ADMIN_EMAIL
    const adminClient = getAdminClient()
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://popsjet-app.vercel.app'

    // Récupérer le profil (case-insensitive)
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, email, full_name, disabled_at')
      .ilike('email', normalizedEmail)
      .maybeSingle()

    if (!profile || profile.disabled_at) {
      return NextResponse.json({ ok: true, isAdmin })
    }

    if (isAdmin) {
      // ── Parcours 1 : Admin ──
      // Générer le lien de reset (implicit, pas de PKCE serveur)
      const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
        type: 'recovery',
        email: profile.email,
        options: { redirectTo: `${siteUrl}/auth/reset-password` },
      })

      if (linkError || !linkData?.properties?.action_link) {
        console.error('generateLink error:', linkError?.message)
        return NextResponse.json({ ok: true, isAdmin })
      }

      const recoveryLink = linkData.properties.action_link

      await sendViaResend(
        profile.email,
        'Réinitialisation de votre mot de passe — PopsJet',
        `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
          <h1 style="font-size:24px;font-weight:700;color:#111">PopsJet</h1>
          <p style="color:#444;margin-top:16px">Vous avez demandé la réinitialisation de votre mot de passe administrateur.</p>
          <p style="color:#444">Cliquez sur le bouton ci-dessous. Un code de vérification vous sera ensuite envoyé.</p>
          <a href="${recoveryLink}" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
            Réinitialiser mon mot de passe
          </a>
          <p style="color:#888;font-size:13px;margin-top:24px">Ce lien est valable 1 heure.</p>
        </div>`
      )

      return NextResponse.json({ ok: true, isAdmin: true })
    } else {
      // ── Parcours 2 : Non-admin ──
      // Créer une demande de réinitialisation
      const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
      const { data: existing } = await adminClient
        .from('password_reset_requests')
        .select('id')
        .eq('user_id', profile.id)
        .eq('status', 'pending')
        .gte('requested_at', tenMinAgo)
        .maybeSingle()

      if (!existing) {
        await adminClient.from('password_reset_requests').insert({
          user_id: profile.id,
          email: profile.email,
          status: 'pending',
          requested_at: new Date().toISOString(),
        })

        // Notifier l'admin dans l'app
        const { data: adminProfile } = await adminClient
          .from('profiles')
          .select('id')
          .ilike('email', ADMIN_EMAIL)
          .maybeSingle()

        if (adminProfile) {
          await adminClient.from('notifications').insert({
            user_id: adminProfile.id,
            type: 'password_reset_request',
            title: 'Demande de réinitialisation',
            message: `${profile.full_name || profile.email} demande la réinitialisation de son mot de passe.`,
            is_read: false,
          })
        }

        // Email optionnel à l'admin
        await sendViaResend(
          ADMIN_EMAIL,
          'Nouvelle demande de réinitialisation — PopsJet',
          `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
            <h1 style="font-size:24px;font-weight:700;color:#111">PopsJet Admin</h1>
            <p style="color:#444;margin-top:16px"><strong>${profile.full_name || profile.email}</strong> a demandé la réinitialisation de son mot de passe.</p>
            <a href="${siteUrl}/admin/reset-requests" style="display:inline-block;margin-top:24px;padding:12px 28px;background:#2563eb;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
              Gérer les demandes
            </a>
          </div>`
        ).catch(() => {})
      }

      return NextResponse.json({ ok: true, isAdmin: false })
    }
  } catch (err) {
    console.error('forgot-password error:', err)
    return NextResponse.json({ ok: true })
  }
}

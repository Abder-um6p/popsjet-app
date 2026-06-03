import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? 'abderrahmane.haddad@um6p.ma').toLowerCase()
const OTP_VALIDITY_MS = 10 * 60 * 1000 // 10 minutes

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}

// POST /api/auth/send-otp
// Appelé depuis la page reset-password quand l'admin est détecté
export async function POST(_req: NextRequest) {
  try {
    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user || user.email?.toLowerCase() !== ADMIN_EMAIL) {
      return NextResponse.json({ error: 'Réservé à l\'administrateur' }, { status: 403 })
    }

    const adminClient = getAdminClient()
    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + OTP_VALIDITY_MS).toISOString()

    // Invalider les anciens OTP non utilisés
    await adminClient
      .from('password_reset_otps')
      .update({ used: true })
      .eq('user_id', user.id)
      .eq('used', false)

    // Créer le nouvel OTP
    const { error: insertError } = await adminClient
      .from('password_reset_otps')
      .insert({
        user_id: user.id,
        email: user.email,
        otp_code: otp,
        expires_at: expiresAt,
        attempts: 0,
        used: false,
      })

    if (insertError) {
      console.error('OTP insert error:', insertError)
      return NextResponse.json({ error: 'Erreur génération OTP' }, { status: 500 })
    }

    // Envoyer l'OTP par email
    const resendKey = process.env.RESEND_API_KEY
    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'PopsJet <onboarding@resend.dev>',
          to: [user.email],
          subject: 'Votre code de vérification — PopsJet',
          html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px 24px">
            <h1 style="font-size:24px;font-weight:700;color:#111">PopsJet</h1>
            <p style="color:#444;margin-top:16px">Votre code de vérification pour la réinitialisation de mot de passe :</p>
            <div style="margin:28px 0;padding:20px;background:#f0f4ff;border-radius:12px;text-align:center">
              <span style="font-size:36px;font-weight:800;letter-spacing:8px;color:#2563eb">${otp}</span>
            </div>
            <p style="color:#888;font-size:13px">Ce code est valable <strong>10 minutes</strong> et ne peut être utilisé qu'une seule fois.</p>
            <p style="color:#888;font-size:13px;margin-top:8px">Maximum 3 tentatives.</p>
          </div>`,
        }),
      })
    }

    return NextResponse.json({ ok: true, expiresAt })
  } catch (err) {
    console.error('send-otp error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

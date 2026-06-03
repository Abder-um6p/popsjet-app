import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'

const MAX_ATTEMPTS = 3

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// POST /api/auth/verify-otp
// body: { otp: string }
export async function POST(req: NextRequest) {
  try {
    const { otp } = await req.json()
    if (!otp) return NextResponse.json({ error: 'Code requis' }, { status: 400 })

    const supabase = await createServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const adminClient = getAdminClient()

    // Récupérer l'OTP actif pour cet utilisateur
    const { data: otpRecord } = await adminClient
      .from('password_reset_otps')
      .select('id, otp_code, expires_at, attempts, used')
      .eq('user_id', user.id)
      .eq('used', false)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (!otpRecord) {
      return NextResponse.json({ error: 'Aucun code actif. Demandez un nouveau code.' }, { status: 400 })
    }

    // Vérifier l'expiration
    if (new Date(otpRecord.expires_at) < new Date()) {
      await adminClient.from('password_reset_otps').update({ used: true }).eq('id', otpRecord.id)
      return NextResponse.json({ error: 'Code expiré. Demandez un nouveau code.' }, { status: 400 })
    }

    // Vérifier le nombre de tentatives
    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      await adminClient.from('password_reset_otps').update({ used: true }).eq('id', otpRecord.id)
      return NextResponse.json({ error: 'Trop de tentatives. Demandez un nouveau code.' }, { status: 400 })
    }

    // Incrémenter les tentatives
    await adminClient
      .from('password_reset_otps')
      .update({ attempts: otpRecord.attempts + 1 })
      .eq('id', otpRecord.id)

    // Vérifier le code
    if (otpRecord.otp_code !== otp.trim()) {
      const remaining = MAX_ATTEMPTS - (otpRecord.attempts + 1)
      return NextResponse.json({
        error: `Code incorrect. ${remaining} tentative(s) restante(s).`,
        remaining,
      }, { status: 400 })
    }

    // OTP valide — le marquer comme utilisé
    await adminClient.from('password_reset_otps').update({ used: true }).eq('id', otpRecord.id)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('verify-otp error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

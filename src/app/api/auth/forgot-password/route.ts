import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        flowType: 'implicit', // Évite le PKCE côté serveur — le lien arrive en hash sur /auth/reset-password
      },
    }
  )
}

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

    const adminClient = getAdminClient()

    // Vérifier que le compte existe et n'est pas désactivé
    const { data: profile } = await adminClient
      .from('profiles')
      .select('id, disabled_at')
      .eq('email', email.trim().toLowerCase())
      .maybeSingle()

    if (!profile || profile.disabled_at) {
      return NextResponse.json({ ok: true })
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://popsjet-app.vercel.app'

    // Implicit flow → Supabase envoie un email avec lien #access_token=...&type=recovery
    // Le client JS le traite via onAuthStateChange(PASSWORD_RECOVERY) sur /auth/reset-password
    const { error } = await adminClient.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${siteUrl}/auth/reset-password` }
    )

    if (error) console.error('resetPasswordForEmail error:', error)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('forgot-password error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

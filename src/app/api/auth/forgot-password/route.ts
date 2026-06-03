import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

    // Client avec clé ANON + flowType implicit
    // → resetPasswordForEmail envoie via le SMTP Supabase (Resend configuré)
    // → lien dans l'email est hash-based (#access_token=...) pas PKCE
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        auth: {
          flowType: 'implicit',
          autoRefreshToken: false,
          persistSession: false,
          detectSessionInUrl: false,
        },
      }
    )

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://popsjet-app.vercel.app'

    // Envoie l'email via le SMTP Supabase (Resend) configuré dans Authentication > SMTP
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${siteUrl}/auth/reset-password` }
    )

    if (error) {
      console.error('resetPasswordForEmail error:', error.message)
    } else {
      console.log('Password reset email sent to:', email.trim().toLowerCase())
    }

    // Toujours ok côté client
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('forgot-password error:', err)
    return NextResponse.json({ ok: true })
  }
}

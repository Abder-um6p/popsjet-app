import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json()
    if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

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

    // Find user by email
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email, disabled_at')
      .eq('email', email)
      .single()

    if (profileError || !profile) {
      // Don't reveal whether the email exists — always return success
      return NextResponse.json({ ok: true })
    }

    if (profile.disabled_at) {
      // Account is disabled — still don't reveal, just silently ignore
      return NextResponse.json({ ok: true })
    }

    // Check for existing pending request (avoid duplicates in last 10 min)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('password_reset_requests')
      .select('id')
      .eq('user_id', profile.id)
      .eq('status', 'pending')
      .gte('requested_at', tenMinutesAgo)
      .maybeSingle()

    if (existing) {
      // Already has a recent pending request — silently succeed
      return NextResponse.json({ ok: true })
    }

    // Create the pending reset request
    const { error: insertError } = await supabase
      .from('password_reset_requests')
      .insert({
        user_id: profile.id,
        email: profile.email,
        status: 'pending',
      })

    if (insertError) {
      console.error('Reset request insert error:', insertError)
      return NextResponse.json({ error: 'Erreur lors de la demande' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('forgot-password error:', err)
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 })
  }
}

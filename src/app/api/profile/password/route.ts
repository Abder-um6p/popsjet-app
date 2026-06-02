import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// PATCH /api/profile/password
// body: { currentPassword: string, newPassword: string }
export async function PATCH(req: NextRequest) {
  const { currentPassword, newPassword } = await req.json()

  if (!currentPassword || !newPassword) {
    return NextResponse.json({ error: 'Champs requis manquants' }, { status: 400 })
  }

  if (newPassword.length < 8) {
    return NextResponse.json({ error: 'Le mot de passe doit faire au moins 8 caractères' }, { status: 400 })
  }

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

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Verify current password by attempting sign-in
  const verifyClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error: signInError } = await verifyClient.auth.signInWithPassword({
    email: user.email!,
    password: currentPassword,
  })

  if (signInError) {
    return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 400 })
  }

  // Update password using admin client (so we don't need the user's session on the server)
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )

  const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
    password: newPassword,
  })

  if (updateError) {
    console.error('Password update error:', updateError)
    return NextResponse.json({ error: 'Erreur lors de la mise à jour du mot de passe' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

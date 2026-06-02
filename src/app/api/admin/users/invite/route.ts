import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/** Admin Supabase client with service role — full auth.admin access */
function getAdminAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: Request) {
  // Auth guard — only admin can invite
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: caller } = await supabase.from('profiles').select('role, email, full_name').eq('id', user.id).single()
  if (caller?.role !== 'admin') {
    return NextResponse.json({ error: 'Accès refusé — admin requis' }, { status: 403 })
  }

  const body = await req.json()
  const { email, role, note } = body as { email: string; role: string; note?: string }

  if (!email || !role) {
    return NextResponse.json({ error: 'Email et rôle requis' }, { status: 400 })
  }

  const validRoles = ['admin', 'directeur', 'chef_projet', 'membre']
  if (!validRoles.includes(role)) {
    return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
  }

  const adminClient = getAdminAuthClient()

  const now = new Date().toISOString()

  // Send invitation email via Supabase Auth
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://popsjet-app.vercel.app'

  const { data: invited, error: inviteError } = await adminClient.auth.admin.inviteUserByEmail(email, {
    data: { role, invited_by: user.id },
    // Après clic sur le lien → callback échange le token → redirect vers reset-password
    // L'utilisateur invité définit son mot de passe, puis est redirigé vers l'onboarding
    redirectTo: `${siteUrl}/auth/callback?next=/auth/reset-password`,
  })

  if (inviteError) {
    // If user already exists, still update their profile role
    if (inviteError.message.includes('already been registered')) {
      // Find existing user and update role
      const { data: existingUsers } = await adminClient.auth.admin.listUsers()
      const existingUser = existingUsers?.users?.find(u => u.email === email)
      if (existingUser) {
        await adminClient
          .from('profiles')
          .update({ role, invite_note: note ?? null, invited_by: user.id })
          .eq('id', existingUser.id)
        // Audit log — role update on existing user (non-bloquant)
        try {
          await adminClient.from('audit_logs').insert({
            user_id:     user.id,
            user_email:  caller?.email ?? null,
            action:      'user_role_change',
            entity_type: 'profile',
            entity_id:   existingUser.id,
            entity_name: email,
            old_data:    null,
            new_data:    { role, invited_by: user.id },
            ip_address:  null,
            user_agent:  null,
          })
        } catch { /* swallow */ }
        return NextResponse.json({ message: 'Rôle mis à jour pour utilisateur existant', updated: true })
      }
    }
    return NextResponse.json({ error: inviteError.message }, { status: 400 })
  }

  // Upsert profile with the invited role
  if (invited?.user?.id) {
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: invited.user.id,
        email: email.toLowerCase(),
        full_name: email.split('@')[0], // Placeholder until onboarding
        role,
        onboarding_completed: false,
        invited_by: user.id,
        invite_note: note ?? null,
        skills: [],
        languages: [],
      }, { onConflict: 'id' })

    if (profileError) {
      console.error('Profile upsert error:', profileError)
      // Non-blocking — invitation was sent
    }
  }

  // Audit log — new user invitation (non-bloquant)
  try {
    await adminClient.from('audit_logs').insert({
      user_id:     user.id,
      user_email:  caller?.email ?? null,
      action:      'user_invited',
      entity_type: 'profile',
      entity_id:   invited?.user?.id ?? null,
      entity_name: email,
      old_data:    null,
      new_data:    { email, role, invited_by: user.id, invited_at: now },
      ip_address:  null,
      user_agent:  null,
    })
  } catch { /* swallow */ }

  return NextResponse.json({ message: 'Invitation envoyée avec succès', userId: invited?.user?.id })
}

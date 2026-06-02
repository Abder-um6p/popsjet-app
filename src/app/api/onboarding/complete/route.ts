import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const { full_name } = await req.json()

  if (!full_name?.trim()) {
    return NextResponse.json({ error: 'Nom requis' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Check if a profile already exists for this user
  const { data: existing } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', user.id)
    .single()

  let error: { message: string } | null = null

  if (existing) {
    // Profile exists (invited user) — only update full_name + onboarding_completed
    // NEVER overwrite role: the admin may have pre-assigned a specific role during invite
    const { error: updateError } = await admin
      .from('profiles')
      .update({
        full_name: full_name.trim(),
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', user.id)
    error = updateError
  } else {
    // New profile (no invite flow) — insert with default role 'membre'
    const { error: insertError } = await admin
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email ?? '',
        full_name: full_name.trim(),
        role: 'membre',
        onboarding_completed: true,
        updated_at: new Date().toISOString(),
      })
    error = insertError
  }

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

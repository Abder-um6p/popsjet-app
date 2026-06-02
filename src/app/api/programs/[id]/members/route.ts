import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const WRITE_ROLES = ['admin', 'directeur', 'chef_projet']

// GET /api/programs/[id]/members
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('program_members')
      .select('id, role, joined_at, profile:profile_id(id, full_name, email, avatar_url)')
      .eq('program_id', id)
      .order('joined_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// POST /api/programs/[id]/members — { profile_id, role }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !WRITE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await req.json()
    const { profile_id, role = 'membre' } = body
    if (!profile_id) return NextResponse.json({ error: 'profile_id requis' }, { status: 400 })

    const { data, error } = await admin
      .from('program_members')
      .insert({ program_id: id, profile_id, role })
      .select('id, role, joined_at, profile:profile_id(id, full_name, email, avatar_url)')
      .single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Membre déjà ajouté' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// DELETE /api/programs/[id]/members?profile_id=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !WRITE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const profileId = new URL(req.url).searchParams.get('profile_id')
    if (!profileId) return NextResponse.json({ error: 'profile_id requis' }, { status: 400 })

    const { error } = await admin
      .from('program_members')
      .delete()
      .eq('program_id', id)
      .eq('profile_id', profileId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

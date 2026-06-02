import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const url   = new URL(req.url)
  const page  = parseInt(url.searchParams.get('page') ?? '1')
  const limit = 30
  const from  = (page - 1) * limit
  const to    = from + limit - 1

  // Tentative 1 : avec colonnes related_id / related_type (migration 009 appliquée)
  let { data, error, count } = await supabase
    .from('notifications')
    .select('id, type, title, message, data, is_read, created_at, related_id, related_type', { count: 'exact' })
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .range(from, to)

  // Fallback défensif : si les colonnes n'existent pas encore en DB
  if (error && /related_id|related_type|does not exist/i.test(error.message)) {
    const fallback = await supabase
      .from('notifications')
      .select('id, type, title, message, data, is_read, created_at', { count: 'exact' })
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .range(from, to)
    data  = (fallback.data ?? []).map((n: any) => ({ ...n, related_id: null, related_type: null })) as any
    count = fallback.count
    error = fallback.error
  }

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data, count, page, limit })
}

export async function PATCH(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()

  if (body.markAllRead) {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false)
    return NextResponse.json({ ok: true })
  }

  if (body.id) {
    await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', body.id)
      .eq('user_id', user.id)
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Payload invalide' }, { status: 400 })
}

export async function DELETE(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { id } = await req.json()
  if (!id) return NextResponse.json({ error: 'Identifiant manquant' }, { status: 400 })

  await supabase.from('notifications').delete().eq('id', id).eq('user_id', user.id)
  return NextResponse.json({ ok: true })
}

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!['admin', 'directeur'].includes(profile?.role ?? '')) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const admin = createAdminClient()
  const url = req.nextUrl
  const userId    = url.searchParams.get('user_id') ?? undefined
  const action    = url.searchParams.get('action') ?? undefined
  const entity    = url.searchParams.get('entity_type') ?? undefined
  const dateFrom  = url.searchParams.get('date_from') ?? undefined
  const dateTo    = url.searchParams.get('date_to') ?? undefined
  const page      = parseInt(url.searchParams.get('page') ?? '1')
  const limit     = 50

  let query = admin
    .from('audit_logs')
    .select('*, user:profiles!audit_logs_user_id_fkey(full_name, email)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page - 1) * limit, page * limit - 1)

  if (userId)   query = query.eq('user_id', userId)
  if (action)   query = query.ilike('action', `%${action}%`)
  if (entity)   query = query.eq('entity_type', entity)
  if (dateFrom) query = query.gte('created_at', dateFrom)
  if (dateTo)   query = query.lte('created_at', dateTo + 'T23:59:59Z')

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ data, count, page, limit })
}

export async function POST(req: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { action, entity_type, entity_id, entity_name, old_data, new_data } = body

  if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

  const { data: profile } = await supabase.from('profiles').select('email').eq('id', user.id).single()

  const admin = createAdminClient()
  const { data, error } = await admin.from('audit_logs').insert({
    user_id:     user.id,
    user_email:  profile?.email ?? user.email ?? '',
    action,
    entity_type: entity_type ?? null,
    entity_id:   entity_id   ?? null,
    entity_name: entity_name ?? null,
    old_data:    old_data    ?? null,
    new_data:    new_data    ?? null,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

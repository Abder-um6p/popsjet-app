import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('integration_settings')
    .select('enabled, config, options, tested_at, updated_at')
    .eq('provider', 'slack')
    .single()

  if (!data) {
    return NextResponse.json({
      enabled: false,
      config: { mode: 'webhook', webhook_url: '', bot_token: '', default_channel: '#popsjet-notifications' },
      options: { notify_project_created: true, notify_task_assigned: true, notify_member_added: true, notify_task_status: false, notify_document_upload: false, channel_projects: '', channel_tasks: '' },
      tested_at: null,
    })
  }

  // Masque le bot_token
  const config = { ...(data.config as Record<string, string>) }
  if (config.bot_token) config.bot_token = '••••••••••••••••'

  return NextResponse.json({ ...data, config })
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body = await req.json()
  const { enabled, config, options } = body

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('integration_settings').select('config').eq('provider', 'slack').single()

  const existingConfig = (existing?.config ?? {}) as Record<string, string>

  const newToken = config?.bot_token?.startsWith('•')
    ? existingConfig.bot_token
    : config?.bot_token

  const newConfig = {
    ...existingConfig,
    mode:            config?.mode            ?? existingConfig.mode ?? 'webhook',
    webhook_url:     config?.webhook_url     ?? existingConfig.webhook_url ?? '',
    bot_token:       newToken                ?? '',
    default_channel: config?.default_channel ?? existingConfig.default_channel ?? '#popsjet-notifications',
  }

  const { error } = await admin
    .from('integration_settings')
    .upsert({ provider: 'slack', enabled: enabled ?? false, config: newConfig, options: options ?? {}, updated_at: new Date().toISOString() }, { onConflict: 'provider' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

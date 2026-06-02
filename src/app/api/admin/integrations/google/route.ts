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
    .eq('provider', 'google')
    .single()

  if (!data) {
    return NextResponse.json({
      enabled: false,
      config: { service_account_email: '', service_account_private_key: '', drive_folder_id: '' },
      options: { auto_create_folder: true, auto_share_members: true, create_task_subfolder: true, generate_sharing_links: true, share_role: 'reader' },
      tested_at: null,
    })
  }

  const config = { ...(data.config as Record<string, string>) }
  if (config.service_account_private_key) {
    config.service_account_private_key = '••••••••••••••••'
  }

  return NextResponse.json({ ...data, config })
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body = await req.json()
  const { enabled, config, options } = body

  const admin = createAdminClient()
  const { data: existing } = await admin
    .from('integration_settings')
    .select('config')
    .eq('provider', 'google')
    .single()

  const existingConfig = (existing?.config ?? {}) as Record<string, string>

  const newKey = config?.service_account_private_key?.startsWith('•')
    ? existingConfig.service_account_private_key
    : config?.service_account_private_key

  const newConfig = {
    ...existingConfig,
    service_account_email:       config?.service_account_email       ?? existingConfig.service_account_email ?? '',
    service_account_private_key: newKey                              ?? '',
    drive_folder_id:             config?.drive_folder_id             ?? existingConfig.drive_folder_id ?? '',
  }

  const { error } = await admin
    .from('integration_settings')
    .upsert({ provider: 'google', enabled: enabled ?? false, config: newConfig, options: options ?? {}, updated_at: new Date().toISOString() }, { onConflict: 'provider' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}

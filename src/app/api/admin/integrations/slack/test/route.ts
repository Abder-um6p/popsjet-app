import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { testConnection } from '@/lib/integrations/slack/notifications'
import type { SlackConfig } from '@/lib/integrations/slack/index'

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return null
  return user
}

export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body = await req.json()
  let config: SlackConfig = body.config

  // Récupère le vrai bot_token si masqué
  if (config?.bot_token?.startsWith('•')) {
    const admin = createAdminClient()
    const { data } = await admin.from('integration_settings').select('config').eq('provider', 'slack').single()
    const stored = (data?.config ?? {}) as Partial<SlackConfig>
    config = { ...config, bot_token: stored.bot_token ?? '' }
  }

  if (config.mode === 'webhook' && !config.webhook_url) {
    return NextResponse.json({ ok: false, message: 'Webhook URL requise' })
  }
  if (config.mode === 'bot_token' && !config.bot_token) {
    return NextResponse.json({ ok: false, message: 'Bot Token requis' })
  }

  const result = await testConnection(config)

  if (result.ok) {
    const admin = createAdminClient()
    await admin.from('integration_settings').update({ tested_at: new Date().toISOString() }).eq('provider', 'slack')
  }

  return NextResponse.json(result)
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { testConnection } from '@/lib/integrations/google/drive'
import type { GoogleConfig } from '@/lib/integrations/google/index'

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
  let config: GoogleConfig = body.config

  if (config?.service_account_private_key?.startsWith('•')) {
    const admin = createAdminClient()
    const { data } = await admin.from('integration_settings').select('config').eq('provider', 'google').single()
    const stored = (data?.config ?? {}) as Partial<GoogleConfig>
    config = { ...config, service_account_private_key: stored.service_account_private_key ?? '' }
  }

  if (!config?.service_account_email || !config?.service_account_private_key) {
    return NextResponse.json({ ok: false, message: 'Email et clé privée du service account requis' })
  }

  const result = await testConnection(config)

  if (result.ok) {
    const admin = createAdminClient()
    await admin.from('integration_settings').update({ tested_at: new Date().toISOString() }).eq('provider', 'google')
  }

  return NextResponse.json(result)
}

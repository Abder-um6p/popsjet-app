/**
 * POST /api/admin/integrations/microsoft/test
 * Teste la connexion Microsoft Graph avec les credentials fournis.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { testConnection } from '@/lib/integrations/microsoft/sharepoint'
import type { MicrosoftConfig } from '@/lib/integrations/microsoft/index'

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
  let config: MicrosoftConfig = body.config

  // Si le secret est masqué, on récupère le vrai depuis la DB
  if (config?.client_secret?.startsWith('•')) {
    const admin = createAdminClient()
    const { data } = await admin
      .from('integration_settings')
      .select('config')
      .eq('provider', 'microsoft')
      .single()

    const stored = data?.config as Partial<MicrosoftConfig> ?? {}
    config = { ...config, client_secret: stored.client_secret ?? '' }
  }

  if (!config?.tenant_id || !config?.client_id || !config?.client_secret) {
    return NextResponse.json({
      ok: false,
      message: 'Tenant ID, Client ID et Client Secret sont requis',
    })
  }

  const result = await testConnection(config)

  // Si le test réussit, on met à jour tested_at
  if (result.ok) {
    const admin = createAdminClient()
    await admin
      .from('integration_settings')
      .update({ tested_at: new Date().toISOString() })
      .eq('provider', 'microsoft')
  }

  return NextResponse.json(result)
}

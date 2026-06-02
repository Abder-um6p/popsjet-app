/**
 * GET  /api/admin/integrations/microsoft  → récupère la config (sans le client_secret)
 * POST /api/admin/integrations/microsoft  → sauvegarde la config
 */

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

// ─── GET ──────────────────────────────────────────────────────────────────────
export async function GET() {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('integration_settings')
    .select('enabled, config, options, tested_at, updated_at')
    .eq('provider', 'microsoft')
    .single()

  if (error && error.code !== 'PGRST116') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!data) {
    return NextResponse.json({
      enabled: false,
      config: {
        tenant_id:          '',
        client_id:          '',
        client_secret:      '',
        storage_backend:    'onedrive',
        sharepoint_site_id: '',
        onedrive_user:      '',
      },
      options: {
        auto_create_folder:     true,
        auto_invite_members:    true,
        create_task_subfolder:  true,
        generate_sharing_links: true,
        link_type: 'view',
      },
      tested_at:  null,
      updated_at: null,
    })
  }

  // Ne jamais exposer le client_secret en clair
  const config = { ...(data.config as Record<string, string>) }
  if (config.client_secret) {
    config.client_secret = config.client_secret.length > 0 ? '••••••••••••••••' : ''
  }

  return NextResponse.json({ ...data, config })
}

// ─── POST ─────────────────────────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await requireAdmin()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 })

  const body = await req.json()
  const { enabled, config, options } = body

  const admin = createAdminClient()

  // Récupère la config existante pour ne pas écraser le secret si non modifié
  const { data: existing } = await admin
    .from('integration_settings')
    .select('config')
    .eq('provider', 'microsoft')
    .single()

  const existingConfig = (existing?.config ?? {}) as Record<string, string>

  // Si le client_secret envoyé est masqué (••••), on garde l'ancien
  const newSecret = config?.client_secret?.startsWith('•')
    ? existingConfig.client_secret
    : config?.client_secret

  const newConfig = {
    ...existingConfig,
    tenant_id:           config?.tenant_id           ?? existingConfig.tenant_id ?? '',
    client_id:           config?.client_id            ?? existingConfig.client_id ?? '',
    client_secret:       newSecret                    ?? '',
    storage_backend:     config?.storage_backend      ?? existingConfig.storage_backend ?? 'sharepoint',
    sharepoint_site_id:  config?.sharepoint_site_id   ?? existingConfig.sharepoint_site_id ?? '',
    onedrive_user:       config?.onedrive_user         ?? existingConfig.onedrive_user ?? '',
  }

  const { error } = await admin
    .from('integration_settings')
    .upsert(
      {
        provider: 'microsoft',
        enabled:  enabled ?? false,
        config:   newConfig,
        options:  options ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'provider' }
    )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}

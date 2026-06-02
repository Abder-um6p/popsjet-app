/**
 * Microsoft Integration — Point d'entrée
 *
 * Vérifie si le plugin Microsoft est activé et retourne la config.
 * Toutes les fonctions SharePoint/Graph vérifient ce flag avant d'agir.
 * Si désactivé → rien ne se passe, Popsjet fonctionne normalement.
 */

import { createAdminClient } from '@/lib/supabase/server'

export interface MicrosoftConfig {
  tenant_id:          string
  client_id:          string
  client_secret:      string
  storage_backend:    'sharepoint' | 'onedrive'
  sharepoint_site_id: string   // requis si storage_backend === 'sharepoint'
  onedrive_user:      string   // email/userId requis si storage_backend === 'onedrive'
}

export interface MicrosoftOptions {
  auto_create_folder: boolean
  auto_invite_members: boolean
  create_task_subfolder: boolean
  generate_sharing_links: boolean
  link_type: 'view' | 'edit'
}

export interface MicrosoftIntegration {
  enabled: boolean
  config: MicrosoftConfig
  options: MicrosoftOptions
}

const DEFAULT_OPTIONS: MicrosoftOptions = {
  auto_create_folder: true,
  auto_invite_members: true,
  create_task_subfolder: true,
  generate_sharing_links: true,
  link_type: 'view',
}

/**
 * Charge la config Microsoft depuis la DB.
 * Retourne null si l'intégration est désactivée ou non configurée.
 */
export async function getMicrosoftIntegration(): Promise<MicrosoftIntegration | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('integration_settings')
      .select('enabled, config, options')
      .eq('provider', 'microsoft')
      .single()

    if (error || !data) return null
    if (!data.enabled) return null

    const config = data.config as Partial<MicrosoftConfig>
    if (!config.tenant_id || !config.client_id || !config.client_secret) return null

    // Valeur par défaut du storage_backend si absent (anciens enregistrements)
    if (!config.storage_backend) config.storage_backend = 'sharepoint'

    return {
      enabled: true,
      config: config as MicrosoftConfig,
      options: { ...DEFAULT_OPTIONS, ...(data.options as Partial<MicrosoftOptions>) },
    }
  } catch {
    return null
  }
}

/**
 * Vérifie rapidement si Microsoft est activé (sans charger toute la config).
 */
export async function isMicrosoftEnabled(): Promise<boolean> {
  const integration = await getMicrosoftIntegration()
  return integration !== null
}

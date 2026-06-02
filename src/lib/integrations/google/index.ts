/**
 * Google Workspace Integration — Point d'entrée
 *
 * Vérifie si le plugin Google est activé et retourne la config.
 * Utilise un Service Account pour l'auth (pas d'OAuth par utilisateur).
 */

import { createAdminClient } from '@/lib/supabase/server'

export interface GoogleConfig {
  service_account_email:       string   // ex: popsjet@projet.iam.gserviceaccount.com
  service_account_private_key: string   // clé privée RSA (PEM) du service account
  drive_folder_id:             string   // ID du dossier Drive racine de l'entreprise
}

export interface GoogleOptions {
  auto_create_folder:     boolean
  auto_share_members:     boolean
  create_task_subfolder:  boolean
  generate_sharing_links: boolean
  share_role:             'reader' | 'commenter' | 'writer'
}

export interface GoogleIntegration {
  enabled: boolean
  config:  GoogleConfig
  options: GoogleOptions
}

const DEFAULT_OPTIONS: GoogleOptions = {
  auto_create_folder:     true,
  auto_share_members:     true,
  create_task_subfolder:  true,
  generate_sharing_links: true,
  share_role:             'reader',
}

export async function getGoogleIntegration(): Promise<GoogleIntegration | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('integration_settings')
      .select('enabled, config, options')
      .eq('provider', 'google')
      .single()

    if (error || !data || !data.enabled) return null

    const config = data.config as Partial<GoogleConfig>
    if (!config.service_account_email || !config.service_account_private_key) return null

    return {
      enabled: true,
      config:  config as GoogleConfig,
      options: { ...DEFAULT_OPTIONS, ...(data.options as Partial<GoogleOptions>) },
    }
  } catch {
    return null
  }
}

export async function isGoogleEnabled(): Promise<boolean> {
  const integration = await getGoogleIntegration()
  return integration !== null
}

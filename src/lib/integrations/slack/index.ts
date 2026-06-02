/**
 * Slack Integration — Point d'entrée
 *
 * Supporte deux modes d'auth :
 * - Webhook URL (simple, un canal fixe)
 * - Bot Token (plus flexible, canal configurable par type d'événement)
 */

import { createAdminClient } from '@/lib/supabase/server'

export interface SlackConfig {
  mode:            'webhook' | 'bot_token'
  webhook_url?:    string   // mode webhook
  bot_token?:      string   // mode bot (xoxb-...)
  default_channel: string   // ex: #popsjet-notifications ou C01234ABCDE
}

export interface SlackOptions {
  notify_project_created:  boolean
  notify_task_assigned:    boolean
  notify_member_added:     boolean
  notify_task_status:      boolean
  notify_document_upload:  boolean
  channel_projects?:       string   // canal spécifique projets (optionnel)
  channel_tasks?:          string   // canal spécifique tâches (optionnel)
}

export interface SlackIntegration {
  enabled: boolean
  config:  SlackConfig
  options: SlackOptions
}

const DEFAULT_OPTIONS: SlackOptions = {
  notify_project_created: true,
  notify_task_assigned:   true,
  notify_member_added:    true,
  notify_task_status:     false,
  notify_document_upload: false,
}

export async function getSlackIntegration(): Promise<SlackIntegration | null> {
  try {
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('integration_settings')
      .select('enabled, config, options')
      .eq('provider', 'slack')
      .single()

    if (error || !data || !data.enabled) return null

    const config = data.config as Partial<SlackConfig>
    if (!config.mode) return null
    if (config.mode === 'webhook' && !config.webhook_url) return null
    if (config.mode === 'bot_token' && !config.bot_token) return null

    return {
      enabled: true,
      config:  config as SlackConfig,
      options: { ...DEFAULT_OPTIONS, ...(data.options as Partial<SlackOptions>) },
    }
  } catch {
    return null
  }
}

export async function isSlackEnabled(): Promise<boolean> {
  const integration = await getSlackIntegration()
  return integration !== null
}

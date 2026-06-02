/**
 * Slack — Envoi de notifications
 *
 * Supporte Webhook URL et Bot Token.
 * Chaque événement Popsjet a son propre bloc de message formaté.
 */

import type { SlackConfig, SlackOptions } from './index'

// ─── Types d'événements ───────────────────────────────────────────────────────

export type SlackEvent =
  | { type: 'project_created';  project:  { code: string; title: string; type: string }; creator: string }
  | { type: 'task_assigned';    task:     { title: string; priority: string }; assignee: string; project: string }
  | { type: 'member_added';     member:   string; project: string; role: string }
  | { type: 'task_status';      task:     { title: string }; status: string; updatedBy: string; project: string }
  | { type: 'document_upload';  document: { name: string }; uploadedBy: string; project: string }

// ─── Couleurs par type ────────────────────────────────────────────────────────

const COLORS: Record<string, string> = {
  project_created:  '#0078d4',   // bleu Microsoft-like
  task_assigned:    '#7c3aed',   // violet
  member_added:     '#059669',   // vert
  task_status:      '#d97706',   // orange
  document_upload:  '#6b7280',   // gris
}

const PRIORITY_EMOJI: Record<string, string> = {
  low: '🔵', medium: '🟡', high: '🟠', urgent: '🔴',
}

// ─── Formatage des messages ───────────────────────────────────────────────────

function buildMessage(event: SlackEvent): object {
  switch (event.type) {
    case 'project_created':
      return {
        text: `🚀 Nouveau projet créé : *${event.project.title}*`,
        attachments: [{
          color: COLORS.project_created,
          fields: [
            { title: 'Code',   value: event.project.code,  short: true },
            { title: 'Type',   value: event.project.type,  short: true },
            { title: 'Créé par', value: event.creator,     short: true },
          ],
        }],
      }

    case 'task_assigned':
      return {
        text: `${PRIORITY_EMOJI[event.task.priority] ?? '⚪'} Tâche assignée : *${event.task.title}*`,
        attachments: [{
          color: COLORS.task_assigned,
          fields: [
            { title: 'Assigné à', value: event.assignee,    short: true },
            { title: 'Projet',    value: event.project,     short: true },
            { title: 'Priorité', value: event.task.priority, short: true },
          ],
        }],
      }

    case 'member_added':
      return {
        text: `👤 *${event.member}* a rejoint le projet *${event.project}*`,
        attachments: [{
          color: COLORS.member_added,
          fields: [
            { title: 'Rôle', value: event.role, short: true },
          ],
        }],
      }

    case 'task_status':
      return {
        text: `🔄 Statut mis à jour : *${event.task.title}* → \`${event.status}\``,
        attachments: [{
          color: COLORS.task_status,
          fields: [
            { title: 'Projet',    value: event.project,    short: true },
            { title: 'Mis à jour par', value: event.updatedBy, short: true },
          ],
        }],
      }

    case 'document_upload':
      return {
        text: `📄 Nouveau document : *${event.document.name}*`,
        attachments: [{
          color: COLORS.document_upload,
          fields: [
            { title: 'Projet',    value: event.project,     short: true },
            { title: 'Uploadé par', value: event.uploadedBy, short: true },
          ],
        }],
      }
  }
}

// ─── Envoi ─────────────────────────────────────────────────────────────────

/**
 * Envoie un message Slack via Webhook URL ou Bot Token.
 */
async function sendMessage(
  config:  SlackConfig,
  channel: string,
  payload: object
): Promise<boolean> {
  try {
    if (config.mode === 'webhook' && config.webhook_url) {
      // Webhook : POST direct, pas de channel dans le body
      const res = await fetch(config.webhook_url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      })
      return res.ok
    }

    if (config.mode === 'bot_token' && config.bot_token) {
      // Bot Token : API chat.postMessage
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method:  'POST',
        headers: {
          'Content-Type':  'application/json',
          Authorization:   `Bearer ${config.bot_token}`,
        },
        body: JSON.stringify({ channel, ...payload }),
      })
      const data = await res.json()
      return data.ok === true
    }

    return false
  } catch (err) {
    console.error('[Slack] sendMessage error:', err)
    return false
  }
}

/**
 * Envoie un événement Popsjet vers Slack.
 * Choisit le bon canal selon le type d'événement et les options.
 */
export async function notifySlack(
  config:  SlackConfig,
  options: SlackOptions,
  event:   SlackEvent
): Promise<boolean> {
  // Vérifie que la notification est activée
  const enabled: Record<string, boolean> = {
    project_created:  options.notify_project_created,
    task_assigned:    options.notify_task_assigned,
    member_added:     options.notify_member_added,
    task_status:      options.notify_task_status,
    document_upload:  options.notify_document_upload,
  }
  if (!enabled[event.type]) return false

  // Détermine le canal
  let channel = config.default_channel
  if (['project_created', 'member_added'].includes(event.type) && options.channel_projects) {
    channel = options.channel_projects
  }
  if (['task_assigned', 'task_status'].includes(event.type) && options.channel_tasks) {
    channel = options.channel_tasks
  }

  const payload = buildMessage(event)
  return sendMessage(config, channel, payload)
}

/**
 * Teste la connexion Slack en envoyant un message de test.
 */
export async function testConnection(
  config: SlackConfig
): Promise<{ ok: boolean; message: string }> {
  try {
    const testPayload = {
      text: '✅ *Connexion Popsjet × Slack opérationnelle* — Les notifications sont actives.',
    }

    const channel = config.default_channel || '#general'
    const ok = await sendMessage(config, channel, testPayload)

    return ok
      ? { ok: true,  message: `Message de test envoyé sur ${channel}` }
      : { ok: false, message: 'Échec de l\'envoi — vérifiez votre Webhook URL ou Bot Token' }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: msg }
  }
}

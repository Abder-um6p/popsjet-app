/**
 * Microsoft Graph API — Client HTTP
 *
 * Gère :
 * - Authentification OAuth2 (client credentials flow)
 * - Cache du token en mémoire (expire avant la vraie expiration)
 * - Appels Graph API génériques (get, post, put, delete)
 */

import type { MicrosoftConfig } from './index'

// ─── Cache token en mémoire ───────────────────────────────────────────────────
interface TokenCache {
  access_token: string
  expires_at: number   // timestamp ms
}

const tokenCache = new Map<string, TokenCache>()

/**
 * Obtient un access token Microsoft via client_credentials.
 * Utilise le cache si le token est encore valide (marge de 5 min).
 */
export async function getAccessToken(config: MicrosoftConfig): Promise<string> {
  const cacheKey = `${config.tenant_id}:${config.client_id}`
  const cached = tokenCache.get(cacheKey)

  // Retourne le token en cache s'il est encore valide
  if (cached && Date.now() < cached.expires_at - 5 * 60 * 1000) {
    return cached.access_token
  }

  const url = `https://login.microsoftonline.com/${config.tenant_id}/oauth2/v2.0/token`

  const body = new URLSearchParams({
    grant_type:    'client_credentials',
    client_id:     config.client_id,
    client_secret: config.client_secret,
    scope:         'https://graph.microsoft.com/.default',
  })

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    body.toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[Microsoft Auth] Token error: ${res.status} — ${err}`)
  }

  const data = await res.json()

  tokenCache.set(cacheKey, {
    access_token: data.access_token,
    expires_at:   Date.now() + (data.expires_in ?? 3600) * 1000,
  })

  return data.access_token
}

// ─── Client Graph API ─────────────────────────────────────────────────────────

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

async function graphRequest<T = unknown>(
  config: MicrosoftConfig,
  method: string,
  path: string,
  body?: unknown,
  contentType = 'application/json'
): Promise<T> {
  const token = await getAccessToken(config)

  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': contentType,
  }

  const res = await fetch(`${GRAPH_BASE}${path}`, {
    method,
    headers,
    body: body ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[Graph API] ${method} ${path} → ${res.status}: ${err}`)
  }

  // 204 No Content
  if (res.status === 204) return {} as T

  return res.json()
}

export const graph = {
  get:    <T>(config: MicrosoftConfig, path: string) =>
            graphRequest<T>(config, 'GET', path),

  post:   <T>(config: MicrosoftConfig, path: string, body: unknown) =>
            graphRequest<T>(config, 'POST', path, body),

  put:    <T>(config: MicrosoftConfig, path: string, body: unknown, contentType?: string) =>
            graphRequest<T>(config, 'PUT', path, body, contentType),

  patch:  <T>(config: MicrosoftConfig, path: string, body: unknown) =>
            graphRequest<T>(config, 'PATCH', path, body),

  delete: <T>(config: MicrosoftConfig, path: string) =>
            graphRequest<T>(config, 'DELETE', path),
}

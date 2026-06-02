/**
 * Google Drive API — Helpers métier
 *
 * Auth : Service Account via JWT (pas de dépendance externe — implémentation native).
 * Fonctions : createFolder, uploadFile, shareWithUser, revokeAccess,
 *             generateSharingLink, testConnection.
 */

import type { GoogleConfig, GoogleOptions } from './index'

// ─── JWT / Token ──────────────────────────────────────────────────────────────

interface TokenCache {
  access_token: string
  expires_at:   number
}

const tokenCache = new Map<string, TokenCache>()

/**
 * Génère un JWT signé pour le Service Account et l'échange contre un access token.
 * Implémentation native — pas besoin de googleapis ou google-auth-library.
 */
async function getServiceAccountToken(config: GoogleConfig): Promise<string> {
  const cacheKey = config.service_account_email
  const cached   = tokenCache.get(cacheKey)
  if (cached && Date.now() < cached.expires_at - 5 * 60 * 1000) return cached.access_token

  // ── Construit le JWT ──
  const now = Math.floor(Date.now() / 1000)
  const header  = { alg: 'RS256', typ: 'JWT' }
  const payload = {
    iss:   config.service_account_email,
    scope: 'https://www.googleapis.com/auth/drive',
    aud:   'https://oauth2.googleapis.com/token',
    iat:   now,
    exp:   now + 3600,
  }

  const encode = (obj: object) =>
    Buffer.from(JSON.stringify(obj)).toString('base64url')

  const headerB64  = encode(header)
  const payloadB64 = encode(payload)
  const sigInput   = `${headerB64}.${payloadB64}`

  // Importe la clé privée PEM via WebCrypto (disponible dans Node 18+)
  // Gère les \n littéraux (format JSON) et les vraies newlines (format PEM collé)
  const pemContents = config.service_account_private_key
    .replace(/\\n/g, '\n')
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s/g, '')

  const keyBuffer = Buffer.from(pemContents, 'base64')

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBuffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    Buffer.from(sigInput)
  )

  const jwt = `${sigInput}.${Buffer.from(signature).toString('base64url')}`

  // ── Échange le JWT contre un access token ──
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion:  jwt,
    }).toString(),
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[Google Auth] Token error: ${res.status} — ${err}`)
  }

  const data = await res.json()
  tokenCache.set(cacheKey, {
    access_token: data.access_token,
    expires_at:   Date.now() + (data.expires_in ?? 3600) * 1000,
  })

  return data.access_token
}

// ─── Client Drive ─────────────────────────────────────────────────────────────

const DRIVE_BASE = 'https://www.googleapis.com/drive/v3'

async function driveRequest<T>(
  config:      GoogleConfig,
  method:      string,
  path:        string,
  body?:       unknown,
  contentType = 'application/json'
): Promise<T> {
  const token = await getServiceAccountToken(config)
  const res   = await fetch(`${DRIVE_BASE}${path}`, {
    method,
    headers: {
      Authorization:  `Bearer ${token}`,
      'Content-Type': contentType,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.text()
    throw new Error(`[Google Drive] ${method} ${path} → ${res.status}: ${err}`)
  }

  if (res.status === 204) return {} as T
  return res.json()
}

// ─── API publique ─────────────────────────────────────────────────────────────

interface DriveFile {
  id:      string
  name:    string
  webViewLink: string
}

/**
 * Crée un dossier dans le Drive.
 * parentId : ID du dossier parent (dossier racine entreprise par défaut).
 */
async function createFolder(
  config:   GoogleConfig,
  name:     string,
  parentId: string
): Promise<DriveFile> {
  return driveRequest<DriveFile>(config, 'POST', '/files?fields=id,name,webViewLink', {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents:  [parentId],
  })
}

/**
 * Crée le dossier d'un programme et son sous-dossier Documents/ :
 * {Racine Drive}/
 *   {Program name}/
 *     Documents/
 */
export async function createProgramFolder(
  config:  GoogleConfig,
  program: { id: string; name: string }
): Promise<{ folderId: string; folderUrl: string } | null> {
  try {
    const rootId = config.drive_folder_id || 'root'

    // Crée le dossier programme (ou le retrouve s'il existe)
    const programFolder = await createFolder(config, program.name.slice(0, 100), rootId)
      .catch(async () => {
        const res = await driveRequest<{ files: DriveFile[] }>(
          config, 'GET',
          `/files?q=name='${program.name.replace(/'/g, "\\'")}' and '${rootId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name,webViewLink)`
        )
        return res.files?.[0] ?? await createFolder(config, program.name.slice(0, 100), rootId)
      })

    // Crée le sous-dossier Documents/ pour les docs de référence du programme
    await createFolder(config, 'Documents', programFolder.id).catch(() => {})

    return { folderId: programFolder.id, folderUrl: programFolder.webViewLink }
  } catch (err) {
    console.error('[Google Drive] createProgramFolder error:', err)
    return null
  }
}

/**
 * Crée la structure complète pour un projet :
 * {Programme}/            ← parent = dossier programme si connu
 *   {Nom Projet}/
 *     Documents/
 *     Tâches/
 *     Formulaires/
 *
 * Si programFolderId est fourni, le projet est créé dans le dossier programme.
 * Sinon, il est créé à la racine Drive configurée.
 */
export async function createProjectFolder(
  config:          GoogleConfig,
  options:         GoogleOptions,
  project:         { id: string; code: string; title: string },
  programFolderId?: string
): Promise<{ folderId: string; folderUrl: string; viewLink: string | null } | null> {
  try {
    // Parent : dossier programme si fourni, sinon racine Drive
    const parentId = programFolderId ?? config.drive_folder_id ?? 'root'

    // Crée le dossier du projet
    const folderName    = `${project.code} — ${project.title}`.slice(0, 100)
    const projectFolder = await createFolder(config, folderName, parentId)

    // Crée les sous-dossiers
    await Promise.all([
      createFolder(config, 'Documents',   projectFolder.id),
      createFolder(config, 'Tâches',      projectFolder.id),
      createFolder(config, 'Formulaires', projectFolder.id),
    ])

    // Lien de partage web
    const viewLink = options.generate_sharing_links ? projectFolder.webViewLink : null

    return {
      folderId:  projectFolder.id,
      folderUrl: projectFolder.webViewLink,
      viewLink,
    }
  } catch (err) {
    console.error('[Google Drive] createProjectFolder error:', err)
    return null
  }
}

/**
 * Crée un sous-dossier tâche dans Tâches/ du projet.
 */
export async function createTaskFolder(
  config:          GoogleConfig,
  task:            { id: string; title: string },
  projectFolderId: string
): Promise<{ folderId: string; folderUrl: string } | null> {
  try {
    // Retrouve le sous-dossier Tâches/
    const res = await driveRequest<{ files: DriveFile[] }>(
      config, 'GET',
      `/files?q=name='Tâches' and '${projectFolderId}' in parents and trashed=false&fields=files(id,name)`
    )
    const tasksFolderId = res.files?.[0]?.id
    if (!tasksFolderId) return null

    const folderName  = `${task.id.slice(0, 8)} — ${task.title}`.slice(0, 100)
    const taskFolder  = await createFolder(config, folderName, tasksFolderId)

    return { folderId: taskFolder.id, folderUrl: taskFolder.webViewLink }
  } catch (err) {
    console.error('[Google Drive] createTaskFolder error:', err)
    return null
  }
}

/**
 * Partage un fichier/dossier avec un utilisateur (reader, commenter, writer).
 */
export async function shareWithUser(
  config:   GoogleConfig,
  fileId:   string,
  email:    string,
  role:     'reader' | 'commenter' | 'writer' = 'reader',
  sendNotification = true
): Promise<boolean> {
  try {
    await driveRequest(
      config, 'POST',
      `/files/${fileId}/permissions?sendNotificationEmail=${sendNotification}&fields=id`,
      { type: 'user', role, emailAddress: email }
    )
    return true
  } catch (err) {
    console.error('[Google Drive] shareWithUser error:', err)
    return false
  }
}

/**
 * Révoque l'accès d'un utilisateur sur un fichier/dossier.
 */
export async function revokeAccess(
  config: GoogleConfig,
  fileId: string,
  email:  string
): Promise<boolean> {
  try {
    // Liste les permissions
    const res = await driveRequest<{ permissions: Array<{ id: string; emailAddress?: string }> }>(
      config, 'GET',
      `/files/${fileId}/permissions?fields=permissions(id,emailAddress)`
    )

    const perm = res.permissions?.find(p => p.emailAddress?.toLowerCase() === email.toLowerCase())
    if (!perm) return true

    await driveRequest(config, 'DELETE', `/files/${fileId}/permissions/${perm.id}`)
    return true
  } catch (err) {
    console.error('[Google Drive] revokeAccess error:', err)
    return false
  }
}

/**
 * Upload un fichier dans un dossier Drive (multipart upload).
 * Retourne { fileId, fileUrl } ou null en cas d'erreur.
 */
export async function uploadFile(
  config:   GoogleConfig,
  folderId: string,
  buffer:   Uint8Array | Buffer,
  fileName: string,
  mimeType: string
): Promise<{ fileId: string; fileUrl: string } | null> {
  try {
    const token = await getServiceAccountToken(config)
    const UPLOAD_BASE = 'https://www.googleapis.com/upload/drive/v3'

    // Métadonnées du fichier
    const metadata = JSON.stringify({ name: fileName, parents: [folderId] })

    // Construction du body multipart
    const boundary = `-------popsjet_boundary_${Date.now()}`
    const delimiter = `\r\n--${boundary}\r\n`
    const closeDelimiter = `\r\n--${boundary}--`

    const metaPart = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${metadata}`
    const dataPart = `${delimiter}Content-Type: ${mimeType}\r\n\r\n`
    const closePart = closeDelimiter

    // Encode en Uint8Array
    const enc = new TextEncoder()
    const metaBytes  = enc.encode(metaPart)
    const dataPrefix = enc.encode(dataPart)
    const closeBytes = enc.encode(closePart)

    const totalLength = metaBytes.length + dataPrefix.length + buffer.length + closeBytes.length
    const body = new Uint8Array(totalLength)
    let offset = 0
    body.set(metaBytes, offset);  offset += metaBytes.length
    body.set(dataPrefix, offset); offset += dataPrefix.length
    body.set(buffer, offset);     offset += buffer.length
    body.set(closeBytes, offset)

    const res = await fetch(`${UPLOAD_BASE}/files?uploadType=multipart&fields=id,webViewLink`, {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary="${boundary}"`,
        'Content-Length': String(totalLength),
      },
      body,
    })

    if (!res.ok) {
      const err = await res.text()
      console.error(`[Google Drive] uploadFile → ${res.status}: ${err}`)
      return null
    }

    const data = await res.json() as { id: string; webViewLink: string }
    return { fileId: data.id, fileUrl: data.webViewLink }
  } catch (err) {
    console.error('[Google Drive] uploadFile error:', err)
    return null
  }
}

/**
 * Teste la connexion Drive en listant les fichiers du dossier racine.
 */
export async function testConnection(
  config: GoogleConfig
): Promise<{ ok: boolean; message: string }> {
  try {
    const rootId = config.drive_folder_id || 'root'
    const res = await driveRequest<{ files: DriveFile[] }>(
      config, 'GET',
      `/files?q='${rootId}' in parents and trashed=false&fields=files(id,name)&pageSize=5`
    )
    const count = res.files?.length ?? 0
    return { ok: true, message: `Connexion réussie — ${count} fichier(s) dans le dossier racine` }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: msg }
  }
}

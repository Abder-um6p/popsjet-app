/**
 * SharePoint / OneDrive — Helpers métier
 *
 * Fonctions de haut niveau pour Popsjet :
 * - Créer la structure de dossiers d'un projet
 * - Créer le sous-dossier d'une tâche
 * - Uploader un fichier
 * - Générer un lien de partage (view/edit)
 * - Inviter / révoquer l'accès d'un membre
 */

import { graph } from './graph'
import type { MicrosoftConfig, MicrosoftOptions } from './index'

// ─── Types internes ───────────────────────────────────────────────────────────

interface DriveItem {
  id:                string
  name:              string
  webUrl:            string
  '@microsoft.graph.downloadUrl'?: string
}

interface SharingLink {
  id:  string
  link: { webUrl: string; type: string; scope: string }
}

interface DriveItemWithLink {
  itemId:   string
  itemName: string
  webUrl:   string
  viewLink: string | null
  editLink: string | null
}

// ─── Helpers internes ─────────────────────────────────────────────────────────

/**
 * Retourne le préfixe drive selon le backend configuré.
 * - SharePoint : /sites/{siteId}/drive
 * - OneDrive   : /users/{email}/drive
 */
function drivePrefix(config: MicrosoftConfig) {
  if (config.storage_backend === 'onedrive') {
    return `/users/${config.onedrive_user}/drive`
  }
  return `/sites/${config.sharepoint_site_id}/drive`
}

/** Crée un dossier dans un dossier parent (par ID) */
async function createFolder(
  config: MicrosoftConfig,
  parentId: string,
  folderName: string
): Promise<DriveItem> {
  return graph.post<DriveItem>(config, `${drivePrefix(config)}/items/${parentId}/children`, {
    name:   folderName,
    folder: {},
    '@microsoft.graph.conflictBehavior': 'rename',
  })
}

/** Retourne l'ID du dossier racine du drive */
async function getRootId(config: MicrosoftConfig): Promise<string> {
  const root = await graph.get<DriveItem>(config, `${drivePrefix(config)}/root`)
  return root.id
}

/** Crée ou retrouve un dossier par chemin (ex: "Popsjet/Projets") */
async function ensureFolderPath(
  config: MicrosoftConfig,
  path: string
): Promise<DriveItem> {
  return graph.get<DriveItem>(
    config,
    `${drivePrefix(config)}/root:/${encodeURIComponent(path)}`
  ).catch(async () => {
    // Le dossier n'existe pas → le créer niveau par niveau
    const parts = path.split('/')
    let currentId = await getRootId(config)
    let current: DriveItem | null = null

    for (const part of parts) {
      current = await createFolder(config, currentId, part)
      currentId = current.id
    }
    return current!
  })
}

/** Génère un lien de partage pour un item */
async function createSharingLink(
  config: MicrosoftConfig,
  itemId: string,
  type: 'view' | 'edit',
  scope: 'anonymous' | 'organization' = 'organization'
): Promise<string | null> {
  try {
    const result = await graph.post<SharingLink>(
      config,
      `${drivePrefix(config)}/items/${itemId}/createLink`,
      { type, scope }
    )
    return result.link?.webUrl ?? null
  } catch {
    return null
  }
}

// ─── API publique ─────────────────────────────────────────────────────────────

/**
 * Crée le dossier d'un programme et son sous-dossier Documents/ :
 * {Racine Drive}/
 *   {Program name}/
 *     Documents/
 */
export async function createProgramFolder(
  config:  MicrosoftConfig,
  program: { id: string; name: string }
): Promise<{ folderId: string; folderUrl: string } | null> {
  try {
    const root          = await getRootId(config)
    const programFolder = await createFolder(config, root, program.name.slice(0, 100))

    // Crée le sous-dossier Documents/ pour les docs de référence du programme
    await createFolder(config, programFolder.id, 'Documents').catch(() => {})

    return { folderId: programFolder.id, folderUrl: programFolder.webUrl }
  } catch (err) {
    console.error('[SharePoint] createProgramFolder error:', err)
    return null
  }
}

/**
 * Crée la structure de dossiers complète pour un projet :
 * {Programme}/          ← parent = dossier programme si fourni
 *   {code} — {title}/
 *     Documents/
 *     Tâches/
 *     Formulaires/
 *
 * Si programFolderId est fourni, le projet est créé dans le dossier programme.
 * Sinon, il est créé à la racine du drive.
 */
export async function createProjectFolder(
  config:          MicrosoftConfig,
  options:         MicrosoftOptions,
  project:         { id: string; code: string; title: string },
  programFolderId?: string
): Promise<{ folderId: string; folderUrl: string; viewLink: string | null } | null> {
  try {
    const folderName = `${project.code} — ${project.title}`.slice(0, 100)

    // Parent : dossier programme si fourni, sinon racine
    const parentId = programFolderId ?? await getRootId(config)

    // Crée le dossier projet
    const projectFolder = await createFolder(config, parentId, folderName)

    // Crée les sous-dossiers
    await Promise.all([
      createFolder(config, projectFolder.id, 'Documents'),
      createFolder(config, projectFolder.id, 'Tâches'),
      createFolder(config, projectFolder.id, 'Formulaires'),
    ])

    // Génère le lien de partage
    const viewLink = options.generate_sharing_links
      ? await createSharingLink(config, projectFolder.id, options.link_type)
      : null

    return {
      folderId:  projectFolder.id,
      folderUrl: projectFolder.webUrl,
      viewLink,
    }
  } catch (err) {
    console.error('[SharePoint] createProjectFolder error:', err)
    return null
  }
}

/**
 * Crée un sous-dossier pour une tâche dans le dossier Tâches/ du projet.
 */
export async function createTaskFolder(
  config: MicrosoftConfig,
  options: MicrosoftOptions,
  task: { id: string; title: string },
  projectFolderId: string
): Promise<{ folderId: string; folderUrl: string } | null> {
  try {
    // Retrouve le dossier Tâches/ sous le projet
    const tasksFolderPath = `${drivePrefix(config)}/items/${projectFolderId}/children`
    const children = await graph.get<{ value: DriveItem[] }>(config, tasksFolderPath)
    const tasksFolder = children.value?.find(c => c.name === 'Tâches')

    if (!tasksFolder) {
      console.warn('[SharePoint] Dossier Tâches/ introuvable')
      return null
    }

    const folderName = `${task.id.slice(0, 8)} — ${task.title}`.slice(0, 100)
    const taskFolder = await createFolder(config, tasksFolder.id, folderName)

    return {
      folderId:  taskFolder.id,
      folderUrl: taskFolder.webUrl,
    }
  } catch (err) {
    console.error('[SharePoint] createTaskFolder error:', err)
    return null
  }
}

/**
 * Upload un fichier sur SharePoint (< 4MB).
 * Pour les fichiers plus grands, utiliser uploadLargeFile.
 */
export async function uploadFile(
  config: MicrosoftConfig,
  options: MicrosoftOptions,
  folderId: string,
  fileName: string,
  fileContent: ArrayBuffer,
  mimeType: string
): Promise<DriveItemWithLink | null> {
  try {
    const item = await graph.put<DriveItem>(
      config,
      `${drivePrefix(config)}/items/${folderId}:/${encodeURIComponent(fileName)}:/content`,
      fileContent,
      mimeType
    )

    const viewLink = options.generate_sharing_links
      ? await createSharingLink(config, item.id, 'view')
      : null

    const editLink = options.generate_sharing_links && options.link_type === 'edit'
      ? await createSharingLink(config, item.id, 'edit')
      : null

    return {
      itemId:   item.id,
      itemName: item.name,
      webUrl:   item.webUrl,
      viewLink,
      editLink,
    }
  } catch (err) {
    console.error('[SharePoint] uploadFile error:', err)
    return null
  }
}

/**
 * Invite un utilisateur sur un dossier/fichier SharePoint.
 * Envoie automatiquement un email Microsoft avec le message fourni.
 */
export async function inviteMember(
  config: MicrosoftConfig,
  itemId: string,
  email: string,
  role: 'read' | 'write' = 'read',
  message?: string
): Promise<boolean> {
  try {
    await graph.post(
      config,
      `${drivePrefix(config)}/items/${itemId}/invite`,
      {
        recipients:       [{ email }],
        roles:            [role],
        sendInvitation:   true,
        requireSignIn:    true,
        message:          message ?? 'Vous avez été ajouté à un projet sur Popsjet.',
      }
    )
    return true
  } catch (err) {
    console.error('[SharePoint] inviteMember error:', err)
    return false
  }
}

/**
 * Révoque l'accès d'un utilisateur sur un item SharePoint.
 */
export async function revokeMemberAccess(
  config: MicrosoftConfig,
  itemId: string,
  email: string
): Promise<boolean> {
  try {
    // Liste les permissions de l'item
    const perms = await graph.get<{ value: Array<{ id: string; grantedToV2?: { user?: { email?: string } } }> }>(
      config,
      `${drivePrefix(config)}/items/${itemId}/permissions`
    )

    // Trouve la permission qui correspond à l'email
    const perm = perms.value?.find(p =>
      p.grantedToV2?.user?.email?.toLowerCase() === email.toLowerCase()
    )

    if (!perm) return true // Déjà révoqué

    await graph.delete(
      config,
      `${drivePrefix(config)}/items/${itemId}/permissions/${perm.id}`
    )
    return true
  } catch (err) {
    console.error('[SharePoint] revokeMemberAccess error:', err)
    return false
  }
}

/**
 * Teste la connexion à Microsoft Graph en listant les drives du site.
 * Retourne true si OK, false + message d'erreur si KO.
 */
export async function testConnection(
  config: MicrosoftConfig
): Promise<{ ok: boolean; message: string }> {
  try {
    if (config.storage_backend === 'onedrive') {
      // Test OneDrive — vérifie l'accès au drive de l'utilisateur
      const drive = await graph.get<{ id: string; driveType: string; owner?: { user?: { displayName?: string } } }>(
        config,
        `/users/${config.onedrive_user}/drive`
      )
      const owner = drive.owner?.user?.displayName ?? config.onedrive_user
      return { ok: true, message: `Connexion réussie — OneDrive de ${owner}` }
    } else {
      // Test SharePoint — liste les drives du site
      const drives = await graph.get<{ value: unknown[] }>(
        config,
        `/sites/${config.sharepoint_site_id}/drives`
      )
      const count = drives.value?.length ?? 0
      return { ok: true, message: `Connexion réussie — ${count} drive(s) SharePoint détecté(s)` }
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, message: msg }
  }
}

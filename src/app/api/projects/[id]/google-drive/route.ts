/**
 * POST /api/projects/[id]/google-drive
 * Crée le dossier Google Drive du projet + partage avec les membres.
 * Fire & forget depuis NewProjectForm.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getGoogleIntegration } from '@/lib/integrations/google/index'
import { createProjectFolder, shareWithUser } from '@/lib/integrations/google/drive'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const google = await getGoogleIntegration()
  if (!google || !google.options.auto_create_folder) {
    return NextResponse.json({ skipped: true })
  }

  const admin = createAdminClient()
  const { data: project } = await admin
    .from('projects')
    .select('id, code, title, program_id, sharepoint_folder_id')
    .eq('id', id)
    .single()

  if (!project) return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })

  // Récupère le dossier Drive du programme parent (si existant)
  let programFolderId: string | undefined
  if (project.program_id) {
    const { data: program } = await admin
      .from('programs')
      .select('google_folder_id')
      .eq('id', project.program_id)
      .single()
    programFolderId = program?.google_folder_id ?? undefined
  }

  const result = await createProjectFolder(
    google.config,
    google.options,
    { id: project.id, code: project.code, title: project.title },
    programFolderId
  )

  if (!result) return NextResponse.json({ error: 'Échec création dossier Drive' }, { status: 500 })

  // Stocke l'ID et l'URL du dossier Drive dans la table projects
  await admin
    .from('projects')
    .update({
      google_folder_id:  result.folderId,
      google_folder_url: result.folderUrl,
    })
    .eq('id', id)

  console.log(`[Google Drive] Projet ${id} → dossier créé: ${result.folderId}`)

  if (google.options.auto_share_members) {
    const { data: members } = await admin
      .from('project_members').select('profile_id, role').eq('project_id', id)

    const profileIds = (members ?? []).map(m => m.profile_id).filter(Boolean)
    if (profileIds.length) {
      const { data: profiles } = await admin
        .from('profiles').select('id, email').in('id', profileIds)

      await Promise.allSettled(
        (profiles ?? []).map(p => {
          const memberRole = members?.find(m => m.profile_id === p.id)
          const driveRole = memberRole?.role === 'responsible'
            ? google.options.share_role === 'reader' ? 'commenter' : google.options.share_role
            : google.options.share_role
          return shareWithUser(google.config, result.folderId, p.email, driveRole, true)
        })
      )
    }
  }

  return NextResponse.json({ ok: true, folderId: result.folderId, folderUrl: result.folderUrl })
}

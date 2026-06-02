/**
 * POST /api/tasks/[id]/google-drive
 * Crée le sous-dossier Google Drive de la tâche dans Tâches/ du projet.
 * Fire & forget depuis la route PATCH /api/tasks/[id] après assignation.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getGoogleIntegration } from '@/lib/integrations/google/index'
import { createTaskFolder, shareWithUser } from '@/lib/integrations/google/drive'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const google = await getGoogleIntegration()
  if (!google || !google.options.create_task_subfolder) {
    return NextResponse.json({ skipped: true })
  }

  const admin = createAdminClient()

  // Récupère la tâche avec son projet
  const { data: task } = await admin
    .from('tasks')
    .select('id, title, assigned_to, project_id')
    .eq('id', id)
    .single()

  if (!task) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })

  // Récupère le google_folder_id du projet (dossier parent)
  const { data: project } = await admin
    .from('projects')
    .select('google_folder_id, title')
    .eq('id', task.project_id)
    .single()

  if (!project?.google_folder_id) {
    return NextResponse.json({ skipped: true, reason: 'Projet sans dossier Drive' })
  }

  const result = await createTaskFolder(
    google.config,
    { id: task.id, title: task.title },
    project.google_folder_id
  )

  if (!result) return NextResponse.json({ error: 'Échec création dossier tâche' }, { status: 500 })

  // Partage avec l'assigné si option activée
  if (google.options.auto_share_members && task.assigned_to) {
    const { data: assigneeProfile } = await admin
      .from('profiles')
      .select('email')
      .eq('id', task.assigned_to)
      .single()

    if (assigneeProfile?.email) {
      await shareWithUser(google.config, result.folderId, assigneeProfile.email, google.options.share_role, true)
        .catch(() => {})
    }
  }

  console.log(`[Google Drive] Tâche ${id} → dossier créé: ${result.folderId}`)

  return NextResponse.json({ ok: true, folderId: result.folderId, folderUrl: result.folderUrl })
}

/**
 * POST /api/projects/[id]/sharepoint
 *
 * Déclenche la création du dossier SharePoint pour un projet existant.
 * Appelé en arrière-plan (fire & forget) depuis le formulaire de création de projet.
 * Si Microsoft est désactivé → 200 sans action.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getMicrosoftIntegration } from '@/lib/integrations/microsoft/index'
import { createProjectFolder, inviteMember } from '@/lib/integrations/microsoft/sharepoint'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // ── Plugin actif ? ────────────────────────────────────────────────────────
  const ms = await getMicrosoftIntegration()
  if (!ms || !ms.options.auto_create_folder) {
    return NextResponse.json({ skipped: true, reason: 'Microsoft integration disabled' })
  }

  const admin = createAdminClient()

  // ── Récupère le projet ────────────────────────────────────────────────────
  const { data: project, error: projectError } = await admin
    .from('projects')
    .select('id, code, title, program_id, sharepoint_folder_id')
    .eq('id', id)
    .single()

  if (projectError || !project) {
    return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })
  }

  // Déjà traité
  if (project.sharepoint_folder_id) {
    return NextResponse.json({ skipped: true, reason: 'Folder already created' })
  }

  // Récupère le dossier SharePoint du programme parent (si existant)
  let programFolderId: string | undefined
  if (project.program_id) {
    const { data: program } = await admin
      .from('programs')
      .select('sharepoint_folder_id')
      .eq('id', project.program_id)
      .single()
    programFolderId = program?.sharepoint_folder_id ?? undefined
  }

  // ── Crée le dossier SharePoint ────────────────────────────────────────────
  const result = await createProjectFolder(ms.config, ms.options, {
    id:    project.id,
    code:  project.code,
    title: project.title,
  }, programFolderId)

  if (!result) {
    console.error('[SharePoint hook] createProjectFolder failed for project', id)
    return NextResponse.json({ error: 'Échec création dossier SharePoint' }, { status: 500 })
  }

  // ── Sauvegarde les IDs/URLs en DB ─────────────────────────────────────────
  await admin
    .from('projects')
    .update({
      sharepoint_folder_id:  result.folderId,
      sharepoint_folder_url: result.viewLink ?? result.folderUrl,
    })
    .eq('id', id)

  // ── Invite les membres existants ──────────────────────────────────────────
  if (ms.options.auto_invite_members) {
    const { data: members } = await admin
      .from('project_members')
      .select('profile_id, role')
      .eq('project_id', id)

    const memberIds = (members ?? []).map(m => m.profile_id).filter(Boolean)

    if (memberIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, email, full_name')
        .in('id', memberIds)

      await Promise.allSettled(
        (profiles ?? []).map(p => {
          const memberRole = members?.find(m => m.profile_id === p.id)
          const sharepointRole = memberRole?.role === 'responsible' ? 'write' : 'read'
          return inviteMember(
            ms.config,
            result.folderId,
            p.email,
            sharepointRole,
            `Vous avez été ajouté au projet "${project.title}" sur Popsjet.`
          )
        })
      )
    }
  }

  return NextResponse.json({
    ok:         true,
    folderId:   result.folderId,
    folderUrl:  result.folderUrl,
    viewLink:   result.viewLink,
  })
}

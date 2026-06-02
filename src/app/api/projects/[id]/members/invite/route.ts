/**
 * POST /api/projects/[id]/members/invite
 *
 * Invite un nouveau membre sur le dossier SharePoint du projet.
 * Appelé automatiquement quand un membre est ajouté à un projet.
 * Body: { profile_id: string, role: 'responsible' | 'member' }
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getMicrosoftIntegration } from '@/lib/integrations/microsoft/index'
import { inviteMember } from '@/lib/integrations/microsoft/sharepoint'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: projectId } = await params

  // ── Auth ──────────────────────────────────────────────────────────────────
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // ── Plugin actif ? ────────────────────────────────────────────────────────
  const ms = await getMicrosoftIntegration()
  if (!ms || !ms.options.auto_invite_members) {
    return NextResponse.json({ skipped: true })
  }

  const body = await req.json()
  const { profile_id, role } = body as { profile_id: string; role: string }

  const admin = createAdminClient()

  // ── Récupère le dossier SharePoint du projet ──────────────────────────────
  const { data: project } = await admin
    .from('projects')
    .select('id, title, sharepoint_folder_id')
    .eq('id', projectId)
    .single()

  if (!project?.sharepoint_folder_id) {
    return NextResponse.json({ skipped: true, reason: 'No SharePoint folder for this project' })
  }

  // ── Récupère l'email du membre ────────────────────────────────────────────
  const { data: profile } = await admin
    .from('profiles')
    .select('email, full_name')
    .eq('id', profile_id)
    .single()

  if (!profile?.email) {
    return NextResponse.json({ error: 'Profil introuvable' }, { status: 404 })
  }

  // ── Invite sur SharePoint ─────────────────────────────────────────────────
  const sharepointRole = role === 'responsible' ? 'write' : 'read'

  const ok = await inviteMember(
    ms.config,
    project.sharepoint_folder_id,
    profile.email,
    sharepointRole,
    `Vous avez été ajouté au projet "${project.title}" sur Popsjet.`
  )

  return NextResponse.json({ ok })
}

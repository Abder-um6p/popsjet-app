/**
 * POST /api/programs/[id]/sharepoint
 * Crée le dossier SharePoint/OneDrive du programme + sous-dossier Documents/.
 * Fire & forget depuis NewProgramForm.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getMicrosoftIntegration } from '@/lib/integrations/microsoft/index'
import { createProgramFolder } from '@/lib/integrations/microsoft/sharepoint'

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const microsoft = await getMicrosoftIntegration()
  if (!microsoft || !microsoft.options.auto_create_folder) {
    return NextResponse.json({ skipped: true })
  }

  const admin = createAdminClient()
  const { data: program } = await admin
    .from('programs')
    .select('id, name, sharepoint_folder_id')
    .eq('id', id)
    .single()

  if (!program) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })

  // Ne pas recréer si déjà existant
  if (program.sharepoint_folder_id) {
    return NextResponse.json({ ok: true, folderId: program.sharepoint_folder_id, skipped: true })
  }

  const result = await createProgramFolder(microsoft.config, { id: program.id, name: program.name })
  if (!result) return NextResponse.json({ error: 'Échec création dossier' }, { status: 500 })

  // Stocke l'ID et l'URL du dossier
  await admin
    .from('programs')
    .update({
      sharepoint_folder_id:  result.folderId,
      sharepoint_folder_url: result.folderUrl,
    })
    .eq('id', id)

  console.log(`[SharePoint] Programme ${id} → dossier créé: ${result.folderId}`)

  return NextResponse.json({ ok: true, folderId: result.folderId, folderUrl: result.folderUrl })
}

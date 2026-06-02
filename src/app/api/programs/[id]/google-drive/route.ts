/**
 * POST /api/programs/[id]/google-drive
 * Crée le dossier Google Drive du programme + sous-dossier Documents/.
 * Fire & forget depuis NewProgramForm.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { getGoogleIntegration } from '@/lib/integrations/google/index'
import { createProgramFolder } from '@/lib/integrations/google/drive'

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
  const { data: program } = await admin
    .from('programs')
    .select('id, name, google_folder_id')
    .eq('id', id)
    .single()

  if (!program) return NextResponse.json({ error: 'Programme introuvable' }, { status: 404 })

  // Ne pas recréer si déjà existant
  if (program.google_folder_id) {
    return NextResponse.json({ ok: true, folderId: program.google_folder_id, skipped: true })
  }

  const result = await createProgramFolder(google.config, { id: program.id, name: program.name })
  if (!result) return NextResponse.json({ error: 'Échec création dossier Drive' }, { status: 500 })

  // Stocke l'ID et l'URL du dossier
  await admin
    .from('programs')
    .update({
      google_folder_id:  result.folderId,
      google_folder_url: result.folderUrl,
    })
    .eq('id', id)

  console.log(`[Google Drive] Programme ${id} → dossier créé: ${result.folderId}`)

  return NextResponse.json({ ok: true, folderId: result.folderId, folderUrl: result.folderUrl })
}

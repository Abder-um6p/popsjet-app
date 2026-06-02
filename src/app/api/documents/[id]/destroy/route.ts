import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// DELETE /api/documents/[id]/destroy — suppression définitive (admin/directeur uniquement)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role, email').eq('id', user.id).single()

  if (!profile || !['admin', 'directeur'].includes(profile.role)) {
    return NextResponse.json({ error: 'Réservé aux administrateurs et directeurs' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Inclure file_path et bucket_name pour la suppression Storage
  const { data: doc, error: fetchError } = await admin
    .from('documents')
    .select('id, title, deleted_at, file_url, file_path, bucket_name, uploaded_by')
    .eq('id', id)
    .single()

  if (fetchError || !doc) return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
  if (!doc.deleted_at) {
    return NextResponse.json(
      { error: 'Le document doit être dans la corbeille avant suppression définitive' },
      { status: 409 }
    )
  }

  // ── Audit snapshot avant suppression ─────────────────────────────────────
  try {
    await admin.from('audit_logs').insert({
      user_id:     user.id,
      user_email:  (profile as any).email ?? null,
      action:      'document_destroyed',
      entity_type: 'document',
      entity_id:   id,
      entity_name: doc.title,
      old_data:    doc as any,
    })
  } catch { /* swallow */ }

  // ── Suppression du fichier Storage (non-bloquant) ─────────────────────────
  // Le fichier physique est supprimé avant la ligne DB.
  // Si le bucket ou le chemin est introuvable, on continue sans bloquer.
  const bucketName: string = (doc as any).bucket_name ?? 'documents'
  const filePath: string | null = (doc as any).file_path ?? null
  if (filePath) {
    try {
      const { error: storageErr } = await admin.storage
        .from(bucketName)
        .remove([filePath])
      if (storageErr) {
        // Log only — ne pas bloquer la suppression DB si Storage échoue
        console.warn('[documents/destroy] Storage remove warning:', storageErr.message)
      }
    } catch (ex) {
      console.warn('[documents/destroy] Storage remove exception (continuing):', ex)
    }
  }

  // ── Suppression définitive de la ligne DB ─────────────────────────────────
  const { error: destroyError } = await admin
    .from('documents').delete().eq('id', id)

  if (destroyError) return NextResponse.json({ error: destroyError.message }, { status: 500 })
  return NextResponse.json({ ok: true, title: doc.title })
}

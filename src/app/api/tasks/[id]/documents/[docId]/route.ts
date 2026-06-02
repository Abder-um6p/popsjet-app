import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { insertAuditLog } from '@/lib/api-helpers'

// ─── DELETE /api/tasks/[id]/documents/[docId] ───────────────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  try {
    const { id, docId } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Fetch document
    const { data: doc } = await admin
      .from('task_documents')
      .select('id, task_id, file_path, file_name, uploaded_by')
      .eq('id', docId)
      .single()

    if (!doc) {
      return NextResponse.json({ error: 'Document introuvable' }, { status: 404 })
    }

    if (doc.task_id !== id) {
      return NextResponse.json({ error: 'Document non rattaché à cette tâche' }, { status: 400 })
    }

    // Permissions
    let allowed = doc.uploaded_by === user.id
    let actorName = 'Quelqu\'un'

    const { data: profile } = await admin
      .from('profiles').select('id, full_name, role').eq('id', user.id).single()
    if (profile?.full_name) actorName = profile.full_name

    if (!allowed && profile && ['admin', 'directeur', 'chef_projet'].includes(profile.role)) {
      allowed = true
    }

    if (!allowed) {
      return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
    }

    // Supprimer du storage (non-bloquant)
    try {
      await admin.storage.from('task-documents').remove([doc.file_path])
    } catch {
      // continuer même si le fichier physique est introuvable
    }

    const { error: delError } = await admin
      .from('task_documents')
      .delete()
      .eq('id', docId)

    if (delError) {
      return NextResponse.json({ error: delError.message }, { status: 500 })
    }

    // Log d'activité (non-bloquant)
    try {
      await admin.from('task_activity_logs').insert({
        task_id: id,
        user_id: user.id,
        action: 'document_deleted',
        old_value: doc.id,
        note: `${actorName} a supprimé ${doc.file_name}`,
      })
    } catch { /* ignorer */ }

    // VH-05 — Audit log document supprimé
    await insertAuditLog({
      admin, userId: user.id, userEmail: null,
      action: 'task_document_deleted', entityType: 'task', entityId: id, entityName: doc.file_name,
      oldData: { doc_id: docId, file_name: doc.file_name, file_path: doc.file_path },
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { insertAuditLog } from '@/lib/api-helpers'

const MAX_FILE_SIZE = 20 * 1024 * 1024 // 20 Mo
const ALLOWED_MIME = new Set<string>([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/gif',
  'image/webp',
  'application/zip',
  'application/x-zip-compressed',
  'text/plain',
])
const ALLOWED_EXT = /\.(pdf|docx?|xlsx?|png|jpe?g|gif|webp|zip|txt)$/i

const ALLOWED_TAGS = new Set(['proof', 'invoice', 'deliverable', 'report', 'screenshot', 'other'])

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120)
}

// ─── GET /api/tasks/[id]/documents — liste les documents d'une tâche ─────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const admin = createAdminClient()

    // Vérifier que la tâche existe
    const { data: task } = await admin
      .from('tasks')
      .select('id, project_id')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (!task) {
      return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })
    }

    const { data: docs, error } = await admin
      .from('task_documents')
      .select('id, task_id, project_id, uploaded_by, file_name, file_url, file_path, file_size, mime_type, document_tag, uploaded_at')
      .eq('task_id', id)
      .order('uploaded_at', { ascending: false })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Enrichir avec profils des uploaders
    const uploaderIds = [...new Set((docs ?? []).map(d => d.uploaded_by).filter((u): u is string => !!u))]
    const profileMap: Record<string, { id: string; full_name: string; email: string; avatar_url: string | null }> = {}
    if (uploaderIds.length > 0) {
      const { data: profiles } = await admin
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', uploaderIds)
      profiles?.forEach(p => { profileMap[p.id] = p })
    }

    return NextResponse.json(
      (docs ?? []).map(d => ({
        ...d,
        uploader: d.uploaded_by ? profileMap[d.uploaded_by] ?? null : null,
      }))
    )
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

// ─── POST /api/tasks/[id]/documents — upload un document ─────────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
    }

    const formData = await req.formData()
    const file = formData.get('file') as File | null
    const tagRaw = (formData.get('document_tag') as string | null)?.trim() || 'other'
    const document_tag = ALLOWED_TAGS.has(tagRaw) ? tagRaw : 'other'

    if (!file) {
      return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
    }

    if (file.size === 0) {
      return NextResponse.json({ error: 'Fichier vide' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 20 Mo)' }, { status: 400 })
    }

    const mime = file.type || ''
    const nameOk = ALLOWED_EXT.test(file.name)
    if (!ALLOWED_MIME.has(mime) && !nameOk) {
      return NextResponse.json({ error: 'Type de fichier non autorisé' }, { status: 400 })
    }

    const admin = createAdminClient()

    // Vérifier la tâche
    const { data: task } = await admin
      .from('tasks')
      .select('id, project_id, assigned_to, created_by, status')
      .eq('id', id)
      .is('deleted_at', null)
      .single()

    if (!task) {
      return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })
    }

    // Vérifier permissions
    const isAssignee = task.assigned_to === user.id
    const isCreator  = task.created_by === user.id

    let allowed = isAssignee || isCreator
    let uploaderName = 'Quelqu\'un'

    const { data: profile } = await admin
      .from('profiles').select('id, full_name, role').eq('id', user.id).single()
    if (profile?.full_name) uploaderName = profile.full_name

    if (!allowed && profile && ['admin', 'directeur', 'chef_projet'].includes(profile.role)) {
      allowed = true
    }

    if (!allowed) {
      // Vérifier si chef_projet du projet (project_members)
      try {
        const { data: membership } = await admin
          .from('project_members')
          .select('role')
          .eq('project_id', task.project_id)
          .eq('profile_id', user.id)
          .maybeSingle()
        if (membership?.role === 'chef_projet' || membership?.role === 'responsible') {
          allowed = true
        }
      } catch {
        // ignorer — colonne ou table peut varier
      }
    }

    if (!allowed) {
      return NextResponse.json({ error: 'Permission refusée' }, { status: 403 })
    }

    // Upload vers Supabase Storage
    const cleanName = sanitizeFileName(file.name)
    const timestamp = Date.now()
    const filePath = `project/${task.project_id}/tasks/${task.id}/${timestamp}_${cleanName}`

    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    const { error: uploadError } = await admin.storage
      .from('task-documents')
      .upload(filePath, buffer, {
        contentType: mime || 'application/octet-stream',
        upsert: false,
      })

    if (uploadError) {
      const msg = String(uploadError.message ?? uploadError)
      if (/bucket.*not.*found|not found/i.test(msg)) {
        return NextResponse.json(
          { error: 'Bucket de stockage non configuré. Créez le bucket "task-documents" dans Supabase Storage.' },
          { status: 500 }
        )
      }
      return NextResponse.json({ error: msg }, { status: 500 })
    }

    const { data: urlData } = admin.storage.from('task-documents').getPublicUrl(filePath)
    const file_url = urlData?.publicUrl ?? ''

    // Insert en DB
    const { data: doc, error: insertError } = await admin
      .from('task_documents')
      .insert({
        task_id: task.id,
        project_id: task.project_id,
        uploaded_by: user.id,
        file_name: file.name,
        file_url,
        file_path: filePath,
        file_size: file.size,
        mime_type: mime,
        document_tag,
      })
      .select('id, task_id, project_id, uploaded_by, file_name, file_url, file_path, file_size, mime_type, document_tag, uploaded_at')
      .single()

    if (insertError || !doc) {
      // Rollback storage
      try { await admin.storage.from('task-documents').remove([filePath]) } catch {}
      return NextResponse.json({ error: insertError?.message ?? 'Insertion échouée' }, { status: 500 })
    }

    // Log d'activité (non-bloquant)
    try {
      await admin.from('task_activity_logs').insert({
        task_id: task.id,
        user_id: user.id,
        action: 'document_uploaded',
        new_value: doc.id,
        note: `${uploaderName} a joint ${file.name}`,
      })
    } catch {
      // ignorer
    }

    // VH-05 — Audit log document uploadé
    await insertAuditLog({
      admin, userId: user.id, userEmail: null,
      action: 'task_document_uploaded', entityType: 'task', entityId: id, entityName: file.name,
      newData: { doc_id: doc.id, file_name: file.name, file_size: file.size, tag: document_tag },
    })

    // NT-04 — notifier assigné + créateur du document uploadé
    const notifySet = new Set<string>([task.assigned_to, task.created_by].filter((uid): uid is string => !!uid && uid !== user.id))
    for (const notifyId of notifySet) {
      try {
        await admin.from('notifications').insert({
          user_id:      notifyId,
          type:         'document_uploaded',
          title:        'Document joint',
          message:      `${uploaderName} a joint "${file.name}" sur la tâche`,
          related_id:   id,
          related_type: 'task',
          is_read:      false,
        })
      } catch { /* swallow */ }
    }

    // ── Google Drive : upload du fichier dans le dossier de la tâche (fire & forget) ──
    ;(async () => {
      try {
        // Récupère google_folder_id de la tâche (colonne ajoutée en migration 006)
        const { data: taskWithFolder } = await admin
          .from('tasks').select('google_folder_id').eq('id', task.id).maybeSingle()
        if (!taskWithFolder?.google_folder_id) return

        const { getGoogleIntegration } = await import('@/lib/integrations/google/index')
        const { uploadFile: uploadToDrive } = await import('@/lib/integrations/google/drive')
        const google = await getGoogleIntegration().catch(() => null)
        if (!google) return

        await uploadToDrive(
          google.config,
          taskWithFolder.google_folder_id,
          buffer,
          file.name,
          mime || 'application/octet-stream'
        )
      } catch { /* non bloquant */ }
    })()

    return NextResponse.json({
      ...doc,
      uploader: profile
        ? { id: profile.id, full_name: profile.full_name, email: '', avatar_url: null }
        : null,
    }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

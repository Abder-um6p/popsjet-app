import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// DELETE /api/tasks/[id]/destroy — suppression PHYSIQUE et IRRÉVERSIBLE
// Permissions : admin et directeur uniquement
// La tâche doit déjà être dans la corbeille (deleted_at IS NOT NULL)
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const admin = createAdminClient()

    // ── Étape 1 : la tâche doit exister ET être dans la corbeille ─────────────
    const { data: task, error: fetchError } = await admin
      .from('tasks')
      .select('id, project_id, title, assigned_to, created_by, status, deleted_at')
      .eq('id', id)
      .not('deleted_at', 'is', null)
      .single()

    if (fetchError || !task) {
      return NextResponse.json(
        { error: 'Tâche introuvable dans la corbeille — seules les tâches déjà supprimées peuvent être détruites' },
        { status: 404 }
      )
    }

    // ── Étape 2 : permissions strictes (admin / directeur uniquement) ─────────
    const { data: profile } = await admin
      .from('profiles')
      .select('role, full_name, email')
      .eq('id', user.id)
      .single()

    const role = profile?.role ?? 'membre'
    if (!['admin', 'directeur'].includes(role)) {
      return NextResponse.json(
        { error: 'Permission refusée — seuls les administrateurs et directeurs peuvent supprimer définitivement une tâche' },
        { status: 403 }
      )
    }

    const now = new Date().toISOString()

    // ── Étape 3 : audit log AVANT la destruction (task_activity_logs sera ─────
    // ── supprimé en cascade — on persiste l'événement dans audit_logs) ────────
    try {
      await admin.from('audit_logs').insert({
        user_id:     user.id,
        user_email:  profile?.email ?? null,
        action:      'task_destroy',
        entity_type: 'task',
        entity_id:   id,
        entity_name: task.title,
        old_data: {
          project_id:  task.project_id,
          status:      task.status,
          assigned_to: task.assigned_to,
          created_by:  task.created_by,
          deleted_at:  task.deleted_at,
        },
        new_data:   null,
        ip_address: null,
        user_agent: null,
      })
    } catch { /* swallow */ }

    // ── Étape 4 : Suppression des fichiers Storage des task_documents ────────
    // Les rows task_documents seront supprimées en cascade par la FK DB.
    // On supprime d'abord les fichiers physiques pour éviter les orphans Storage.
    try {
      const { data: taskDocs } = await admin
        .from('task_documents')
        .select('file_path')
        .eq('task_id', id)

      const paths = (taskDocs ?? []).map(d => d.file_path).filter(Boolean) as string[]
      if (paths.length > 0) {
        const { error: storageErr } = await admin.storage
          .from('task-documents')
          .remove(paths)
        if (storageErr) {
          console.warn('[tasks/destroy] Storage remove warning:', storageErr.message)
        }
      }
    } catch (ex) {
      console.warn('[tasks/destroy] Storage cleanup exception (continuing):', ex)
    }

    // ── Étape 5 : DELETE physique ─────────────────────────────────────────────
    const { error: delError } = await admin
      .from('tasks')
      .delete()
      .eq('id', id)

    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

    // Notification à l'assigné si différent du suppresseur
    // ⚠️ Ne pas mettre related_id : la tâche n'existe plus — le lien mènerait à un 404.
    //    Le contexte est fourni via le champ `data` uniquement.
    if (task.assigned_to && task.assigned_to !== user.id) {
      try {
        await admin.from('notifications').insert({
          user_id: task.assigned_to, type: 'task_destroyed',
          title: 'Tâche définitivement supprimée',
          message: `${profile?.full_name ?? 'Un administrateur'} a supprimé définitivement la tâche "${task.title}"`,
          data: { task_title: task.title, project_id: task.project_id, destroyed_at: now, destroyed_by: user.id },
          related_id:   null,
          related_type: null,
          is_read: false,
        })
      } catch { /* swallow */ }
    }

    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    const stack = err instanceof Error ? (err.stack ?? '').slice(0, 600) : ''
    console.error('[destroy] UNHANDLED EXCEPTION:', msg, stack)
    return NextResponse.json({ error: msg, stack }, { status: 500 })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { insertAuditLog } from '@/lib/api-helpers'

// ─── GET /api/tasks/[id]/comments — liste des commentaires ───────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()

  // Vérifier que la tâche existe
  const { data: task } = await admin
    .from('tasks')
    .select('id, project_id, assigned_to, created_by')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!task) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })

  // Récupérer les commentaires
  const { data: comments, error } = await admin
    .from('task_comments')
    .select('id, task_id, author_id, content, created_at, updated_at')
    .eq('task_id', id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Enrichir avec les profils
  const authorIds = [...new Set((comments ?? []).map(c => c.author_id).filter(Boolean))]
  const profileMap: Record<string, { id: string; full_name: string; avatar_url: string | null }> = {}

  if (authorIds.length > 0) {
    const { data: profiles } = await admin
      .from('profiles')
      .select('id, full_name, avatar_url')
      .in('id', authorIds)
    profiles?.forEach(p => { profileMap[p.id] = p })
  }

  return NextResponse.json(
    (comments ?? []).map(c => ({
      ...c,
      author: c.author_id ? profileMap[c.author_id] ?? null : null,
    }))
  )
}

// ─── POST /api/tasks/[id]/comments — ajouter un commentaire ──────────────────

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const content = body?.content?.trim()

  if (!content) {
    return NextResponse.json({ error: 'Le contenu du commentaire est requis' }, { status: 400 })
  }

  if (content.length > 5000) {
    return NextResponse.json({ error: 'Le commentaire ne peut pas dépasser 5000 caractères' }, { status: 400 })
  }

  const admin = createAdminClient()

  // Vérifier que la tâche existe et que l'utilisateur a accès
  const { data: task } = await admin
    .from('tasks')
    .select('id, project_id, title, assigned_to, created_by')
    .eq('id', id)
    .is('deleted_at', null)
    .single()

  if (!task) return NextResponse.json({ error: 'Tâche introuvable' }, { status: 404 })

  // Vérifier la membership au projet
  const isAssignee = task.assigned_to === user.id
  const isCreator  = task.created_by === user.id

  if (!isAssignee && !isCreator) {
    const { data: profile } = await admin
      .from('profiles').select('role').eq('id', user.id).single()

    const isPrivileged = profile && ['admin', 'directeur'].includes(profile.role)

    if (!isPrivileged) {
      const { data: membership } = await admin
        .from('project_members')
        .select('id')
        .eq('project_id', task.project_id)
        .eq('profile_id', user.id)
        .maybeSingle()

      if (!membership) {
        return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
      }
    }
  }

  // Créer le commentaire
  const { data: comment, error: insertError } = await admin
    .from('task_comments')
    .insert({
      task_id: id,
      author_id: user.id,
      content,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Log d'activité
  try {
    await admin.from('task_activity_logs').insert({
      task_id: id,
      user_id: user.id,
      action: 'comment',
      new_value: comment.id,
      note: content.slice(0, 100) + (content.length > 100 ? '…' : ''),
    })
  } catch { /* swallow */ }

  // Récupérer le profil de l'auteur
  const { data: authorProfile } = await admin
    .from('profiles')
    .select('id, full_name, avatar_url')
    .eq('id', user.id)
    .single()

  // VH-05 — Audit log commentaire ajouté
  await insertAuditLog({
    admin, userId: user.id, userEmail: null,
    action: 'task_comment_added', entityType: 'task', entityId: id, entityName: task.title,
    newData: { comment_id: comment.id, content_preview: content.slice(0, 80) },
  })

  // NT-04 — notifier TOUS les concernés : assigné, créateur, (pas l'auteur du commentaire)
  const notifySet = new Set<string>([task.assigned_to, task.created_by].filter((uid): uid is string => !!uid && uid !== user.id))
  for (const notifyId of notifySet) {
    try {
      await admin.from('notifications').insert({
        user_id:      notifyId,
        type:         'task_comment',
        title:        'Nouveau commentaire',
        message:      `${authorProfile?.full_name ?? 'Quelqu\'un'} a commenté la tâche "${task.title}"`,
        related_id:   id,
        related_type: 'task',
        is_read:      false,
      })
    } catch { /* swallow */ }
  }

  return NextResponse.json({
    ...comment,
    author: authorProfile ?? null,
  }, { status: 201 })
}

// ─── DELETE /api/tasks/[id]/comments — supprimer un commentaire ──────────────

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const commentId = body?.comment_id

  if (!commentId) return NextResponse.json({ error: 'comment_id requis' }, { status: 400 })

  const admin = createAdminClient()

  // Vérifier que le commentaire appartient à l'utilisateur
  const { data: comment } = await admin
    .from('task_comments')
    .select('id, author_id')
    .eq('id', commentId)
    .eq('task_id', id)
    .single()

  if (!comment) return NextResponse.json({ error: 'Commentaire introuvable' }, { status: 404 })

  if (comment.author_id !== user.id) {
    // Admin peut supprimer n'importe quel commentaire
    const { data: profile } = await admin
      .from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !['admin', 'directeur'].includes(profile.role)) {
      return NextResponse.json({ error: 'Vous ne pouvez supprimer que vos propres commentaires' }, { status: 403 })
    }
  }

  await admin.from('task_comments').delete().eq('id', commentId)

  // VH-05 — Audit log commentaire supprimé
  await insertAuditLog({
    admin, userId: user.id, userEmail: null,
    action: 'task_comment_deleted', entityType: 'task', entityId: id, entityName: null,
    oldData: { comment_id: commentId, author_id: comment.author_id },
  })

  return NextResponse.json({ ok: true })
}

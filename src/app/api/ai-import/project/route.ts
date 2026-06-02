import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// ── Helper ───────────────────────────────────────────────────────────────────

function generateProjectCode(type: string, title: string): string {
  const typePrefix = type.slice(0, 3).toUpperCase()
  const titlePrefix = title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 4)
    .toUpperCase()
  const year = new Date().getFullYear().toString().slice(2)
  const rand = Math.floor(Math.random() * 900 + 100)
  return `${typePrefix}-${titlePrefix}-${year}${rand}`
}

// ── POST /api/ai-import/project ──────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })
  }

  const body = await req.json()
  const { title, description, type, program_id, start_date, end_date, tasks } = body

  if (!title || typeof title !== 'string' || title.trim().length < 2) {
    return NextResponse.json({ error: 'Titre requis (min. 2 caractères)' }, { status: 400 })
  }
  if (!type || !['workshop', 'hackathon', 'bootcamp', 'incubation', 'meeting', 'other'].includes(type)) {
    return NextResponse.json({ error: 'Type de projet invalide' }, { status: 400 })
  }
  if (!program_id || typeof program_id !== 'string') {
    return NextResponse.json({ error: 'Programme requis' }, { status: 400 })
  }

  const admin = createAdminClient()
  const projectId = crypto.randomUUID()
  const code = generateProjectCode(type, title.trim())

  // ── Créer le projet ──────────────────────────────────────────────────────
  const { error: projectError } = await admin.from('projects').insert({
    id:           projectId,
    code,
    title:        title.trim(),
    description:  description ?? null,
    type,
    program_id,
    start_date:   start_date ?? null,
    end_date:     end_date ?? null,
    status:       'active',
    completion_pct: 0,
    created_by:   user.id,
  })

  if (projectError) {
    console.error('[ai-import/project] Erreur création projet:', projectError.message)
    return NextResponse.json({ error: projectError.message }, { status: 500 })
  }

  // ── Ajouter le créateur comme membre responsable ──────────────────────────
  await admin.from('project_members').insert({
    project_id: projectId,
    profile_id:  user.id,
    role:        'responsible',
  })

  // ── Créer les tâches associées ────────────────────────────────────────────
  if (Array.isArray(tasks) && tasks.length > 0) {
    const taskInserts = tasks
      .filter((t: any) => t?.title)
      .map((t: any) => ({
        project_id:  projectId,
        title:       String(t.title).trim(),
        description: t.description ?? null,
        status:      'todo',
        priority:    ['low', 'medium', 'high', 'urgent'].includes(t.priority) ? t.priority : 'medium',
        due_date:    t.due_date ?? null,
        created_by:  user.id,
      }))

    if (taskInserts.length > 0) {
      const { error: tasksError } = await admin.from('tasks').insert(taskInserts)
      if (tasksError) {
        console.warn('[ai-import/project] Erreur création tâches:', tasksError.message)
        // On ne bloque pas — le projet est créé, les tâches sont optionnelles
      }
    }
  }

  return NextResponse.json({ id: projectId, code }, { status: 201 })
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

/**
 * GET /api/ai/project-health?projectId=xxx
 * Returns: { score: number (0-100), label: string, color: string }
 *
 * POST /api/ai/project-health
 * Body: { projects: [{id, completion_pct, status, end_date, start_date}] }
 * Returns: { scores: Record<id, {score, label, color}> }
 */

function computeHealth(p: any, tasks: any[]): { score: number; label: string; color: string } {
  const now = new Date()

  // Statuts spéciaux — score fixe, pas de calcul dynamique
  if (p.status === 'cancelled') {
    return { score: 0, label: 'Annulé', color: '#6b7280' }
  }
  if (p.status === 'on_hold') {
    return { score: 30, label: 'En pause', color: '#f59e0b' }
  }
  if (p.status === 'planning') {
    // Projet non encore démarré — score neutre, couleur grise
    return { score: 65, label: 'Planifié', color: '#6b7280' }
  }
  if (p.status === 'done') {
    const pctDone = p.completion_pct ?? 0
    const score = pctDone >= 100 ? 100 : Math.max(60, pctDone)
    return { score, label: 'Terminé', color: '#22c55e' }
  }

  // Statut actif (active ou tout autre statut non géré ci-dessus)
  let score = 100
  const pct = p.completion_pct ?? 0

  // 1. Avancement
  if (pct < 20) {
    // Pénalité renforcée si le projet a déjà démarré (start_date passée)
    const hasStarted = p.start_date && new Date(p.start_date) <= now
    score -= hasStarted ? 35 : 20
  }
  else if (pct < 50) score -= 15
  else if (pct < 80) score -= 5

  // 2. Retard sur la date de fin
  if (p.end_date) {
    const daysLeft = Math.ceil((new Date(p.end_date).getTime() - now.getTime()) / 86400000)
    if (daysLeft < 0) score -= 30                      // date dépassée
    else if (daysLeft <= 7 && pct < 80) score -= 20    // très serré
    else if (daysLeft <= 21 && pct < 50) score -= 10   // serré
  }

  // 3. Tâches en retard
  const overdue = tasks.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date) < now).length
  if (overdue >= 3) score -= 20
  else if (overdue > 0) score -= 10

  // 4. Aucune tâche créée / tout terminé sans 100%
  const activeTasks = tasks.filter(t => t.status !== 'done').length
  if (tasks.length === 0) score -= 15
  else if (activeTasks === 0 && pct < 100) score -= 5

  score = Math.max(0, Math.min(100, score))

  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Bon' : score >= 40 ? 'Moyen' : score >= 20 ? 'En difficulté' : 'Critique'
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#84cc16' : score >= 40 ? '#f59e0b' : score >= 20 ? '#f97316' : '#ef4444'

  return { score, label, color }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json()
  const projects: any[] = body.projects ?? [] // [{id, completion_pct, status, end_date, start_date}]
  if (projects.length === 0) return NextResponse.json({ scores: {} })

  const admin = createAdminClient()
  const projectIds = projects.map(p => p.id)

  const { data: tasks } = await admin
    .from('tasks')
    .select('project_id, status, due_date')
    .in('project_id', projectIds)
    .is('deleted_at', null)

  const tasksByProject: Record<string, any[]> = {}
  for (const t of tasks ?? []) {
    if (!tasksByProject[t.project_id]) tasksByProject[t.project_id] = []
    tasksByProject[t.project_id].push(t)
  }

  const scores: Record<string, { score: number; label: string; color: string }> = {}
  for (const p of projects) {
    scores[p.id] = computeHealth(p, tasksByProject[p.id] ?? [])
  }

  return NextResponse.json({ scores })
}

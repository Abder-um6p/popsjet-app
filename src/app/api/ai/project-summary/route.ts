import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hasAiKey, aiGenerate } from '@/lib/ai/providers'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  // Récupérer la clé Gemini personnelle de l'utilisateur
  const admin = createAdminClient()
  const { data: profileData } = await admin
    .from('profiles').select('ai_api_key').eq('id', user.id).single()
  const userApiKey = profileData?.ai_api_key ?? null

  const body = await req.json()
  const { project, tasks, members } = body

  if (!project) return NextResponse.json({ error: 'Données manquantes' }, { status: 400 })

  if (!hasAiKey(userApiKey)) {
    return NextResponse.json({ summary: buildRuleBasedSummary(project, tasks, members), noKey: true })
  }

  try {
    const summary = await aiGenerate(buildPrompt(project, tasks, members), { temperature: 0.4, maxOutputTokens: 300, apiKey: userApiKey })
    return NextResponse.json({ summary })
  } catch {
    return NextResponse.json({ summary: buildRuleBasedSummary(project, tasks, members), noKey: true })
  }
}

function buildPrompt(project: any, tasks: any[], members: any[]): string {
  const done       = tasks.filter((t: any) => t.status === 'done').length
  const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length
  const overdue    = tasks.filter((t: any) => {
    if (!t.due_date || t.status === 'done') return false
    return new Date(t.due_date) < new Date()
  }).length

  return `Tu es un assistant de gestion de projet pour l'I&E Lab de l'UM6P (Maroc).
Génère un résumé professionnel en français (3-4 phrases max) sur l'état actuel du projet.
Sois factuel, direct et utile. Ne répète pas le titre. Commence par l'avancement global.

Projet : ${project.title}
Type : ${project.type ?? '—'}
Statut : ${project.status ?? '—'}
Avancement : ${project.completion_pct ?? 0}%
Période : ${project.start_date ?? '?'} → ${project.end_date ?? '?'}
Budget : ${project.budget ? project.budget + ' MAD' : 'non défini'}

Tâches : ${tasks.length} total | ${done} terminées | ${inProgress} en cours | ${overdue} en retard
Équipe : ${members.length} membre(s)

Résumé :`
}

function buildRuleBasedSummary(project: any, tasks: any[], members: any[]): string {
  const total      = tasks.length
  const done       = tasks.filter((t: any) => t.status === 'done').length
  const inProgress = tasks.filter((t: any) => t.status === 'in_progress').length
  const overdue    = tasks.filter((t: any) => {
    if (!t.due_date || t.status === 'done') return false
    return new Date(t.due_date) < new Date()
  }).length
  const pct = project.completion_pct ?? (total > 0 ? Math.round((done / total) * 100) : 0)

  let summary = `Le projet avance à ${pct}%`
  if (total > 0) {
    summary += ` avec ${done} tâche${done > 1 ? 's' : ''} terminée${done > 1 ? 's' : ''} sur ${total}`
    if (inProgress > 0) summary += `, ${inProgress} en cours`
    summary += '.'
  } else {
    summary += ' et aucune tâche enregistrée pour le moment.'
  }
  if (overdue > 0) {
    summary += ` ⚠️ ${overdue} tâche${overdue > 1 ? 's sont' : ' est'} en retard et nécessite${overdue > 1 ? 'nt' : ''} une attention immédiate.`
  }
  if (members.length > 0) {
    summary += ` L'équipe compte ${members.length} membre${members.length > 1 ? 's' : ''}.`
  }
  if (project.end_date) {
    const daysLeft = Math.ceil((new Date(project.end_date).getTime() - Date.now()) / 86400000)
    if (daysLeft < 0) {
      summary += ` La date de fin prévue est dépassée depuis ${Math.abs(daysLeft)} jour${Math.abs(daysLeft) > 1 ? 's' : ''}.`
    } else if (daysLeft <= 14) {
      summary += ` Il reste ${daysLeft} jour${daysLeft > 1 ? 's' : ''} avant la date de fin.`
    }
  }
  return summary
}

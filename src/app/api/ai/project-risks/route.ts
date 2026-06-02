import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hasAiKey, aiGenerate, parseAiJson } from '@/lib/ai/providers'

export interface Risk {
  level:   'low' | 'medium' | 'high'
  title:   string
  detail:  string
}

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

  // Calcul local des indicateurs
  const risks = detectRisks(project, tasks ?? [], members ?? [])

  if (!hasAiKey(userApiKey)) {
    return NextResponse.json({ risks, noKey: true })
  }

  // Enrichissement IA
  try {
    const text = await aiGenerate(buildPrompt(project, tasks ?? [], members ?? [], risks), { temperature: 0.3, maxOutputTokens: 500, apiKey: userApiKey })
    const aiRisks = parseAiJson<Risk[]>(text)
    return NextResponse.json({ risks: aiRisks })
  } catch {
    return NextResponse.json({ risks, noKey: true })
  }
}

function detectRisks(project: any, tasks: any[], members: any[]): Risk[] {
  const risks: Risk[] = []
  const now = new Date()

  // 1. Tâches en retard
  const overdue = tasks.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date) < now)
  if (overdue.length >= 3) {
    risks.push({ level: 'high', title: `${overdue.length} tâches en retard`, detail: 'Plusieurs échéances sont dépassées. Revoir les priorités ou les délais.' })
  } else if (overdue.length > 0) {
    risks.push({ level: 'medium', title: `${overdue.length} tâche${overdue.length > 1 ? 's' : ''} en retard`, detail: 'Des échéances sont dépassées. Une mise à jour est nécessaire.' })
  }

  // 2. Date de fin du projet proche
  if (project.end_date) {
    const daysLeft = Math.ceil((new Date(project.end_date).getTime() - now.getTime()) / 86400000)
    const pct = project.completion_pct ?? 0
    if (daysLeft >= 0 && daysLeft <= 7 && pct < 80) {
      risks.push({ level: 'high', title: 'Fin de projet imminente', detail: `Il reste ${daysLeft} jour(s) mais l'avancement n'est qu'à ${pct}%.` })
    } else if (daysLeft >= 0 && daysLeft <= 21 && pct < 50) {
      risks.push({ level: 'medium', title: 'Délai serré', detail: `${daysLeft} jours restants pour ${100 - pct}% du travail restant.` })
    } else if (daysLeft < 0) {
      risks.push({ level: 'high', title: 'Date de fin dépassée', detail: `Le projet a dépassé sa date de fin prévue de ${Math.abs(daysLeft)} jour(s).` })
    }
  }

  // 3. Tâches sans assigné
  const unassigned = tasks.filter(t => !t.assigned_to && t.status !== 'done')
  if (unassigned.length > 0) {
    const level = unassigned.length >= 5 ? 'high' : unassigned.length >= 2 ? 'medium' : 'low'
    risks.push({ level, title: `${unassigned.length} tâche${unassigned.length > 1 ? 's' : ''} sans assigné`, detail: 'Des tâches actives ne sont pas attribuées à un membre.' })
  }

  // 4. Pas de tâches
  if (tasks.length === 0) {
    risks.push({ level: 'low', title: 'Aucune tâche créée', detail: 'Le projet n\'a pas encore de tâches. Structurez le plan d\'action.' })
  }

  // 5. Équipe vide
  if (members.length === 0) {
    risks.push({ level: 'medium', title: 'Aucun membre dans l\'équipe', detail: 'Le projet n\'a pas de membres assignés.' })
  }

  // 6. Avancement bloqué
  const inProgress = tasks.filter(t => t.status === 'in_progress')
  if (inProgress.length === 0 && tasks.length > 0) {
    const todo = tasks.filter(t => t.status === 'todo')
    if (todo.length > 0) {
      risks.push({ level: 'low', title: 'Aucune tâche en cours', detail: 'Des tâches sont à faire mais aucune n\'est démarrée.' })
    }
  }

  return risks.length > 0 ? risks : [{ level: 'low', title: 'Aucun risque détecté', detail: 'Le projet semble bien avancer. Continuez ainsi !' }]
}

function buildPrompt(project: any, tasks: any[], members: any[], baseRisks: Risk[]): string {
  const overdue = tasks.filter(t => t.due_date && t.status !== 'done' && new Date(t.due_date) < new Date())
  return `Tu es un expert en gestion de projet pour l'I&E Lab de l'UM6P.
Analyse les données suivantes et retourne un tableau JSON de risques (max 5).

Projet : ${project.title} | Statut : ${project.status} | Avancement : ${project.completion_pct ?? 0}%
Date fin : ${project.end_date ?? 'non définie'} | Budget : ${project.budget ?? 'non défini'} MAD
Tâches : ${tasks.length} total | ${tasks.filter(t => t.status === 'done').length} terminées | ${overdue.length} en retard
Membres : ${members.length}

Risques déjà détectés : ${baseRisks.map(r => r.title).join(', ')}

Retourne UNIQUEMENT un tableau JSON valide (sans markdown) :
[{"level":"high|medium|low","title":"titre court","detail":"explication actionnable en français"}]`
}

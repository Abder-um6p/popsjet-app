import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hasAiKey, aiGenerate } from '@/lib/ai/providers'

function ruleBasedDescription(title: string, projectTitle?: string): string {
  return `Cette tâche consiste à ${title.toLowerCase()}.${projectTitle ? ` Elle s'inscrit dans le cadre du projet "${projectTitle}".` : ''} Veuillez préciser les étapes, les livrables attendus et les critères de succès pour cette tâche.`
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profileData } = await admin
    .from('profiles').select('ai_api_key').eq('id', user.id).single()
  const userApiKey = profileData?.ai_api_key ?? null

  const { title, description, project, assignee } = await req.json()
  if (!title) return NextResponse.json({ error: 'Titre manquant' }, { status: 400 })

  if (!hasAiKey(userApiKey)) {
    return NextResponse.json({ description: ruleBasedDescription(title, project?.title), noKey: true })
  }

  try {
    const prompt = `Tu es un assistant de gestion de projet pour l'I&E Lab de l'UM6P (Maroc).
Génère une description professionnelle et actionnable pour cette tâche (3-5 phrases max).
Sois concret, précis et utile. Mentionne les livrables attendus et les critères de succès si pertinent.

Titre de la tâche : "${title}"
${description ? `Description actuelle (à enrichir) : "${description}"` : ''}
${project ? `Projet : ${project.title} (${project.type ?? ''})` : ''}
${assignee ? `Assigné à : ${assignee}` : ''}

Description :`

    const result = await aiGenerate(prompt, { temperature: 0.4, maxOutputTokens: 250, apiKey: userApiKey })
    return NextResponse.json({ description: result })
  } catch (e: any) {
    return NextResponse.json({ description: ruleBasedDescription(title, project?.title), apiError: true, errorMessage: e?.message ?? 'Erreur IA' })
  }
}

import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hasAiKey, aiGenerate, parseAiJson } from '@/lib/ai/providers'

function ruleBasedSteps(title: string): string[] {
  return [
    `Clarifier les objectifs et les livrables de la tâche « ${title} »`,
    'Identifier les ressources et les parties prenantes nécessaires',
    'Planifier et démarrer l\'exécution',
    'Effectuer une revue intermédiaire et ajuster si nécessaire',
    'Valider le résultat final et mettre à jour le statut',
  ]
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profileData } = await admin
    .from('profiles').select('ai_api_key').eq('id', user.id).single()
  const userApiKey = profileData?.ai_api_key ?? null

  const { title, description, project } = await req.json()
  if (!title) return NextResponse.json({ error: 'Titre manquant' }, { status: 400 })

  if (!hasAiKey(userApiKey)) {
    return NextResponse.json({ steps: ruleBasedSteps(title), noKey: true })
  }

  try {
    const prompt = `Tu es un assistant de gestion de projet pour l'I&E Lab de l'UM6P (Maroc).
Décompose cette tâche en 4 à 6 étapes concrètes et actionnables.
Chaque étape doit être courte (max 10 mots), commencer par un verbe d'action, être réaliste.

Tâche : "${title}"
${description ? `Description : "${description.slice(0, 300)}"` : ''}
${project ? `Projet : ${project.title}` : ''}

Retourne UNIQUEMENT un tableau JSON de chaînes (sans markdown) :
["étape 1", "étape 2", "étape 3", ...]`

    const text = await aiGenerate(prompt, { temperature: 0.3, maxOutputTokens: 300, apiKey: userApiKey })
    const steps = parseAiJson<string[]>(text)
    if (!Array.isArray(steps) || steps.length === 0) throw new Error()
    return NextResponse.json({ steps: steps.slice(0, 6) })
  } catch (e: any) {
    return NextResponse.json({ steps: ruleBasedSteps(title), apiError: true, errorMessage: e?.message ?? 'Erreur IA' })
  }
}

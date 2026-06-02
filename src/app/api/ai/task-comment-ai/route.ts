import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hasAiKey, aiGenerate } from '@/lib/ai/providers'

/** POST /api/ai/task-comment-ai
 * action: 'improve'         → reformule le brouillon
 * action: 'generate_update' → génère une mise à jour de progression
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profileData } = await admin
    .from('profiles').select('ai_api_key').eq('id', user.id).single()
  const userApiKey = profileData?.ai_api_key ?? null

  if (!hasAiKey(userApiKey)) {
    return NextResponse.json({ error: 'NO_KEY', noKey: true }, { status: 402 })
  }

  const { draft, task, action } = await req.json()

  try {
    let prompt: string

    if (action === 'improve') {
      if (!draft || draft.trim().length < 3) {
        return NextResponse.json({ error: 'Brouillon trop court' }, { status: 400 })
      }
      prompt = `Tu es un assistant de communication professionnelle pour l'I&E Lab de l'UM6P.
Reformule ce commentaire de manière professionnelle, claire et concise (garde le même sens, max 3 phrases).
Ne change pas les faits. Ne commence pas par "Bonjour" ou des formules de politesse.

Tâche : "${task?.title ?? ''}"
Brouillon : "${draft.trim()}"

Commentaire amélioré :`
    } else {
      // generate_update
      prompt = `Tu es un assistant de gestion de projet pour l'I&E Lab de l'UM6P.
Génère un commentaire de mise à jour de progression professionnel et concis (2-3 phrases).
Mentionne le statut actuel, ce qui a été fait ou ce qui reste, et toute information utile.

Tâche : "${task?.title ?? ''}"
Statut : ${task?.status ?? ''}
Priorité : ${task?.priority ?? ''}
${task?.due_date ? `Échéance : ${task.due_date}` : ''}
${task?.estimated_hours ? `Heures estimées : ${task.estimated_hours}h` : ''}

Commentaire de mise à jour :`
    }

    const result = await aiGenerate(prompt, { temperature: 0.4, maxOutputTokens: 150, apiKey: userApiKey })
    return NextResponse.json({ comment: result })
  } catch (e: any) {
    return NextResponse.json({ comment: '', apiError: true, errorMessage: e?.message ?? 'Erreur IA' })
  }
}

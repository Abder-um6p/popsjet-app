import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hasAiKey, aiGenerate } from '@/lib/ai/providers'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profileData } = await admin
    .from('profiles').select('ai_api_key').eq('id', user.id).single()
  const userApiKey = profileData?.ai_api_key ?? null

  const { title, comments } = await req.json()
  if (!comments || comments.length < 2) {
    return NextResponse.json({ error: 'Pas assez de commentaires à résumer' }, { status: 400 })
  }

  if (!hasAiKey(userApiKey)) {
    return NextResponse.json({ error: 'NO_KEY', noKey: true }, { status: 402 })
  }

  try {
    const thread = comments.slice(-20).map((c: any) =>
      `${c.author?.full_name ?? 'Membre'} : ${c.content.slice(0, 200)}`
    ).join('\n')

    const prompt = `Tu es un assistant de gestion de projet pour l'I&E Lab de l'UM6P.
Résume cette discussion de tâche en 2-3 phrases claires.
Mets en avant les décisions prises, les blocages mentionnés, et l'état d'avancement discuté.

Tâche : "${title}"
Discussion :
${thread}

Résumé :`

    const result = await aiGenerate(prompt, { temperature: 0.3, maxOutputTokens: 200, apiKey: userApiKey })
    return NextResponse.json({ summary: result })
  } catch (e: any) {
    return NextResponse.json({ apiError: true, errorMessage: e?.message ?? 'Erreur IA' }, { status: 500 })
  }
}

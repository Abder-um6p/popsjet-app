import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hasAiKey, aiGenerate, parseAiJson } from '@/lib/ai/providers'

export interface PopAnalysis {
  type:     'annonce' | 'idée' | 'blocage' | 'question' | 'feedback' | 'autre'
  priority: 'low' | 'medium' | 'high'
  tag:      string
  tip:      string
}

const TYPE_LABELS: Record<PopAnalysis['type'], string> = {
  annonce:  'Annonce',
  idée:     'Idée',
  blocage:  'Blocage',
  question: 'Question',
  feedback: 'Feedback',
  autre:    'Autre',
}

function ruleBasedAnalysis(content: string): PopAnalysis {
  const c = content.toLowerCase()

  const type: PopAnalysis['type'] =
    /bloqué|bloquant|problème|erreur|bug|cassé|ne fonctionne|empêche|obstacle/.test(c) ? 'blocage' :
    /pourquoi|comment|qui|quand|quelle|peut-on|est-ce que/.test(c) ? 'question' :
    /idée|suggestion|proposer|propose|et si|on pourrait|améliorer/.test(c) ? 'idée' :
    /annonce|important|attention|info|rappel|informer|aviser/.test(c) ? 'annonce' :
    /feedback|avis|retour|ressenti|opinion|commentaire/.test(c) ? 'feedback' :
    'autre'

  const priority: PopAnalysis['priority'] =
    /urgent|critique|bloquant|immédiat|asap|aujourd'hui/.test(c) ? 'high' :
    /important|prioritaire|dès que possible/.test(c) ? 'medium' :
    'low'

  const tagMap: Record<PopAnalysis['type'], string> = {
    blocage:  'technique',
    idée:     'innovation',
    annonce:  'communication',
    question: 'support',
    feedback: 'qualité',
    autre:    'général',
  }

  const tip =
    type === 'blocage' ? 'Identifiez le responsable pour débloquer la situation rapidement.' :
    type === 'idée' ? 'Développez cette idée avec des critères de succès mesurables.' :
    type === 'annonce' ? 'Assurez-vous de mentionner les personnes concernées.' :
    type === 'question' ? 'Précisez le contexte pour obtenir une réponse plus rapide.' :
    type === 'feedback' ? 'Un feedback constructif inclut une suggestion d\'amélioration.' :
    'Enrichissez votre pop avec plus de contexte.'

  return { type, priority, tag: tagMap[type], tip }
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

  const { content } = await req.json()
  if (!content || content.trim().length < 5) {
    return NextResponse.json({ error: 'Contenu trop court' }, { status: 400 })
  }

  if (!hasAiKey(userApiKey)) {
    return NextResponse.json(ruleBasedAnalysis(content))
  }

  try {
    const prompt = `Tu es un assistant pour l'I&E Lab de l'UM6P. Analyse ce message (appelé "Pop") et retourne un JSON.

Pop : "${content.slice(0, 400)}"

Retourne UNIQUEMENT ce JSON brut (sans markdown) :
{
  "type": "annonce|idée|blocage|question|feedback|autre",
  "priority": "low|medium|high",
  "tag": "mot-clé court en français (1-2 mots)",
  "tip": "conseil court et actionnable en français (1 phrase)"
}`

    const text = await aiGenerate(prompt, { temperature: 0.3, maxOutputTokens: 150, apiKey: userApiKey })
    const result = parseAiJson<PopAnalysis>(text)
    if (!result.type || !result.priority) throw new Error()
    return NextResponse.json(result)
  } catch {
    return NextResponse.json(ruleBasedAnalysis(content))
  }
}

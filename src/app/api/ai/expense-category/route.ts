import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hasAiKey, aiGenerate } from '@/lib/ai/providers'

const CATEGORIES = [
  'transport', 'hébergement', 'restauration', 'fournitures', 'équipement',
  'prestation', 'formation', 'communication', 'événement', 'logiciel',
  'impression', 'frais_bancaires', 'autre',
] as const

type Category = typeof CATEGORIES[number]

const CATEGORY_FR: Record<Category, string> = {
  transport:      'Transport',
  hébergement:    'Hébergement',
  restauration:   'Restauration',
  fournitures:    'Fournitures',
  équipement:     'Équipement',
  prestation:     'Prestation',
  formation:      'Formation',
  communication:  'Communication',
  événement:      'Événement',
  logiciel:       'Logiciel / Abonnement',
  impression:     'Impression',
  frais_bancaires:'Frais bancaires',
  autre:          'Autre',
}

function ruleBasedCategory(description: string): Category {
  const d = description.toLowerCase()
  if (/taxi|train|avion|vol|billet|carburant|transport|déplacement|uber|bus/.test(d)) return 'transport'
  if (/hôtel|hébergement|nuit|logement|airbnb/.test(d)) return 'hébergement'
  if (/repas|restaurant|déjeuner|dîner|café|buffet|traiteur|nourriture/.test(d)) return 'restauration'
  if (/papier|stylo|cartouche|fourniture|bureau|classeur|chemise/.test(d)) return 'fournitures'
  if (/ordinateur|laptop|écran|projecteur|matériel|équipement|caméra|micro/.test(d)) return 'équipement'
  if (/consultant|prestataire|freelance|sous-traitant|honoraire|facture/.test(d)) return 'prestation'
  if (/formation|atelier|workshop|séminaire|cours|certificat/.test(d)) return 'formation'
  if (/affiche|banner|flyer|publicité|com|réseaux|photo|vidéo/.test(d)) return 'communication'
  if (/événement|conférence|journée|inauguration|soirée|galatournoi/.test(d)) return 'événement'
  if (/logiciel|abonnement|licence|saas|cloud|adobe|microsoft|github/.test(d)) return 'logiciel'
  if (/impression|imprimé|tirage|print|brochure/.test(d)) return 'impression'
  if (/virement|commission|frais bancaire|transfert/.test(d)) return 'frais_bancaires'
  return 'autre'
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

  const { description } = await req.json()
  if (!description || description.trim().length < 3) {
    return NextResponse.json({ error: 'Description trop courte' }, { status: 400 })
  }

  if (!hasAiKey(userApiKey)) {
    const cat = ruleBasedCategory(description)
    return NextResponse.json({ category: cat, label: CATEGORY_FR[cat] })
  }

  try {
    const prompt = `Tu es un assistant comptable pour l'I&E Lab de l'UM6P (Maroc).
Classifie cette dépense dans l'une des catégories suivantes : ${CATEGORIES.join(', ')}

Description : "${description}"

Réponds UNIQUEMENT avec le nom de la catégorie (en minuscules, sans accent ni espace), rien d'autre.`

    const raw = (await aiGenerate(prompt, { temperature: 0.1, maxOutputTokens: 20, apiKey: userApiKey })).toLowerCase()
    const cat: Category = (CATEGORIES as readonly string[]).includes(raw)
      ? raw as Category
      : ruleBasedCategory(description)
    return NextResponse.json({ category: cat, label: CATEGORY_FR[cat] })
  } catch {
    const cat = ruleBasedCategory(description)
    return NextResponse.json({ category: cat, label: CATEGORY_FR[cat] })
  }
}

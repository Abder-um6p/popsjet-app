import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hasAiKey, aiGenerate, parseAiJson } from '@/lib/ai/providers'

export interface TaskSuggestion {
  description: string
  priority:    'low' | 'medium' | 'high' | 'urgent'
  subtasks:    string[]
  tips:        string[]
  label?:      string | null
}

// Mapping mots-clés → label étiquette
const LABEL_KEYWORDS: { label: string; keywords: RegExp }[] = [
  { label: 'transport',       keywords: /transport|deplacement|navette|billet|avion|taxi|uber|vol\b/i },
  { label: 'hebergement',     keywords: /hotel|hebergement|logement|chambre|nuit\b/i },
  { label: 'catering',        keywords: /catering|repas|restauration|traiteur|dejeuner|diner|pause-cafe|snack/i },
  { label: 'salle',           keywords: /salle|reservation|venue|espace|lieu\b/i },
  { label: 'materiel',        keywords: /materiel|equipement|fourniture|achat|commande|ordinateur|ecran/i },
  { label: 'billets_avion',   keywords: /billet.*avion|vol.*reserve|avion.*billet/i },
  { label: 'parking',         keywords: /parking|stationnement/i },
  { label: 'design',          keywords: /design|visuel|affiche|flyer|graphi|logo|charte/i },
  { label: 'presentation',    keywords: /presentation|slides|deck|powerpoint|canva/i },
  { label: 'formulaire',      keywords: /formulaire|form|inscription|sondage/i },
  { label: 'reseaux',         keywords: /reseaux|social|instagram|linkedin|twitter|facebook|tiktok/i },
  { label: 'email',           keywords: /email|mail|newsletter|campagne|mailing/i },
  { label: 'video',           keywords: /video|photo|film|captation|teaser|montage/i },
  { label: 'site_web',        keywords: /site|web|page|landing|url/i },
  { label: 'demande_achat',   keywords: /demande.*achat|bon.*commande|ordre.*achat/i },
  { label: 'validation_docs', keywords: /validation|valider|approbation|relecture|signer/i },
  { label: 'factures',        keywords: /facture|bc\b|bon.*commande|paiement|invoice/i },
  { label: 'contrats',        keywords: /contrat|convention|accord|partenariat/i },
  { label: 'rapport',         keywords: /rapport|reporting|bilan|compte-rendu|cr\b/i },
  { label: 'certificats',     keywords: /certificat|attestation|diplome/i },
]

function detectLabel(title: string): string | null {
  const t = title.normalize('NFD').replace(/[̀-ͯ]/g, '')
  for (const { label, keywords } of LABEL_KEYWORDS) {
    if (keywords.test(t)) return label
  }
  return null
}

// Fallback basé sur des règles si OpenAI n'est pas configuré
function ruleBasedSuggestion(title: string): TaskSuggestion {
  const t = title.toLowerCase()

  const priority: TaskSuggestion['priority'] =
    /urgent|critique|bloquant|asap|immédiat/.test(t) ? 'urgent' :
    /important|priorit|essentiel|obligatoire/.test(t) ? 'high' :
    /review|vérif|check|valider|relire/.test(t) ? 'low' :
    'medium'

  const subtasks: string[] = []
  const tips: string[] = []

  if (/présentation|slides|deck/.test(t)) {
    subtasks.push('Définir le plan et les sections clés')
    subtasks.push('Collecter les données et visuels')
    subtasks.push('Créer le support (PowerPoint / Canva)')
    subtasks.push('Relire et valider avec l\'équipe')
    tips.push('Prévoir du temps pour les retours avant la deadline')
  } else if (/réunion|meeting|rencontre/.test(t)) {
    subtasks.push('Préparer l\'ordre du jour')
    subtasks.push('Envoyer les invitations aux participants')
    subtasks.push('Préparer les documents nécessaires')
    subtasks.push('Rédiger le compte-rendu après la réunion')
  } else if (/rapport|reporting|bilan/.test(t)) {
    subtasks.push('Collecter les données et métriques')
    subtasks.push('Analyser les résultats')
    subtasks.push('Rédiger le rapport')
    subtasks.push('Faire valider par le responsable')
  } else if (/formation|atelier|workshop/.test(t)) {
    subtasks.push('Définir les objectifs pédagogiques')
    subtasks.push('Préparer le contenu et les supports')
    subtasks.push('Organiser la logistique (salle, matériel)')
    subtasks.push('Envoyer les convocations')
  } else if (/communiqu|email|newsletter|annonce/.test(t)) {
    subtasks.push('Rédiger le contenu')
    subtasks.push('Valider le message avec l\'équipe')
    subtasks.push('Préparer la liste des destinataires')
    subtasks.push('Programmer et envoyer')
  } else if (/développ|coder|implement|créer|build/.test(t)) {
    subtasks.push('Analyser et spécifier les besoins')
    subtasks.push('Implémenter la fonctionnalité')
    subtasks.push('Écrire les tests')
    subtasks.push('Documenter et déployer')
  } else {
    subtasks.push('Définir les critères de réussite')
    subtasks.push('Lister les étapes nécessaires')
    subtasks.push('Vérifier et valider le livrable')
  }

  const description = `Cette tâche consiste à ${title.charAt(0).toLowerCase() + title.slice(1)}.\n\n` +
    `**Objectif :** Décrire ici le résultat attendu.\n` +
    `**Contexte :** Ajouter le contexte utile pour la réalisation.\n` +
    `**Critères d'acceptation :** Préciser comment valider que la tâche est terminée.`

  return { description, priority, subtasks, tips, label: detectLabel(title) }
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profileData } = await admin
    .from('profiles').select('ai_api_key').eq('id', user.id).single()
  const userApiKey = profileData?.ai_api_key ?? null

  const { title, projectTitle } = await req.json()
  if (!title || title.trim().length < 3) {
    return NextResponse.json({ error: 'Titre trop court' }, { status: 400 })
  }

  if (!hasAiKey(userApiKey)) {
    return NextResponse.json(ruleBasedSuggestion(title.trim()))
  }

  try {
    const prompt = `Tu es un assistant de gestion de projet pour l'I&E Lab de l'UM6P (Maroc).
L'utilisateur crée une tâche dans un projet${projectTitle ? ` appelé "${projectTitle}"` : ''}.

Titre de la tâche : "${title}"

Génère en JSON (sans markdown, juste le JSON brut) :
{
  "description": "description courte et professionnelle en français (2-3 phrases max)",
  "priority": "low | medium | high | urgent",
  "subtasks": ["sous-tâche 1", "sous-tâche 2", "sous-tâche 3"],
  "tips": ["conseil court et actionnable"],
  "label": "identifiant étiquette ou null"
}

Règles :
- description : claire, orientée résultat, en français
- priority : urgent si délai serré ou mots-clés critique/bloquant, sinon adapté au contexte
- subtasks : 3 à 4 étapes concrètes pour réaliser cette tâche
- tips : 1 conseil pratique lié au contexte UM6P/I&E Lab
- label : choisir parmi ces valeurs uniquement (ou null si aucune ne correspond) :
  hebergement, parking, transport, catering, billets_avion, salle, materiel, autre_log,
  design, presentation, formulaire, reseaux, email, video, site_web, autre_com,
  demande_achat, validation_docs, factures, contrats, rapport, certificats, autre_adm`

    const text = await aiGenerate(prompt, { temperature: 0.4, maxOutputTokens: 450, apiKey: userApiKey })
    const suggestion = parseAiJson<TaskSuggestion>(text)
    // Complète avec le label détecté par règles si l'IA n'en a pas trouvé
    if (!suggestion.label) suggestion.label = detectLabel(title)
    return NextResponse.json(suggestion)
  } catch {
    return NextResponse.json(ruleBasedSuggestion(title.trim()))
  }
}

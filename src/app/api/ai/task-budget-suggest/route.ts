import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hasAiKey, aiGenerate, parseAiJson } from '@/lib/ai/providers'

/**
 * POST /api/ai/task-budget-suggest
 * Suggère la ligne budgétaire la plus pertinente pour une tâche.
 *
 * Body : { title: string, projectId: string }
 * Réponse : { id, code, designation, confidence: 'high'|'medium'|'low' } | null
 */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { title, projectId } = await req.json()
  if (!title || !projectId) return NextResponse.json(null)

  const admin = createAdminClient()

  // Récupère le programme lié au projet
  const { data: project } = await admin
    .from('projects').select('program_id').eq('id', projectId).single()
  if (!project?.program_id) return NextResponse.json(null)

  // Récupère les lignes budgétaires actives du programme
  const { data: lines } = await admin
    .from('budget_references')
    .select('id, code, designation, notes')
    .eq('program_id', project.program_id)
    .eq('is_active', true)
    .is('deleted_at', null)
    .order('code')

  if (!lines || lines.length === 0) return NextResponse.json(null)

  // ── Matching IA si disponible ─────────────────────────────────────────────
  if (hasAiKey()) {
    const prompt = `Tu es un assistant de gestion de projet. Associe la tâche à la ligne budgétaire la plus appropriée.

Tâche : "${title}"

Lignes budgétaires disponibles :
${lines.map(l => `- id: ${l.id} | code: ${l.code} | libellé: ${l.designation}${l.notes ? ` (${l.notes})` : ''}`).join('\n')}

Réponds UNIQUEMENT avec ce JSON (aucun texte autour) :
{
  "id": "uuid de la ligne choisie ou null si aucune ne correspond",
  "confidence": "high | medium | low"
}

Règles :
- "high" si la correspondance est évidente (ex: tâche "Réservation transport" → ligne "Transport")
- "medium" si probable mais pas certain
- "low" si c'est une supposition
- null si vraiment aucune ligne ne correspond`

    try {
      const raw = await aiGenerate(prompt, { maxOutputTokens: 200 })
      const parsed = parseAiJson<{ id: string | null; confidence: string }>(raw)
      if (parsed?.id) {
        const matched = lines.find(l => l.id === parsed.id)
        if (matched) {
          return NextResponse.json({
            id: matched.id,
            code: matched.code,
            designation: matched.designation,
            confidence: parsed.confidence ?? 'medium',
          })
        }
      }
    } catch { /* fallback règles */ }
  }

  // ── Fallback : matching par mots-clés ─────────────────────────────────────
  const titleLower = title.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

  const KEYWORD_MAP: Record<string, string[]> = {
    transport: ['transport', 'deplacement', 'voiture', 'bus', 'billet', 'avion', 'taxi', 'uber', 'navette'],
    hebergement: ['hotel', 'hebergement', 'logement', 'chambre', 'nuit'],
    catering: ['catering', 'repas', 'restauration', 'traiteur', 'dejeuner', 'diner', 'pause'],
    communication: ['communication', 'design', 'visuel', 'affiche', 'flyer', 'reseaux', 'email', 'campagne'],
    materiel: ['materiel', 'equipement', 'fourniture', 'achat', 'commande'],
    salle: ['salle', 'reservation', 'lieu', 'venue', 'espace'],
  }

  let bestMatch: typeof lines[0] | null = null
  let bestScore = 0

  for (const line of lines) {
    const lineLower = (line.designation + ' ' + (line.notes ?? '') + ' ' + line.code)
      .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

    // Score 1 : correspondance directe
    let score = 0
    const titleWords = titleLower.split(/\s+/).filter((w: string) => w.length > 3)
    for (const word of titleWords) {
      if (lineLower.includes(word)) score += 2
    }

    // Score 2 : mots-clés thématiques
    for (const [, keywords] of Object.entries(KEYWORD_MAP)) {
      const inTitle = keywords.some(k => titleLower.includes(k))
      const inLine  = keywords.some(k => lineLower.includes(k))
      if (inTitle && inLine) score += 3
    }

    if (score > bestScore) {
      bestScore = score
      bestMatch = line
    }
  }

  if (bestMatch && bestScore >= 2) {
    return NextResponse.json({
      id: bestMatch.id,
      code: bestMatch.code,
      designation: bestMatch.designation,
      confidence: bestScore >= 5 ? 'high' : 'medium',
    })
  }

  return NextResponse.json(null)
}

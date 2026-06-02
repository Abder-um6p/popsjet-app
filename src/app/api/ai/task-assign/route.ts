import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { hasAiKey, aiGenerate, parseAiJson } from '@/lib/ai/providers'

/**
 * POST /api/ai/task-assign
 * Body: { projectId, title, tasks: [{assigned_to, status}], members: [{id, full_name}] }
 * Returns: { memberId, full_name, reason }
 */
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
  const { title, tasks, members } = body

  if (!members || members.length === 0) {
    return NextResponse.json({ error: 'Aucun membre dans le projet' }, { status: 400 })
  }

  // Calcul de la charge : nombre de tâches actives par membre
  const activeTasks = (tasks ?? []).filter((t: any) => t.status !== 'done')
  const workload: Record<string, number> = {}
  for (const m of members) workload[m.id] = 0
  for (const t of activeTasks) {
    if (t.assigned_to && workload[t.assigned_to] !== undefined) {
      workload[t.assigned_to]++
    }
  }

  // Membre avec le moins de tâches actives
  const leastBusy = members.reduce((best: any, m: any) =>
    (workload[m.id] ?? 0) < (workload[best.id] ?? 0) ? m : best
  , members[0])

  const fallback = () => {
    const count = workload[leastBusy.id] ?? 0
    return NextResponse.json({
      memberId:  leastBusy.id,
      full_name: leastBusy.full_name,
      reason:    `${leastBusy.full_name} a ${count} tâche${count !== 1 ? 's' : ''} active${count !== 1 ? 's' : ''} — c'est le membre le moins chargé.`,
    })
  }

  if (!hasAiKey(userApiKey)) return fallback()

  try {
    const workloadSummary = members.map((m: any) =>
      `- ${m.full_name} (id: ${m.id}) : ${workload[m.id] ?? 0} tâche(s) active(s)`
    ).join('\n')

    const prompt = `Tu es un assistant de gestion de projet pour l'I&E Lab de l'UM6P.
Suggère le meilleur membre à assigner à cette tâche, en tenant compte de la charge de travail actuelle.

Tâche à assigner : "${title}"

Charge actuelle des membres :
${workloadSummary}

Réponds en JSON brut (sans markdown) :
{"memberId":"<id exact>","full_name":"<nom>","reason":"<raison courte en français, max 1 phrase>"}`

    const text = await aiGenerate(prompt, { temperature: 0.3, maxOutputTokens: 150, apiKey: userApiKey })
    const result = parseAiJson<{ memberId: string; full_name: string; reason: string }>(text)
    const validMember = members.find((m: any) => m.id === result.memberId)
    if (!validMember) throw new Error('invalid member')
    return NextResponse.json(result)
  } catch {
    return fallback()
  }
}

/**
 * POST /api/slack/notify
 * Point d'entrée unique pour toutes les notifications Slack depuis le client.
 * Body: { event: SlackEvent }
 * Fire & forget depuis les composants client.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSlackIntegration } from '@/lib/integrations/slack/index'
import { notifySlack, type SlackEvent } from '@/lib/integrations/slack/notifications'

export async function POST(req: NextRequest) {
  // Auth minimale — juste vérifier que l'utilisateur est connecté
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const slack = await getSlackIntegration()
  if (!slack) return NextResponse.json({ skipped: true })

  const body = await req.json()
  const event: SlackEvent = body.event

  if (!event?.type) return NextResponse.json({ error: 'event.type manquant' }, { status: 400 })

  const ok = await notifySlack(slack.config, slack.options, event)
  return NextResponse.json({ ok })
}

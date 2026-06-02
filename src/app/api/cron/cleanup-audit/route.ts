import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * GET /api/cron/cleanup-audit
 *
 * Exécute cleanup_old_audit_logs() — VH-06.
 * Supprime : logs non-financiers > 90 jours, logs financiers > 5 ans.
 *
 * Sécurité : requiert Authorization: Bearer <CRON_SECRET>
 *
 * Configurer dans vercel.json :
 *   { "path": "/api/cron/cleanup-audit", "schedule": "0 2 * * 0" }
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/cleanup-audit] CRON_SECRET non défini — endpoint refusé. Définissez CRON_SECRET dans les variables d\'environnement.')
    return NextResponse.json(
      { error: 'Endpoint désactivé : CRON_SECRET non configuré.' },
      { status: 503 }
    )
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()
  const now   = new Date().toISOString()

  try {
    const { error } = await admin.rpc('cleanup_old_audit_logs')
    if (error) throw new Error(error.message)

    // Auto-log de l'exécution (non-bloquant)
    await admin.from('audit_logs').insert({
      user_id:     null,
      user_email:  'cron@system',
      action:      'cron_cleanup_audit_logs',
      entity_type: 'system',
      entity_id:   null,
      entity_name: 'Cleanup audit logs automatique',
      new_data:    { executed_at: now },
    }).catch(() => {})

    return NextResponse.json({ ok: true, executed_at: now })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}

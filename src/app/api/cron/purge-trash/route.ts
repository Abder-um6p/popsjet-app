import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/server'

/**
 * GET /api/cron/purge-trash
 *
 * Supprime définitivement les éléments dans la corbeille depuis plus de 30 jours.
 * Conforme RGPD — TR-05.
 *
 * Sécurité : requiert le header Authorization: Bearer <CRON_SECRET>
 * Configurer CRON_SECRET dans les variables d'environnement.
 *
 * Configurer dans Vercel Cron Jobs (vercel.json) :
 *   { "path": "/api/cron/purge-trash", "schedule": "0 3 * * *" }
 * Ou via pg_cron Supabase (migration 008_cron_cleanup.sql).
 */
export async function GET(req: NextRequest) {
  // ── Auth cron — CRON_SECRET obligatoire ──────────────────────────────────
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron/purge-trash] CRON_SECRET non défini — endpoint refusé. Définissez CRON_SECRET dans les variables d\'environnement.')
    return NextResponse.json(
      { error: 'Endpoint désactivé : CRON_SECRET non configuré.' },
      { status: 503 }
    )
  }
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin  = createAdminClient()
  const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const now    = new Date().toISOString()
  const report: Record<string, number> = {}

  // ── 1. Tasks ──────────────────────────────────────────────────────────────
  try {
    // Récupérer les task_documents avant suppression pour cleanup Storage
    const { data: expiredTasks } = await admin
      .from('tasks').select('id').not('deleted_at', 'is', null).lte('deleted_at', cutoff)

    if (expiredTasks && expiredTasks.length > 0) {
      const taskIds = expiredTasks.map((t: any) => t.id)

      // Storage cleanup pour task_documents
      const { data: taskDocs } = await admin
        .from('task_documents').select('file_path').in('task_id', taskIds)
      const paths = (taskDocs ?? []).map((d: any) => d.file_path).filter(Boolean)
      if (paths.length > 0) {
        await admin.storage.from('task-documents').remove(paths).catch(() => {})
      }

      const { count } = await admin.from('tasks').delete({ count: 'exact' })
        .not('deleted_at', 'is', null).lte('deleted_at', cutoff)
      report.tasks = count ?? 0
    } else {
      report.tasks = 0
    }
  } catch (e) { report.tasks_error = String(e) as any }

  // ── 2. Documents ──────────────────────────────────────────────────────────
  try {
    const { data: expiredDocs } = await admin
      .from('documents').select('file_path, bucket_name')
      .not('deleted_at', 'is', null).lte('deleted_at', cutoff)

    if (expiredDocs && expiredDocs.length > 0) {
      // Group by bucket for Storage cleanup
      const byBucket: Record<string, string[]> = {}
      for (const d of expiredDocs) {
        const bucket = (d as any).bucket_name ?? 'documents'
        if (!byBucket[bucket]) byBucket[bucket] = []
        if ((d as any).file_path) byBucket[bucket].push((d as any).file_path)
      }
      for (const [bucket, filePaths] of Object.entries(byBucket)) {
        if (filePaths.length > 0) {
          await admin.storage.from(bucket).remove(filePaths).catch(() => {})
        }
      }

      const { count } = await admin.from('documents').delete({ count: 'exact' })
        .not('deleted_at', 'is', null).lte('deleted_at', cutoff)
      report.documents = count ?? 0
    } else {
      report.documents = 0
    }
  } catch (e) { report.documents_error = String(e) as any }

  // ── 3. Expenses ───────────────────────────────────────────────────────────
  try {
    const { data: expiredExpenses } = await admin
      .from('expenses').select('receipt_path')
      .not('deleted_at', 'is', null).lte('deleted_at', cutoff)

    if (expiredExpenses && expiredExpenses.length > 0) {
      const receiptPaths = (expiredExpenses ?? []).map((e: any) => e.receipt_path).filter(Boolean)
      if (receiptPaths.length > 0) {
        await admin.storage.from('receipts').remove(receiptPaths).catch(() => {})
      }

      const { count } = await admin.from('expenses').delete({ count: 'exact' })
        .not('deleted_at', 'is', null).lte('deleted_at', cutoff)
      report.expenses = count ?? 0
    } else {
      report.expenses = 0
    }
  } catch (e) { report.expenses_error = String(e) as any }

  // ── 4. Programs ───────────────────────────────────────────────────────────
  try {
    const { count } = await admin.from('programs').delete({ count: 'exact' })
      .not('deleted_at', 'is', null).lte('deleted_at', cutoff)
    report.programs = count ?? 0
  } catch (e) { report.programs_error = String(e) as any }

  // ── 5. Projects ───────────────────────────────────────────────────────────
  try {
    const { count } = await admin.from('projects').delete({ count: 'exact' })
      .not('deleted_at', 'is', null).lte('deleted_at', cutoff)
    report.projects = count ?? 0
  } catch (e) { report.projects_error = String(e) as any }

  // ── 6. Pops ───────────────────────────────────────────────────────────────
  try {
    const { count } = await admin.from('pops').delete({ count: 'exact' })
      .not('deleted_at', 'is', null).lte('deleted_at', cutoff)
    report.pops = count ?? 0
  } catch (e) { report.pops_error = String(e) as any }

  // ── 7. Budget references ──────────────────────────────────────────────────
  try {
    const { count } = await admin.from('budget_references').delete({ count: 'exact' })
      .not('deleted_at', 'is', null).lte('deleted_at', cutoff)
    report.budget_references = count ?? 0
  } catch (e) { report.budget_refs_error = String(e) as any }

  // ── Audit log de la purge ─────────────────────────────────────────────────
  const totalDeleted = Object.values(report)
    .filter((v): v is number => typeof v === 'number')
    .reduce((s, v) => s + v, 0)

  try {
    await admin.from('audit_logs').insert({
      user_id:     null,
      user_email:  'cron@system',
      action:      'cron_purge_trash',
      entity_type: 'system',
      entity_id:   null,
      entity_name: 'Purge corbeille automatique',
      new_data:    { ...report, cutoff, executed_at: now, total_deleted: totalDeleted },
    })
  } catch { /* swallow */ }

  return NextResponse.json({
    ok:            true,
    executed_at:   now,
    cutoff,
    total_deleted: totalDeleted,
    details:       report,
  })
}

-- ============================================================
-- Migration 008 — Cron jobs : purge corbeille + audit logs
-- À exécuter dans Supabase → SQL Editor
-- Nécessite l'extension pg_cron (activée dans Supabase par défaut)
-- ============================================================

-- ── Activer l'extension pg_cron ───────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ── Job 1 : purge corbeille — tous les jours à 3h du matin ───────────────────
-- Appelle l'endpoint Next.js /api/cron/purge-trash
-- Remplacer <APP_URL> et <CRON_SECRET> par vos valeurs réelles
-- (ou configurer via Vercel Cron Jobs dans vercel.json — voir commentaire ci-dessous)
SELECT cron.schedule(
  'purge-trash-daily',
  '0 3 * * *',
  $$
  SELECT net.http_get(
    url      := current_setting('app.url') || '/api/cron/purge-trash',
    headers  := jsonb_build_object('Authorization', 'Bearer ' || current_setting('app.cron_secret'))
  )
  $$
);

-- ── Job 2 : cleanup audit logs — tous les dimanches à 2h du matin ────────────
SELECT cron.schedule(
  'cleanup-audit-logs-weekly',
  '0 2 * * 0',
  $$ SELECT public.cleanup_old_audit_logs() $$
);

-- ── Pour vérifier les jobs planifiés ─────────────────────────────────────────
-- SELECT * FROM cron.job;

-- ── Alternative Vercel Cron Jobs (sans pg_cron) ───────────────────────────────
-- Ajouter dans vercel.json à la racine du projet :
-- {
--   "crons": [
--     { "path": "/api/cron/purge-trash", "schedule": "0 3 * * *" }
--   ]
-- }
-- Et définir CRON_SECRET dans les variables d'environnement Vercel.
-- Vercel injecte automatiquement le header Authorization.

-- ============================================================
-- Migration 009 — Notifications : colonnes related_id / related_type
-- Idempotente — IF NOT EXISTS
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- Ces colonnes sont utilisées par le code depuis v1.4 pour les deep-links
-- (ex: clic sur une notification → ouvre la tâche concernée).
-- La migration initiale notifications.sql ne les incluait pas.
-- Cette migration les ajoute de manière sécurisée.

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS related_id   UUID,
  ADD COLUMN IF NOT EXISTS related_type TEXT;

-- Index partiel pour lookup rapide des notifications avec lien
CREATE INDEX IF NOT EXISTS idx_notifications_related
  ON public.notifications(related_type, related_id)
  WHERE related_id IS NOT NULL;

-- Rafraîchit le cache PostgREST
NOTIFY pgrst, 'reload schema';

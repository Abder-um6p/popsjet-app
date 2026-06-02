-- ============================================================
-- Migration 006 — Améliorations tâches v2
-- Colonnes : label, ref_number, is_draft, google_folder
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- ── Étiquette métier (besoin du projet associé) ───────────────
-- Valeurs : hebergement, parking, transport, catering, billets_avion,
--           salle, materiel, autre_log,
--           design, presentation, formulaire, reseaux, email, video, site_web, autre_com,
--           demande_achat, validation_docs, factures, contrats, rapport, certificats, autre_adm
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS label TEXT;

-- ── Numéro de référence unique par projet (ex: WKS-FORM-24-T003) ─────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS ref_number TEXT;

-- ── Brouillon : tâche créée depuis les besoins projet, à compléter ───────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS is_draft BOOLEAN NOT NULL DEFAULT false;

-- ── Dossier Google Drive de la tâche ─────────────────────────
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS google_folder_id  TEXT,
  ADD COLUMN IF NOT EXISTS google_folder_url TEXT;

-- ── Index sur ref_number pour lookup rapide ───────────────────
CREATE INDEX IF NOT EXISTS idx_tasks_ref_number ON tasks (ref_number);
CREATE INDEX IF NOT EXISTS idx_tasks_label      ON tasks (label) WHERE label IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tasks_is_draft   ON tasks (project_id, is_draft) WHERE is_draft = true;

-- ── Rafraîchit le cache PostgREST ────────────────────────────
NOTIFY pgrst, 'reload schema';

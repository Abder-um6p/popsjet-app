-- ============================================================
-- Migration 005 — Colonnes manquantes programs + dossiers Drive/SharePoint
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- ── Colonnes v2 manquantes sur programs ───────────────────────
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS is_active       BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS objectives      TEXT,
  ADD COLUMN IF NOT EXISTS color           TEXT,
  ADD COLUMN IF NOT EXISTS deleted_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deleted_by      UUID REFERENCES auth.users(id);

-- ── Colonnes dossiers Drive/SharePoint sur programs ──────────
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS google_folder_id      TEXT,
  ADD COLUMN IF NOT EXISTS google_folder_url     TEXT,
  ADD COLUMN IF NOT EXISTS sharepoint_folder_id  TEXT,
  ADD COLUMN IF NOT EXISTS sharepoint_folder_url TEXT;

-- ── Colonnes dossiers Drive sur projects ─────────────────────
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS google_folder_id      TEXT,
  ADD COLUMN IF NOT EXISTS google_folder_url     TEXT;

-- (sharepoint_folder_id et sharepoint_folder_url déjà ajoutés en migration 004)

-- ── Rafraîchit le cache PostgREST ────────────────────────────
NOTIFY pgrst, 'reload schema';

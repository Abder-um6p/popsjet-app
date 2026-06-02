-- ============================================================
-- Migration 003 — Colonnes manquantes détectées par analyse data-flow
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- ─── 1. projects.budget_currency ─────────────────────────────
-- Le formulaire collectait MAD/EUR/USD mais ne le persistait pas.
-- La devise est maintenant incluse dans l'insert côté code.
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS budget_currency TEXT NOT NULL DEFAULT 'MAD'
  CHECK (budget_currency IN ('MAD', 'EUR', 'USD'));

-- ─── 2. expenses.is_self_reported ────────────────────────────
-- Mode "Déjà réalisée" auto-approuve la dépense et marque ce flag.
-- Sans la colonne, le flag était silencieusement ignoré.
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS is_self_reported BOOLEAN NOT NULL DEFAULT false;

-- ─── 3. expenses.assignees ───────────────────────────────────
-- "Personnes concernées" collectées dans le form mais perdues sans cette colonne.
-- Le code a un fallback gracieux, mais les données n'étaient pas sauvegardées.
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS assignees UUID[] NOT NULL DEFAULT '{}';

-- ─── Index utile sur assignees (recherche par personne concernée) ─
CREATE INDEX IF NOT EXISTS idx_expenses_assignees
  ON expenses USING GIN (assignees);

-- ─── Rappel : migrations V2 programmes (si pas encore appliquées) ──────
-- ALTER TABLE programs ADD COLUMN IF NOT EXISTS objectives TEXT;
-- ALTER TABLE programs ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN NOT NULL DEFAULT false;
-- CREATE TABLE IF NOT EXISTS program_members ( ... );
-- CREATE TABLE IF NOT EXISTS program_documents ( ... );
-- (voir migrations/001_programs_v2.sql si elle existe)

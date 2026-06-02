-- ============================================================
-- add_expense_assignees.sql
-- Ajoute la colonne assignees (UUID[]) sur la table expenses
-- et un flag is_self_reported pour distinguer les dépenses
-- archivées directement des dépenses approuvées par un admin.
-- Script idempotent.
-- ============================================================

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'assignees'
  ) THEN
    ALTER TABLE expenses ADD COLUMN assignees UUID[] DEFAULT '{}';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'is_self_reported'
  ) THEN
    ALTER TABLE expenses ADD COLUMN is_self_reported BOOLEAN DEFAULT FALSE;
  END IF;
END $$;

-- Index GIN pour recherche efficace dans le tableau UUID
CREATE INDEX IF NOT EXISTS idx_expenses_assignees ON expenses USING GIN (assignees);

NOTIFY pgrst, 'reload schema';

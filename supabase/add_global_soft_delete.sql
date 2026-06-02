-- ============================================================
-- add_global_soft_delete.sql — v1.8.0
-- Ajoute les colonnes de soft-delete sur toutes les entités
-- qui en manquent. Script idempotent (DO $$...IF NOT EXISTS).
-- ============================================================

-- ── PROGRAMS ────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'programs' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE programs ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'programs' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE programs ADD COLUMN deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── EXPENSES ────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE expenses ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE expenses ADD COLUMN deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── DOCUMENTS ───────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE documents ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'documents' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE documents ADD COLUMN deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── POPS ────────────────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pops' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE pops ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pops' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE pops ADD COLUMN deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── BUDGET_REFERENCES ────────────────────────────────────────
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_references' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE budget_references ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'budget_references' AND column_name = 'deleted_by'
  ) THEN
    ALTER TABLE budget_references ADD COLUMN deleted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── Index pour performances de la corbeille ──────────────────
CREATE INDEX IF NOT EXISTS idx_programs_deleted_at     ON programs(deleted_at)     WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_expenses_deleted_at     ON expenses(deleted_at)     WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_documents_deleted_at    ON documents(deleted_at)    WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pops_deleted_at         ON pops(deleted_at)         WHERE deleted_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budget_refs_deleted_at  ON budget_references(deleted_at) WHERE deleted_at IS NOT NULL;

-- ── Notifier PostgREST du changement de schéma ───────────────
NOTIFY pgrst, 'reload schema';

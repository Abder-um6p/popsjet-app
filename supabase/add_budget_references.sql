-- ============================================================
-- ADD BUDGET REFERENCES — Jet Pops v1.7
-- Exécuter dans Supabase > SQL Editor (service_role).
-- Idempotent — peut être relancé sans risque.
--
-- Objet : référentiel léger de codes budgétaires par programme,
-- pour standardiser la saisie des tâches et des dépenses.
-- Pas de montants, pas de calculs : juste un libellé + un code.
-- ============================================================

-- ─── 1. Table budget_references ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.budget_references (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id   UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  code         TEXT NOT NULL,
  designation  TEXT NOT NULL,
  notes        TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT budget_references_program_code_unique UNIQUE (program_id, code)
);

-- ─── 2. Colonnes FK optionnelles sur tasks / expenses ────────────────────────

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'tasks'
      AND column_name = 'budget_reference_id'
  ) THEN
    ALTER TABLE public.tasks
      ADD COLUMN budget_reference_id UUID
      REFERENCES public.budget_references(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'expenses'
      AND column_name = 'budget_reference_id'
  ) THEN
    ALTER TABLE public.expenses
      ADD COLUMN budget_reference_id UUID
      REFERENCES public.budget_references(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ─── 3. Index ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_budget_references_program_id
  ON public.budget_references(program_id);

CREATE INDEX IF NOT EXISTS idx_budget_references_active
  ON public.budget_references(program_id, is_active);

CREATE INDEX IF NOT EXISTS idx_tasks_budget_reference_id
  ON public.tasks(budget_reference_id)
  WHERE budget_reference_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_budget_reference_id
  ON public.expenses(budget_reference_id)
  WHERE budget_reference_id IS NOT NULL;

-- ─── 4. Trigger updated_at ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_budget_references_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_budget_references_updated_at'
  ) THEN
    CREATE TRIGGER trg_budget_references_updated_at
      BEFORE UPDATE ON public.budget_references
      FOR EACH ROW EXECUTE FUNCTION public.set_budget_references_updated_at();
  END IF;
END $$;

-- ─── 5. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.budget_references ENABLE ROW LEVEL SECURITY;

-- SELECT : tout utilisateur authentifié peut lire les références
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'budget_references'
      AND policyname = 'budget_references_select'
  ) THEN
    CREATE POLICY "budget_references_select" ON public.budget_references
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- INSERT : admin / directeur / chef_projet uniquement
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'budget_references'
      AND policyname = 'budget_references_insert'
  ) THEN
    CREATE POLICY "budget_references_insert" ON public.budget_references
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'directeur', 'chef_projet')
        )
      );
  END IF;
END $$;

-- UPDATE : admin / directeur / chef_projet uniquement
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'budget_references'
      AND policyname = 'budget_references_update'
  ) THEN
    CREATE POLICY "budget_references_update" ON public.budget_references
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'directeur', 'chef_projet')
        )
      );
  END IF;
END $$;

-- DELETE : admin / directeur uniquement (suppression définitive)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'budget_references'
      AND policyname = 'budget_references_delete'
  ) THEN
    CREATE POLICY "budget_references_delete" ON public.budget_references
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'directeur')
        )
      );
  END IF;
END $$;

-- ─── 6. Recharger le cache PostgREST ─────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

SELECT 'add_budget_references.sql appliqué' AS result;

-- ============================================================
-- ADD TASK ACCEPTANCE FLOW — Jet Pops v1.4
-- Exécuter dans Supabase > SQL Editor (service_role)
-- Idempotent — peut être relancé sans risque.
--
-- ⚠️  ALTER TYPE ... ADD VALUE doit s'exécuter hors transaction.
--    Si tu colles tout le fichier d'un coup dans le SQL Editor,
--    Supabase le fait pour toi. Sinon lance la section 0 séparément.
-- ============================================================

-- ─── 0. Étendre l'enum task_status (v1.4) ────────────────────────────────────
-- Valeurs ajoutées : pending_acceptance, refused, blocked, review
-- (review et blocked étaient référencés dans le code TS mais absents de l'enum DB)

ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'pending_acceptance';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'refused';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'blocked';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'review';

-- ─── 1. Nouvelles colonnes sur tasks ─────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_by       UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_acceptance BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refused_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refused_reason    TEXT,
  ADD COLUMN IF NOT EXISTS refused_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- ─── 2. Index ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by         ON public.tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_tasks_pending_acceptance  ON public.tasks(pending_acceptance) WHERE pending_acceptance = true;
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to         ON public.tasks(assigned_to);

-- ─── 3. Table d'activité ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,  -- 'status_change' | 'accepted' | 'refused' | 'comment' | 'assigned' | 'created'
  old_value   TEXT,
  new_value   TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON public.task_activity_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_created ON public.task_activity_logs(created_at DESC);

-- ─── 4. RLS sur task_activity_logs ───────────────────────────────────────────
-- CREATE POLICY IF NOT EXISTS n'existe pas en PostgreSQL — utiliser DO block

ALTER TABLE public.task_activity_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'task_activity_logs'
      AND policyname = 'task_activity_select'
  ) THEN
    CREATE POLICY "task_activity_select" ON public.task_activity_logs
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'task_activity_logs'
      AND policyname = 'task_activity_insert'
  ) THEN
    CREATE POLICY "task_activity_insert" ON public.task_activity_logs
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

-- ─── 5. Recharger le cache PostgREST ─────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

SELECT 'add_task_acceptance.sql appliqué avec succès' AS result;

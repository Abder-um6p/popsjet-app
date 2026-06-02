-- ============================================================
-- SEED TEST TASKS — Jet Pops v1.4
-- Crée 2 tâches de test en statut 'pending_acceptance'
-- pour valider le workflow accept/refuse.
--
-- Idempotent — peut être relancé sans risque (vérification par titre).
-- Exécuter dans Supabase > SQL Editor (service_role).
-- ============================================================

-- ─── 1. add_task_base_columns.sql (inlined) ─────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS sort_order       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_hours  NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS actual_hours     NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS assigned_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_tasks_project_sort ON public.tasks(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to  ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at   ON public.tasks(deleted_at) WHERE deleted_at IS NULL;

-- ─── 2. add_task_acceptance.sql (inlined) ───────────────────

-- Étendre l'enum task_status avec les valeurs v1.4 (doit être hors transaction).
-- ALTER TYPE ... ADD VALUE IF NOT EXISTS — PG 9.6+
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'pending_acceptance';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'refused';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'blocked';
ALTER TYPE public.task_status ADD VALUE IF NOT EXISTS 'review';

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS assigned_by        UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS pending_acceptance BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS accepted_at        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refused_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refused_reason     TEXT,
  ADD COLUMN IF NOT EXISTS refused_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by         ON public.tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_tasks_pending_acceptance  ON public.tasks(pending_acceptance) WHERE pending_acceptance = true;
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to         ON public.tasks(assigned_to);

CREATE TABLE IF NOT EXISTS public.task_activity_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id     UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  action      TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  note        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_task_activity_task_id ON public.task_activity_logs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_activity_created ON public.task_activity_logs(created_at DESC);

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

-- ─── 3. Insertion des 2 tâches de test ──────────────────────

DO $$
DECLARE
  v_user_id     UUID;
  v_project_id  UUID;
BEGIN
  -- Récupérer l'utilisateur cible
  SELECT id INTO v_user_id
  FROM public.profiles
  WHERE email = 'haddad.abderrahmane0@gmail.com'
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Utilisateur haddad.abderrahmane0@gmail.com introuvable dans profiles';
  END IF;

  -- Trouver un projet actif
  SELECT id INTO v_project_id
  FROM public.projects
  WHERE status = 'active'
    AND deleted_at IS NULL
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_project_id IS NULL THEN
    RAISE EXCEPTION 'Aucun projet actif trouvé (status=active, deleted_at IS NULL)';
  END IF;

  -- Task 1
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE title = 'Préparer la logistique du workshop'
      AND project_id = v_project_id
  ) THEN
    INSERT INTO public.tasks (
      project_id, title, description, assigned_to, assigned_by,
      status, priority, due_date, created_by, pending_acceptance
    ) VALUES (
      v_project_id,
      'Préparer la logistique du workshop',
      'Coordonner la réservation de la salle, le matériel et les intervenants pour le prochain workshop I&E.',
      v_user_id,
      v_user_id,
      'pending_acceptance',
      'high',
      NOW() + INTERVAL '5 days',
      v_user_id,
      true
    );
  END IF;

  -- Task 2
  IF NOT EXISTS (
    SELECT 1 FROM public.tasks
    WHERE title = 'Créer le deck de présentation de l''événement'
      AND project_id = v_project_id
  ) THEN
    INSERT INTO public.tasks (
      project_id, title, description, assigned_to, assigned_by,
      status, priority, due_date, created_by, pending_acceptance
    ) VALUES (
      v_project_id,
      'Créer le deck de présentation de l''événement',
      'Concevoir une présentation Canva/PowerPoint pour présenter l''événement aux participants et partenaires.',
      v_user_id,
      v_user_id,
      'pending_acceptance',
      'medium',
      NOW() + INTERVAL '7 days',
      v_user_id,
      true
    );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';

SELECT 'seed_test_tasks.sql appliqué avec succès' AS result;

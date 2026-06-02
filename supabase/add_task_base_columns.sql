-- ============================================================
-- ADD TASK BASE COLUMNS — Jet Pops
-- Colonnes de base manquantes dans certaines installs
-- Exécuter AVANT add_task_acceptance.sql
-- Idempotent — peut être relancé sans risque.
-- ============================================================

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS sort_order       INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS estimated_hours  NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS actual_hours     NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS description      TEXT,
  ADD COLUMN IF NOT EXISTS assigned_by      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS deleted_at       TIMESTAMPTZ;

-- Index utile pour les listes triées
CREATE INDEX IF NOT EXISTS idx_tasks_project_sort ON public.tasks(project_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_to  ON public.tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_tasks_deleted_at   ON public.tasks(deleted_at) WHERE deleted_at IS NULL;

NOTIFY pgrst, 'reload schema';

SELECT 'add_task_base_columns.sql appliqué avec succès' AS result;

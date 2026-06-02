-- ============================================================
-- ADD TASK UNDO / SOFT-DELETE COLUMNS — Jet Pops v1.6
-- Exécuter dans Supabase > SQL Editor (service_role)
-- Idempotent — peut être relancé sans risque.
-- ============================================================

-- ─── 1. Nouvelles colonnes sur tasks ─────────────────────────────────────────

ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS deleted_by            UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS acceptance_reset_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refusal_override_at   TIMESTAMPTZ;

-- ─── 2. Index ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tasks_deleted_by ON public.tasks(deleted_by);

-- ─── 3. Recharger le cache PostgREST ─────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

SELECT 'add_task_undo_delete.sql appliqué avec succès' AS result;

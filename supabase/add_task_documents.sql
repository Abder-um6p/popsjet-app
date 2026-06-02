-- ============================================================
-- ADD TASK DOCUMENTS — Jet Pops v1.5
-- Exécuter dans Supabase > SQL Editor (service_role).
-- Idempotent — peut être relancé sans risque.
--
-- ⚠️  PRÉREQUIS — bucket Supabase Storage :
--    Avant d'utiliser le module, créer manuellement un bucket public
--    nommé "task-documents" dans le dashboard Supabase
--    (Storage → New bucket → name=task-documents, Public bucket=ON).
-- ============================================================

-- ─── 1. Table task_documents ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.task_documents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id       UUID NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  project_id    UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  uploaded_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  file_name     TEXT NOT NULL,
  file_url      TEXT NOT NULL,
  file_path     TEXT NOT NULL,
  file_size     BIGINT NOT NULL DEFAULT 0,
  mime_type     TEXT NOT NULL DEFAULT '',
  document_tag  TEXT NOT NULL DEFAULT 'other',
  -- valeurs document_tag : proof | invoice | deliverable | report | screenshot | other
  uploaded_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── 2. Index ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_task_documents_task_id     ON public.task_documents(task_id);
CREATE INDEX IF NOT EXISTS idx_task_documents_project_id  ON public.task_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_task_documents_uploaded_by ON public.task_documents(uploaded_by);

-- ─── 3. RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE public.task_documents ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'task_documents'
      AND policyname = 'task_documents_select'
  ) THEN
    CREATE POLICY "task_documents_select" ON public.task_documents
      FOR SELECT USING (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'task_documents'
      AND policyname = 'task_documents_insert'
  ) THEN
    CREATE POLICY "task_documents_insert" ON public.task_documents
      FOR INSERT WITH CHECK (auth.role() = 'authenticated');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'task_documents'
      AND policyname = 'task_documents_delete'
  ) THEN
    CREATE POLICY "task_documents_delete" ON public.task_documents
      FOR DELETE USING (
        auth.uid() = uploaded_by
        OR EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'directeur', 'chef_projet')
        )
      );
  END IF;
END $$;

-- ─── 4. Recharger le cache PostgREST ─────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

SELECT 'add_task_documents.sql appliqué' AS result;

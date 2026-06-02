-- ============================================================
-- FIX RLS POLICIES + TRIGGER — POPS JET
-- Exécuter dans Supabase > SQL Editor
-- ============================================================

-- ─────────────────────────────────────────────
-- A) FIX TRIGGER : completion_percentage → completion_pct
-- ─────────────────────────────────────────────

-- Trouver et remplacer le trigger qui met à jour completion_percentage
DO $$
DECLARE
  trig RECORD;
  func_def TEXT;
  new_func_def TEXT;
BEGIN
  FOR trig IN
    SELECT t.tgname, p.proname, p.prosrc, p.oid
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'tasks'
      AND p.prosrc LIKE '%completion_percentage%'
  LOOP
    -- Recréer la fonction avec le bon nom de colonne
    func_def := trig.prosrc;
    new_func_def := replace(func_def, 'completion_percentage', 'completion_pct');
    EXECUTE format(
      'CREATE OR REPLACE FUNCTION %I() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $f$%s$f$',
      trig.proname, new_func_def
    );
    RAISE NOTICE 'Fixed trigger function: %', trig.proname;
  END LOOP;
END $$;

-- ─────────────────────────────────────────────
-- B) SUPPRIMER TOUTES LES POLITIQUES SUR project_members
-- ─────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'project_members' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON project_members', r.policyname);
  END LOOP;
END $$;

-- Recréer project_members SELECT — NON RÉCURSIVE (utilise profile_id)
CREATE POLICY "pm_select" ON project_members
  FOR SELECT USING (
    auth.uid() = profile_id
    OR EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN ('admin', 'directeur', 'chef_projet')
    )
  );

-- INSERT
CREATE POLICY "pm_insert" ON project_members
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- DELETE
CREATE POLICY "pm_delete" ON project_members
  FOR DELETE USING (
    auth.uid() = profile_id
    OR EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN ('admin', 'directeur', 'chef_projet')
    )
  );

-- ─────────────────────────────────────────────
-- C) RECRÉER policies sur projects
-- ─────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'projects' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON projects', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "projects_select" ON projects
  FOR SELECT USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

CREATE POLICY "projects_insert" ON projects
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "projects_update" ON projects
  FOR UPDATE USING (
    auth.uid() = created_by
    OR auth.uid() = responsible_id
    OR EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN ('admin', 'directeur')
    )
  );

-- ─────────────────────────────────────────────
-- D) RECRÉER policies sur tasks
-- ─────────────────────────────────────────────
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'tasks' AND schemaname = 'public' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON tasks', r.policyname);
  END LOOP;
END $$;

CREATE POLICY "tasks_select" ON tasks
  FOR SELECT USING (auth.role() = 'authenticated' AND deleted_at IS NULL);

CREATE POLICY "tasks_insert" ON tasks
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "tasks_update" ON tasks
  FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "tasks_delete" ON tasks
  FOR DELETE USING (
    auth.uid() = created_by
    OR EXISTS (
      SELECT 1 FROM profiles pr
      WHERE pr.id = auth.uid()
        AND pr.role IN ('admin', 'directeur')
    )
  );

-- ─────────────────────────────────────────────
-- E) Recharger le cache de schéma
-- ─────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

SELECT 'Fix applied: RLS + trigger completion_pct' AS result;

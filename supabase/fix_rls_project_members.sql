-- ============================================================
-- Fix: infinite recursion in project_members / projects RLS
-- ============================================================
-- Run this in: Supabase Dashboard → SQL Editor → New query
-- Then click "Run"
-- ============================================================

-- ── 1. Fix project_members SELECT policy (the recursive one) ──

DROP POLICY IF EXISTS "project_members_select"            ON project_members;
DROP POLICY IF EXISTS "Users can view project members"    ON project_members;
DROP POLICY IF EXISTS "Members can view project members"  ON project_members;
DROP POLICY IF EXISTS "project_members_select_policy"     ON project_members;
-- Drop ALL policies on the table to be safe
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies WHERE tablename = 'project_members'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON project_members', pol.policyname);
  END LOOP;
END $$;

-- Non-recursive: a user sees rows where they are the member
CREATE POLICY "project_members_select"
  ON project_members FOR SELECT
  USING (auth.uid() = profile_id);

-- Allow authenticated users to insert members
CREATE POLICY "project_members_insert"
  ON project_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow update/delete by the user themselves or admins
CREATE POLICY "project_members_update"
  ON project_members FOR UPDATE
  USING (auth.uid() = profile_id);

CREATE POLICY "project_members_delete"
  ON project_members FOR DELETE
  USING (auth.uid() = profile_id);


-- ── 2. Fix projects INSERT policy (which references project_members) ──

DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'projects' AND cmd = 'INSERT'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON projects', pol.policyname);
  END LOOP;
END $$;

-- Simple: any authenticated user can create a project
CREATE POLICY "projects_insert"
  ON projects FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);


-- ── 3. Verify (optional — run separately to check) ──
-- SELECT policyname, cmd, qual FROM pg_policies WHERE tablename IN ('projects','project_members');

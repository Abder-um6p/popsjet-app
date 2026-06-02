-- Migration: Project Trash System
-- Run this in your Supabase SQL Editor

-- Add deleted_by and is_deleted to projects (deleted_at already exists)
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS deleted_by  UUID REFERENCES profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_deleted  BOOLEAN NOT NULL DEFAULT false;

-- Index for fast trash queries
CREATE INDEX IF NOT EXISTS idx_projects_is_deleted  ON projects(is_deleted);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at  ON projects(deleted_at) WHERE deleted_at IS NOT NULL;

-- When deleted_at is set, also set is_deleted = true (for convenience)
-- We'll manage this at the application level for simplicity.

-- RLS: Allow admins/directeurs to see deleted projects
-- (Existing policies likely filter deleted_at = NULL — add a separate policy for trash access)

-- Policy: admin and directeur can view deleted projects
CREATE POLICY IF NOT EXISTS "Admins can view deleted projects"
  ON projects FOR SELECT
  USING (
    is_deleted = true
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'directeur')
    )
  );

-- Policy: users can soft-delete projects they created
CREATE POLICY IF NOT EXISTS "Creators can soft-delete their projects"
  ON projects FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'directeur')
    )
  );

-- Policy: only admins/directeurs can permanently delete projects
CREATE POLICY IF NOT EXISTS "Admins can permanently delete projects"
  ON projects FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'directeur')
    )
  );

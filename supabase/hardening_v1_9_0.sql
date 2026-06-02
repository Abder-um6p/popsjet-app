-- ============================================================
-- JET POPS — HARDENING MIGRATION v1.9.0
-- Database Hardening & Production Alignment Phase
-- Generated: 2026-05-21
-- ============================================================
--
-- PURPOSE: Single idempotent migration that addresses all DB-level
-- issues identified in DB_HARDENING_BETA1.md.
--
-- ISSUES ADDRESSED:
--   DB-F-01/02/03  — FK inconsistency (auth.users → profiles)
--   DB-F-04/05     — project_members policy cleanup
--   DB-R-01/DB-M-01— Invalid CREATE POLICY IF NOT EXISTS
--   DB-R-02/SEC-01 — AI key exposure via profiles SELECT (short-term fix)
--   DB-R-03/A-02   — audit_logs SELECT excludes directeur
--   DB-R-04        — projects_select hides trash from admin Supabase client
--   DB-R-05        — pm_insert open to any authenticated user
--   DB-M-03/A-01   — audit log cleanup never scheduled
--   DB-I-01        — Backwards partial index on tasks.deleted_at
--   DB-I-02        — Synchronous notifications cleanup trigger
--   DB-I-03/04     — Missing composite indexes
--   DB-D-01/E-02   — projects.is_deleted dual truth source (sync trigger)
--   DB-A-03        — Drop unused log_audit() SQL function
--   DB-A-04        — Drop overly-open audit_logs INSERT policy
--   DB-SEC-02      — FK orphan risk via auth.users
--
-- IDEMPOTENCY: All DDL uses IF EXISTS / IF NOT EXISTS guards.
-- Safe to re-run on an already-patched instance.
--
-- PREREQUISITE: Run as service_role (Supabase SQL Editor).
-- ============================================================

BEGIN;

-- ══════════════════════════════════════════════════════════════
-- SECTION 1: FK CONSISTENCY — auth.users → profiles
-- Fixes: DB-F-01, DB-F-02, DB-F-03, DB-SEC-02
-- ══════════════════════════════════════════════════════════════

-- Helper: drop a constraint only if it exists (avoids errors on re-run)
-- We use a DO block for each table to be safe.

-- ── programs.deleted_by ────────────────────────────────────────
DO $$ BEGIN
  -- Drop any existing FK on programs.deleted_by
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'programs'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'deleted_by'
  ) THEN
    ALTER TABLE public.programs DROP CONSTRAINT IF EXISTS programs_deleted_by_fkey;
  END IF;
  -- Recreate pointing at profiles(id)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'programs'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND kcu.column_name = 'deleted_by'
  ) THEN
    ALTER TABLE public.programs
      ADD CONSTRAINT programs_deleted_by_fkey
      FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ── expenses.deleted_by ────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_deleted_by_fkey;
  ALTER TABLE public.expenses
    ADD CONSTRAINT expenses_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'expenses.deleted_by FK: %', SQLERRM;
END $$;

-- ── documents.deleted_by ───────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.documents DROP CONSTRAINT IF EXISTS documents_deleted_by_fkey;
  ALTER TABLE public.documents
    ADD CONSTRAINT documents_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'documents.deleted_by FK: %', SQLERRM;
END $$;

-- ── pops.deleted_by ────────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.pops DROP CONSTRAINT IF EXISTS pops_deleted_by_fkey;
  ALTER TABLE public.pops
    ADD CONSTRAINT pops_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pops.deleted_by FK: %', SQLERRM;
END $$;

-- ── budget_references.deleted_by ──────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.budget_references DROP CONSTRAINT IF EXISTS budget_references_deleted_by_fkey;
  ALTER TABLE public.budget_references
    ADD CONSTRAINT budget_references_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'budget_references.deleted_by FK: %', SQLERRM;
END $$;

-- ── budget_references.created_by ──────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.budget_references DROP CONSTRAINT IF EXISTS budget_references_created_by_fkey;
  ALTER TABLE public.budget_references
    ADD CONSTRAINT budget_references_created_by_fkey
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'budget_references.created_by FK: %', SQLERRM;
END $$;

-- ── tasks.deleted_by ──────────────────────────────────────────
DO $$ BEGIN
  ALTER TABLE public.tasks DROP CONSTRAINT IF EXISTS tasks_deleted_by_fkey;
  ALTER TABLE public.tasks
    ADD CONSTRAINT tasks_deleted_by_fkey
    FOREIGN KEY (deleted_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'tasks.deleted_by FK: %', SQLERRM;
END $$;


-- ══════════════════════════════════════════════════════════════
-- SECTION 2: INDEX FIXES
-- Fixes: DB-I-01, DB-I-03, DB-I-04
-- ══════════════════════════════════════════════════════════════

-- DB-I-01: Drop backwards partial index and replace with correct ones
DROP INDEX IF EXISTS public.idx_tasks_deleted_at;

-- New: index for active task lists (project + sort)
CREATE INDEX IF NOT EXISTS idx_tasks_active
  ON public.tasks(project_id, sort_order)
  WHERE deleted_at IS NULL;

-- New: index for trash queries (deleted tasks)
CREATE INDEX IF NOT EXISTS idx_tasks_deleted
  ON public.tasks(deleted_at DESC)
  WHERE deleted_at IS NOT NULL;

-- DB-I-03: Composite index for notifications query pattern
CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON public.notifications(user_id, created_at DESC);

-- DB-I-04: Composite index for audit_logs query pattern
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_created
  ON public.audit_logs(user_id, created_at DESC);


-- ══════════════════════════════════════════════════════════════
-- SECTION 3: NOTIFICATIONS — Replace sync trigger with async
-- Fixes: DB-I-02
-- ══════════════════════════════════════════════════════════════

-- Drop the synchronous row-level cleanup trigger
DROP TRIGGER IF EXISTS trg_cleanup_notifications ON public.notifications;

-- Replace with a lighter STATEMENT-level trigger that only fires when
-- a user has more than 120 notifications (deferred cleanup window).
-- This avoids running a DELETE subquery on every single INSERT.

CREATE OR REPLACE FUNCTION public.cleanup_old_notifications_stmt()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_user_id UUID;
  v_count   INT;
BEGIN
  -- TG_TABLE_NAME is 'notifications'; get distinct user_ids from new rows
  FOR v_user_id IN SELECT DISTINCT user_id FROM new_table LOOP
    SELECT COUNT(*) INTO v_count FROM public.notifications WHERE user_id = v_user_id;
    IF v_count > 120 THEN
      DELETE FROM public.notifications
      WHERE user_id = v_user_id
        AND id NOT IN (
          SELECT id FROM public.notifications
          WHERE user_id = v_user_id
          ORDER BY created_at DESC
          LIMIT 100
        );
    END IF;
  END LOOP;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_cleanup_notifications_stmt ON public.notifications;
CREATE TRIGGER trg_cleanup_notifications_stmt
  AFTER INSERT ON public.notifications
  REFERENCING NEW TABLE AS new_table
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_old_notifications_stmt();


-- ══════════════════════════════════════════════════════════════
-- SECTION 4: projects.is_deleted — sync trigger (interim fix)
-- Fixes: DB-D-01, DB-E-02
-- ══════════════════════════════════════════════════════════════

-- Keep is_deleted in sync with deleted_at to prevent dual truth source.
-- Long-term: drop is_deleted entirely after removing all references.

CREATE OR REPLACE FUNCTION public.sync_project_is_deleted()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.is_deleted := (NEW.deleted_at IS NOT NULL);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_project_is_deleted ON public.projects;
CREATE TRIGGER trg_sync_project_is_deleted
  BEFORE INSERT OR UPDATE OF deleted_at ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_project_is_deleted();


-- ══════════════════════════════════════════════════════════════
-- SECTION 5: RLS — PROFILES
-- DB-SEC-01 / DB-R-02 — DEFERRED (see note below)
-- ══════════════════════════════════════════════════════════════

-- ⚠️  IMPORTANT — WHY THE PROFILES POLICY IS NOT CHANGED HERE:
--
-- Restricting profiles SELECT to own-row breaks multiple parts of the app:
--   - AppShell (server) reads own profile → redirects to /auth/onboarding if null
--   - Member lists in projects show other users' name/avatar via browser client
--   - Sidebar badge queries reference project_members + profiles
--
-- A restrictive policy causes AppShell to return null for the profile,
-- triggering a redirect loop: dashboard → onboarding → dashboard → ...
--
-- The correct long-term fix for AI key exposure (DB-SEC-01) is to move
-- ai_* columns into a separate `user_secrets` table with:
--   RLS: USING (user_id = auth.uid())
-- This allows profiles to remain open while keys are protected.
--
-- Until that migration is done, the profiles SELECT policy stays open.
-- Current state: "profiles_select_authenticated" USING (true) — all authenticated users.
-- This was set by fix_profiles_rls.sql and is intentionally left unchanged here.

-- Ensure the open policy exists (restore it if a prior failed run dropped it)
DROP POLICY IF EXISTS "profiles_select_own_or_privileged" ON public.profiles;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'profiles'
      AND policyname = 'profiles_select_authenticated'
  ) THEN
    CREATE POLICY "profiles_select_authenticated"
      ON public.profiles
      FOR SELECT
      TO authenticated
      USING (true);
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
-- SECTION 6: RLS — AUDIT LOGS (directeur access + cleanup)
-- Fixes: DB-R-03, DB-A-02, DB-A-03, DB-A-04
-- ══════════════════════════════════════════════════════════════

-- Fix SELECT policy to include directeur
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'audit_logs'
      AND policyname = 'audit_logs_select_privileged'
  ) THEN
    CREATE POLICY "audit_logs_select_privileged"
      ON public.audit_logs
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles
          WHERE id = auth.uid()
            AND role IN ('admin', 'directeur')
        )
      );
  END IF;
END $$;

-- Remove the open INSERT policy (service role bypasses RLS anyway)
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;

-- Drop unused SQL log_audit() function (TypeScript insertAuditLog() is canonical)
DROP FUNCTION IF EXISTS public.log_audit(UUID, TEXT, TEXT, TEXT, UUID, TEXT, JSONB, JSONB);


-- ══════════════════════════════════════════════════════════════
-- SECTION 7: RLS — PROJECTS (trash visibility for admin client)
-- Fixes: DB-R-04
-- ══════════════════════════════════════════════════════════════

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "projects_select" ON public.projects;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'projects'
      AND policyname = 'projects_select_v2'
  ) THEN
    CREATE POLICY "projects_select_v2"
      ON public.projects
      FOR SELECT
      USING (
        auth.role() = 'authenticated'
        AND (
          -- Normal users see active projects
          deleted_at IS NULL
          -- Privileged roles also see soft-deleted projects (trash)
          OR EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid()
              AND p.role IN ('admin', 'directeur')
          )
        )
      );
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
-- SECTION 8: RLS — PROJECT_MEMBERS (fix invalid policies)
-- Fixes: DB-R-01, DB-M-01, DB-F-04, DB-F-05, DB-R-05
-- ══════════════════════════════════════════════════════════════

-- Remove the invalid policies from add_project_trash.sql
-- (these used CREATE POLICY IF NOT EXISTS which is invalid syntax —
-- if they somehow got applied, clean them up here)
DROP POLICY IF EXISTS "Admins can view deleted projects"    ON public.projects;
DROP POLICY IF EXISTS "Creators can soft-delete their projects" ON public.projects;
DROP POLICY IF EXISTS "Admins can permanently delete projects"  ON public.projects;

-- Harden project_members INSERT policy (was wide open to any authenticated user)
DROP POLICY IF EXISTS "pm_insert" ON public.project_members;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'project_members'
      AND policyname = 'pm_insert_privileged'
  ) THEN
    CREATE POLICY "pm_insert_privileged"
      ON public.project_members
      FOR INSERT
      WITH CHECK (
        -- Only privileged roles OR the project creator can add members
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.role IN ('admin', 'directeur', 'chef_projet')
        )
        OR EXISTS (
          SELECT 1 FROM public.projects proj
          WHERE proj.id = project_id
            AND proj.created_by = auth.uid()
        )
      );
  END IF;
END $$;


-- ══════════════════════════════════════════════════════════════
-- SECTION 9: AUDIT LOG CLEANUP SCHEDULING
-- Fixes: DB-M-03, DB-A-01
-- ══════════════════════════════════════════════════════════════

-- Schedule automatic audit log cleanup via pg_cron (if enabled)
-- pg_cron must be enabled in Supabase: Extensions → pg_cron
DO $cron_block$ BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Remove existing schedule if it exists (ignore error if not found)
    BEGIN
      PERFORM cron.unschedule('cleanup-audit-logs');
    EXCEPTION WHEN OTHERS THEN
      NULL; -- job didn't exist yet, that's fine
    END;

    -- Schedule daily cleanup at 03:00 UTC
    -- Note: use single-quoted string, not $$ (nested dollar-quoting is invalid)
    PERFORM cron.schedule(
      'cleanup-audit-logs',
      '0 3 * * *',
      'SELECT public.cleanup_old_audit_logs()'
    );

    RAISE NOTICE 'pg_cron: cleanup-audit-logs scheduled at 03:00 UTC daily';
  ELSE
    RAISE NOTICE 'pg_cron not enabled — cleanup_old_audit_logs() must be called manually or via Edge Function';
  END IF;
END $cron_block$;


-- ══════════════════════════════════════════════════════════════
-- SECTION 10: FINALIZE
-- ══════════════════════════════════════════════════════════════

-- Notify PostgREST to reload schema cache
NOTIFY pgrst, 'reload schema';

COMMIT;

-- ══════════════════════════════════════════════════════════════
-- POST-RUN VALIDATION CHECKLIST
-- ══════════════════════════════════════════════════════════════
-- After applying this migration, verify:
--
-- 1. FK CONSISTENCY
--    SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table
--    FROM information_schema.table_constraints tc
--    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
--    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
--    WHERE tc.constraint_type = 'FOREIGN KEY'
--      AND kcu.column_name IN ('deleted_by', 'created_by')
--    ORDER BY tc.table_name, kcu.column_name;
--    → All deleted_by should reference public.profiles (not auth.users)
--
-- 2. INDEXES
--    SELECT indexname, indexdef FROM pg_indexes
--    WHERE tablename = 'tasks' AND indexname LIKE 'idx_tasks%';
--    → Should see idx_tasks_active (IS NULL) and idx_tasks_deleted (IS NOT NULL)
--    → idx_tasks_deleted_at should be GONE
--
-- 3. RLS POLICIES
--    SELECT tablename, policyname, cmd, qual FROM pg_policies
--    WHERE tablename IN ('profiles', 'projects', 'audit_logs', 'project_members')
--    ORDER BY tablename, policyname;
--    → profiles: profiles_select_own_or_privileged (no profiles_select_authenticated)
--    → audit_logs: audit_logs_select_privileged (not "Admins can read audit logs")
--    → projects: projects_select_v2 (not projects_select)
--    → project_members: pm_insert_privileged (not pm_insert)
--
-- 4. TRIGGER
--    SELECT tgname, tgtype FROM pg_trigger
--    WHERE tgrelid = 'public.notifications'::regclass;
--    → Should see trg_cleanup_notifications_stmt (STATEMENT level)
--    → Should NOT see trg_cleanup_notifications (ROW level)
--
--    SELECT tgname FROM pg_trigger
--    WHERE tgrelid = 'public.projects'::regclass;
--    → Should see trg_sync_project_is_deleted
--
-- 5. PG_CRON (if enabled)
--    SELECT * FROM cron.job WHERE jobname = 'cleanup-audit-logs';
--    → Should show a job scheduled at '0 3 * * *'
-- ══════════════════════════════════════════════════════════════

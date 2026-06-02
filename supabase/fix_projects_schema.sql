-- ============================================================
-- FIX PROJECTS SCHEMA — Jet Pops
-- Exécuter dans Supabase > SQL Editor (service_role)
--
-- Ce script normalise le schéma de la table `projects` pour
-- correspondre au code v1.3+ :
--
--   Contexte du problème :
--   Le code API utilise `responsible_id` mais la DB a `chef_projet_id`.
--   Ce script renomme la colonne et ajoute deleted_by / is_deleted
--   si la migration add_project_trash.sql n'a pas encore été appliquée.
--
-- Idempotent : peut être relancé sans risque.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 1. COLONNE responsible_id
--    La DB a `chef_projet_id` (ancien nom) → renommer en responsible_id
-- ─────────────────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'projects'
      AND column_name  = 'responsible_id'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'projects'
        AND column_name  = 'chef_projet_id'
    ) THEN
      ALTER TABLE public.projects RENAME COLUMN chef_projet_id TO responsible_id;
      RAISE NOTICE 'chef_projet_id renommé en responsible_id ✓';
    ELSE
      -- Ni l'un ni l'autre : créer responsible_id
      ALTER TABLE public.projects
        ADD COLUMN responsible_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
      RAISE NOTICE 'responsible_id créé ✓';
    END IF;
  ELSE
    RAISE NOTICE 'responsible_id déjà présent — aucune action ✓';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. COLONNES DE CORBEILLE (si add_project_trash.sql non appliqué)
-- ─────────────────────────────────────────────────────────────

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS deleted_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS is_deleted  BOOLEAN NOT NULL DEFAULT false;

-- Synchroniser is_deleted depuis deleted_at pour les projets déjà supprimés
UPDATE public.projects
  SET is_deleted = true
  WHERE deleted_at IS NOT NULL AND is_deleted = false;

-- ─────────────────────────────────────────────────────────────
-- 3. INDEX
-- ─────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_projects_responsible_id ON public.projects(responsible_id);
CREATE INDEX IF NOT EXISTS idx_projects_is_deleted     ON public.projects(is_deleted);
CREATE INDEX IF NOT EXISTS idx_projects_deleted_at
  ON public.projects(deleted_at) WHERE deleted_at IS NOT NULL;

-- ─────────────────────────────────────────────────────────────
-- 4. RLS — Recréer les policies avec les bons noms de colonnes
-- ─────────────────────────────────────────────────────────────

-- Supprimer les anciennes policies (peuvent référencer chef_projet_id)
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE tablename = 'projects' AND schemaname = 'public'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.projects', r.policyname);
  END LOOP;
END $$;

-- Projets visibles (non supprimés) pour tous les utilisateurs authentifiés
CREATE POLICY "projects_select" ON public.projects
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND deleted_at IS NULL
  );

-- Corbeille : admin et directeur voient les projets supprimés
CREATE POLICY "projects_select_deleted" ON public.projects
  FOR SELECT USING (
    deleted_at IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'directeur')
    )
  );

-- Création de projets par tout utilisateur authentifié
CREATE POLICY "projects_insert" ON public.projects
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Modification : créateur, responsable, admin, directeur
CREATE POLICY "projects_update" ON public.projects
  FOR UPDATE USING (
    auth.uid() = created_by
    OR auth.uid() = responsible_id
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'directeur')
    )
  );

-- Suppression définitive : admin et directeur uniquement
CREATE POLICY "projects_delete" ON public.projects
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'directeur')
    )
  );

-- ─────────────────────────────────────────────────────────────
-- 5. Recharger le cache de schéma PostgREST
-- ─────────────────────────────────────────────────────────────

NOTIFY pgrst, 'reload schema';

SELECT
  'fix_projects_schema.sql appliqué avec succès' AS result,
  (SELECT column_name FROM information_schema.columns
   WHERE table_schema='public' AND table_name='projects'
     AND column_name IN ('responsible_id','chef_projet_id')
   LIMIT 1) AS colonne_responsable;

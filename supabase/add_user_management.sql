-- ============================================================
-- USER MANAGEMENT — Jet Pops
-- Exécuter dans Supabase > SQL Editor
-- ============================================================

-- 1. Ajouter disabled_at à la table profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS disabled_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Ajouter invited_by (qui a invité cet utilisateur)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invited_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT NULL;

-- 3. Ajouter un champ note d'invitation (interne admin)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS invite_note TEXT DEFAULT NULL;

-- 4. Politique RLS : admin peut tout voir et modifier
DO $$
BEGIN
  -- UPDATE policy pour admin
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
      AND schemaname = 'public'
      AND policyname = 'profiles_update_admin'
  ) THEN
    CREATE POLICY "profiles_update_admin"
      ON public.profiles
      FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles pr
          WHERE pr.id = auth.uid()
            AND pr.role = 'admin'
        )
        OR auth.uid() = id
      );
  END IF;
END $$;

-- 5. Recharger le cache de schéma PostgREST
NOTIFY pgrst, 'reload schema';

SELECT 'User management migration applied' AS result;

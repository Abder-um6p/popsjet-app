-- ============================================================
-- FIX RLS PROFILES — allow authenticated users to read all profiles
-- Exécuter dans Supabase > SQL Editor
-- ============================================================

-- Supprimer les politiques SELECT existantes sur profiles
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT policyname FROM pg_policies WHERE tablename = 'profiles' AND schemaname = 'public' AND cmd = 'SELECT' LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON profiles', r.policyname);
  END LOOP;
END $$;

-- Politique SELECT : tout utilisateur authentifié peut lire tous les profils
CREATE POLICY "profiles_select_authenticated"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

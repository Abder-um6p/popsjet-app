-- ============================================================
-- FIX TRIGGER : recalcul completion sur tasks
-- Exécuter dans Supabase > SQL Editor
-- ============================================================
-- Le trigger essaie de lire tasks.completion_pct (n'existe pas).
-- La bonne logique :
--   tasks.completion_percentage (colonne existante) → AVG → projects.completion_pct

-- 1) Trouver et corriger la fonction trigger sur tasks
DO $$
DECLARE
  trig RECORD;
  src  TEXT;
  fixed TEXT;
BEGIN
  FOR trig IN
    SELECT p.proname, p.prosrc, p.oid
    FROM pg_trigger t
    JOIN pg_proc p ON p.oid = t.tgfoid
    JOIN pg_class c ON c.oid = t.tgrelid
    WHERE c.relname = 'tasks'
      AND c.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
  LOOP
    src := trig.prosrc;
    -- Corriger seulement la référence tasks.completion_pct (inexistante)
    -- en la remettant à tasks.completion_percentage
    -- ET s'assurer que projects reçoit completion_pct (correct)
    fixed := replace(src, 'completion_pct', 'completion_percentage');
    fixed := replace(fixed, 'SET completion_percentage', 'SET completion_pct');

    IF fixed <> src THEN
      EXECUTE format(
        'CREATE OR REPLACE FUNCTION %I() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $f$%s$f$',
        trig.proname, fixed
      );
      RAISE NOTICE 'Trigger function fixed: %', trig.proname;
    ELSE
      RAISE NOTICE 'No change needed for: %', trig.proname;
    END IF;
  END LOOP;
END $$;

-- 2) Vérification — essai d'insertion de tâche test avec admin
-- (optionnel, peut échouer sur FK — c'est normal)

-- 3) Recharger le cache
NOTIFY pgrst, 'reload schema';

SELECT 'Trigger fix applied' AS result;

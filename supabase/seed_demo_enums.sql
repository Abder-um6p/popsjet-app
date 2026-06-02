-- ============================================================
-- ÉTAPE 1 — Exécuter CE fichier EN PREMIER dans le SQL Editor
-- Étend l'enum project_type avec les valeurs manquantes
-- Doit être commité AVANT de lancer seed_demo.sql
-- ============================================================

DO $$ BEGIN
  ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'hackathon';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'bootcamp';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'incubation';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'meeting';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TYPE project_type ADD VALUE IF NOT EXISTS 'other';
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Vérification
SELECT unnest(enum_range(NULL::project_type)) AS project_type_values;

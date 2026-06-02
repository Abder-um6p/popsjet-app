-- Migration : clé IA personnelle par membre
-- À exécuter dans Supabase > SQL Editor

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_api_key TEXT DEFAULT NULL;

COMMENT ON COLUMN profiles.ai_api_key IS
  'Clé API Gemini/OpenAI personnelle du membre. Chiffrée côté application.';

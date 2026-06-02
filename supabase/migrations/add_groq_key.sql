-- Migration : ajout du provider Groq (Llama 3.3) — clé `gsk_…`
-- À exécuter dans Supabase > SQL Editor
--
-- Groq est gratuit (14 400 req/jour) et utilise Llama 3.3 70B.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_groq_key text;

ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_ai_active_provider_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_ai_active_provider_check
  CHECK (ai_active_provider IN ('gemini','openai','claude','groq'));

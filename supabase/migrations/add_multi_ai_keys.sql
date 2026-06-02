-- Migration : support multi-clés IA (Gemini, OpenAI, Claude) par utilisateur
-- À exécuter dans Supabase > SQL Editor
--
-- Chaque utilisateur peut désormais stocker une clé par provider et choisir
-- lequel est actif. La colonne historique `ai_api_key` est conservée pour
-- la rétrocompatibilité avec les routes IA existantes : elle reflète
-- toujours la clé du provider actif.

-- Ajoute une colonne par provider + la colonne active provider
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS ai_gemini_key  text,
  ADD COLUMN IF NOT EXISTS ai_openai_key  text,
  ADD COLUMN IF NOT EXISTS ai_claude_key  text,
  ADD COLUMN IF NOT EXISTS ai_active_provider text CHECK (ai_active_provider IN ('gemini','openai','claude'));

-- Migrer les clés existantes : détecter le provider de ai_api_key et copier dans la bonne colonne
UPDATE profiles
SET
  ai_gemini_key = CASE WHEN ai_api_key LIKE 'AIza%' THEN ai_api_key ELSE ai_gemini_key END,
  ai_openai_key = CASE WHEN ai_api_key LIKE 'sk-%' AND ai_api_key NOT LIKE 'sk-ant-%' THEN ai_api_key ELSE ai_openai_key END,
  ai_claude_key = CASE WHEN ai_api_key LIKE 'sk-ant-%' THEN ai_api_key ELSE ai_claude_key END,
  ai_active_provider = CASE
    WHEN ai_api_key LIKE 'AIza%' THEN 'gemini'
    WHEN ai_api_key LIKE 'sk-ant-%' THEN 'claude'
    WHEN ai_api_key LIKE 'sk-%' THEN 'openai'
    ELSE ai_active_provider
  END
WHERE ai_api_key IS NOT NULL;

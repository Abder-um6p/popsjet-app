ALTER TABLE profiles ADD COLUMN IF NOT EXISTS ai_huggingface_key text;
ALTER TABLE profiles DROP CONSTRAINT IF EXISTS profiles_ai_active_provider_check;
ALTER TABLE profiles ADD CONSTRAINT profiles_ai_active_provider_check
  CHECK (ai_active_provider IN ('gemini','openai','claude','groq','huggingface'));

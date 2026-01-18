-- Add API key fields to profiles table
-- These store user's own AI provider API keys for BYOK (Bring Your Own Key)

-- Add columns for API keys
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS ai_provider text DEFAULT 'anthropic' CHECK (ai_provider IN ('anthropic', 'openai', 'google')),
ADD COLUMN IF NOT EXISTS anthropic_api_key text,
ADD COLUMN IF NOT EXISTS openai_api_key text,
ADD COLUMN IF NOT EXISTS google_api_key text,
ADD COLUMN IF NOT EXISTS use_own_api_key boolean DEFAULT false;

-- Note: In production, consider encrypting these keys at rest
-- or using a secrets management service like HashiCorp Vault

COMMENT ON COLUMN public.profiles.ai_provider IS 'Preferred AI provider: anthropic, openai, or google';
COMMENT ON COLUMN public.profiles.anthropic_api_key IS 'User Claude/Anthropic API key for BYOK';
COMMENT ON COLUMN public.profiles.openai_api_key IS 'User OpenAI API key for BYOK';
COMMENT ON COLUMN public.profiles.google_api_key IS 'User Google AI/Gemini API key for BYOK';
COMMENT ON COLUMN public.profiles.use_own_api_key IS 'Whether to use user own API key instead of platform key';

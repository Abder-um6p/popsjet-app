/**
 * Moteur IA multi-provider — I&E Lab PopsJet
 *
 * Auto-détecte le provider depuis le format de la clé :
 *   AIza...    → Google Gemini Flash (gratuit)
 *   sk-ant-... → Anthropic Claude Haiku (payant)
 *   sk-...     → OpenAI GPT-4o mini (payant)
 *   gsk_...    → Groq Llama 3.3 (gratuit)
 *   hf_...     → Hugging Face Mistral 7B (gratuit)
 */

export type AiProvider = 'gemini' | 'openai' | 'claude' | 'groq' | 'huggingface'

// ── Modèles utilisés ────────────────────────────────────────────────────────
const GEMINI_MODEL = 'gemini-1.5-flash-latest'
const OPENAI_MODEL = 'gpt-4o-mini'
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'
const GROQ_MODEL = 'llama-3.3-70b-versatile'
const HF_MODEL = 'mistralai/Mistral-7B-Instruct-v0.3'

// ── Détection du provider depuis la clé ─────────────────────────────────────
export function detectProvider(key: string): AiProvider | null {
  if (!key) return null
  if (key.startsWith('AIza'))    return 'gemini'
  if (key.startsWith('sk-ant-')) return 'claude'
  if (key.startsWith('sk-'))     return 'openai'
  if (key.startsWith('gsk_'))    return 'groq'
  if (key.startsWith('hf_'))     return 'huggingface'
  return null
}

/** Label lisible pour affichage UI */
export const PROVIDER_LABELS: Record<AiProvider, string> = {
  gemini: 'Google Gemini Flash',
  openai: 'OpenAI GPT-4o mini',
  claude: 'Anthropic Claude Haiku',
  groq: 'Groq Llama 3.3',
  huggingface: 'HF Mistral 7B',
}

/** Couleur badge UI */
export const PROVIDER_COLORS: Record<AiProvider, string> = {
  gemini: 'text-blue-700 bg-blue-50 border-blue-200',
  openai: 'text-emerald-700 bg-emerald-50 border-emerald-200',
  claude: 'text-orange-700 bg-orange-50 border-orange-200',
  groq: 'text-purple-700 bg-purple-50 border-purple-200',
  huggingface: 'text-yellow-700 bg-yellow-50 border-yellow-200',
}

// ── Résolution de la clé (user > env Gemini) ────────────────────────────────
function resolveKey(userKey?: string | null): { key: string; provider: AiProvider } | null {
  if (userKey) {
    const p = detectProvider(userKey)
    if (p) return { key: userKey, provider: p }
  }
  const envKey = process.env.GEMINI_API_KEY
  if (envKey && envKey.startsWith('AIza')) return { key: envKey, provider: 'gemini' }
  return null
}

export function hasAiKey(userKey?: string | null): boolean {
  return !!resolveKey(userKey)
}

// ── Appel Gemini ─────────────────────────────────────────────────────────────
async function geminiCall(
  key: string,
  prompt: string,
  opts: { temperature?: number; maxOutputTokens?: number }
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1/models/${GEMINI_MODEL}:generateContent?key=${key}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature:     opts.temperature     ?? 0.4,
        maxOutputTokens: opts.maxOutputTokens ?? 400,
      },
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Gemini HTTP ${res.status}`)
  }
  const data = await res.json()
  return (data?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim()
}

// ── Appel OpenAI ─────────────────────────────────────────────────────────────
async function openaiCall(
  key: string,
  prompt: string,
  opts: { temperature?: number; maxOutputTokens?: number }
): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature:  opts.temperature     ?? 0.4,
      max_tokens:   opts.maxOutputTokens ?? 400,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `OpenAI HTTP ${res.status}`)
  }
  const data = await res.json()
  return (data?.choices?.[0]?.message?.content ?? '').trim()
}

// ── Appel Claude (Anthropic) ─────────────────────────────────────────────────
async function claudeCall(
  key: string,
  prompt: string,
  opts: { temperature?: number; maxOutputTokens?: number }
): Promise<string> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type':   'application/json',
      'x-api-key':      key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens:  opts.maxOutputTokens ?? 400,
      temperature: opts.temperature     ?? 0.4,
      messages: [{ role: 'user', content: prompt }],
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Claude HTTP ${res.status}`)
  }
  const data = await res.json()
  return (data?.content?.[0]?.text ?? '').trim()
}

// ── Appel Groq (API compatible OpenAI) ───────────────────────────────────────
async function groqCall(
  key: string,
  prompt: string,
  opts: { temperature?: number; maxOutputTokens?: number }
): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: opts.temperature     ?? 0.4,
      max_tokens:  opts.maxOutputTokens ?? 400,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `Groq HTTP ${res.status}`)
  }
  const data = await res.json()
  return (data?.choices?.[0]?.message?.content ?? '').trim()
}

// ── Appel Hugging Face (API compatible OpenAI) ──────────────────────────────
async function huggingfaceCall(
  key: string,
  prompt: string,
  opts: { temperature?: number; maxOutputTokens?: number }
): Promise<string> {
  const res = await fetch('https://api-inference.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: HF_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: opts.temperature     ?? 0.4,
      max_tokens:  opts.maxOutputTokens ?? 400,
    }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err?.error?.message ?? `HuggingFace HTTP ${res.status}`)
  }
  const data = await res.json()
  return (data?.choices?.[0]?.message?.content ?? '').trim()
}

// ── Point d'entrée principal ─────────────────────────────────────────────────
export async function aiGenerate(
  prompt: string,
  options: { temperature?: number; maxOutputTokens?: number; apiKey?: string | null } = {}
): Promise<string> {
  const resolved = resolveKey(options.apiKey)
  if (!resolved) throw new Error('NO_KEY')

  const { key, provider } = resolved
  if (provider === 'gemini')      return geminiCall(key, prompt, options)
  if (provider === 'openai')      return openaiCall(key, prompt, options)
  if (provider === 'claude')      return claudeCall(key, prompt, options)
  if (provider === 'groq')        return groqCall(key, prompt, options)
  if (provider === 'huggingface') return huggingfaceCall(key, prompt, options)
  throw new Error('NO_KEY')
}

/** Parse JSON depuis la réponse IA — enlève les balises markdown si présentes */
export function parseAiJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  return JSON.parse(cleaned) as T
}

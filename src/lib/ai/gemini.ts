/**
 * Gemini Flash helper — clé par utilisateur
 * Chaque membre configure sa propre GEMINI_API_KEY dans ses paramètres de profil.
 * Model: gemini-1.5-flash (tier gratuit : 15 req/min, 1M tokens/jour)
 */

const GEMINI_MODEL = 'gemini-1.5-flash'
const GEMINI_BASE  = 'https://generativelanguage.googleapis.com/v1beta/models'

/** Récupère la clé depuis l'env (fallback global, optionnel) */
export function getGeminiEnvKey(): string | null {
  const key = process.env.GEMINI_API_KEY
  return key && key.startsWith('AIza') ? key : null
}

/** Choisit la clé à utiliser : clé du membre en priorité, puis env */
export function resolveKey(userKey?: string | null): string | null {
  if (userKey && userKey.startsWith('AIza')) return userKey
  return getGeminiEnvKey()
}

/** Appel Gemini — lève une erreur si aucune clé disponible */
export async function geminiGenerate(
  prompt: string,
  options: { temperature?: number; maxOutputTokens?: number; apiKey?: string | null } = {}
): Promise<string> {
  const key = resolveKey(options.apiKey)
  if (!key) throw new Error('NO_KEY')

  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${key}`

  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature:     options.temperature     ?? 0.4,
        maxOutputTokens: options.maxOutputTokens ?? 400,
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

/** Parse JSON depuis la réponse Gemini — enlève les balises markdown si présentes */
export function parseGeminiJson<T>(text: string): T {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  return JSON.parse(cleaned) as T
}

/** Vérifie si une clé est disponible pour un utilisateur donné */
export function hasKey(userKey?: string | null): boolean {
  return !!resolveKey(userKey)
}

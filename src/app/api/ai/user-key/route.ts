import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { detectProvider, type AiProvider } from '@/lib/ai/providers'

type ProviderStatus = { configured: boolean; masked: string | null }
type KeyColumn = 'ai_gemini_key' | 'ai_openai_key' | 'ai_claude_key' | 'ai_groq_key' | 'ai_huggingface_key'

const PROVIDERS: AiProvider[] = ['gemini', 'openai', 'claude', 'groq', 'huggingface']

const COLUMN: Record<AiProvider, KeyColumn> = {
  gemini:      'ai_gemini_key',
  openai:      'ai_openai_key',
  claude:      'ai_claude_key',
  groq:        'ai_groq_key',
  huggingface: 'ai_huggingface_key',
}

function keyUpdate(provider: AiProvider, value: string | null) {
  switch (provider) {
    case 'gemini':      return { ai_gemini_key: value }
    case 'openai':      return { ai_openai_key: value }
    case 'claude':      return { ai_claude_key: value }
    case 'groq':        return { ai_groq_key: value }
    case 'huggingface': return { ai_huggingface_key: value }
  }
}

function maskKey(key: string | null | undefined): string | null {
  if (!key) return null
  return `${key.slice(0, 8)}${'•'.repeat(Math.max(0, key.length - 12))}${key.slice(-4)}`
}

function isValidProvider(p: unknown): p is AiProvider {
  return p === 'gemini' || p === 'openai' || p === 'claude' || p === 'groq' || p === 'huggingface'
}

/** GET — retourne le statut de tous les providers + l'actif */
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  const { data } = await admin
    .from('profiles')
    .select('ai_gemini_key, ai_openai_key, ai_claude_key, ai_groq_key, ai_huggingface_key, ai_active_provider')
    .eq('id', user.id)
    .single() as { data: Record<string, string | null> | null }

  const providers: Record<AiProvider, ProviderStatus> = {
    gemini:      { configured: false, masked: null },
    openai:      { configured: false, masked: null },
    claude:      { configured: false, masked: null },
    groq:        { configured: false, masked: null },
    huggingface: { configured: false, masked: null },
  }

  for (const p of PROVIDERS) {
    const key = data?.[COLUMN[p]] ?? null
    providers[p] = { configured: !!key, masked: maskKey(key) }
  }

  const active = (data?.ai_active_provider ?? null) as AiProvider | null
  return NextResponse.json({
    activeProvider: active && providers[active]?.configured ? active : null,
    providers,
  })
}

/** POST — { action: 'save' | 'activate' | 'delete', provider, key? } */
export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const body = await req.json().catch(() => ({}))
  const { action, provider, key } = body as { action?: string; provider?: string; key?: string }

  if (!isValidProvider(provider)) {
    return NextResponse.json({ error: 'Provider invalide' }, { status: 400 })
  }

  const admin = createAdminClient()

  // ── SAVE ────────────────────────────────────────────────────────────────
  if (action === 'save') {
    const trimmed = (key ?? '').trim()
    if (!trimmed) return NextResponse.json({ error: 'Clé manquante' }, { status: 400 })
    if (trimmed.length < 20) return NextResponse.json({ error: 'Clé trop courte' }, { status: 400 })

    const detected = detectProvider(trimmed)
    if (!detected) {
      return NextResponse.json({
        error: 'Clé invalide — doit commencer par "AIza" (Gemini), "sk-ant-" (Claude), "sk-" (OpenAI), "gsk_" (Groq) ou "hf_" (Hugging Face)',
      }, { status: 400 })
    }
    if (detected !== provider) {
      return NextResponse.json({
        error: `Cette clé semble être pour ${detected}, pas ${provider}`,
      }, { status: 400 })
    }

    const { error } = await admin
      .from('profiles')
      .update(keyUpdate(provider, trimmed))
      .eq('id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ ok: true, masked: maskKey(trimmed) })
  }

  // ── ACTIVATE ────────────────────────────────────────────────────────────
  if (action === 'activate') {
    const { data: profile } = await admin
      .from('profiles')
      .select(COLUMN[provider])
      .eq('id', user.id)
      .single() as { data: Record<string, string | null> | null }

    const providerKey = profile?.[COLUMN[provider]] ?? null
    if (!providerKey) {
      return NextResponse.json({ error: 'Aucune clé sauvegardée pour ce provider' }, { status: 400 })
    }

    const { error } = await admin
      .from('profiles')
      .update({
        ai_active_provider: provider,
        ai_api_key: providerKey, // rétrocompatibilité avec routes IA existantes
      })
      .eq('id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, activeProvider: provider })
  }

  // ── DELETE ──────────────────────────────────────────────────────────────
  if (action === 'delete') {
    const { data: profile } = await admin
      .from('profiles')
      .select('ai_active_provider')
      .eq('id', user.id)
      .single() as { data: { ai_active_provider: string | null } | null }

    const wasActive = profile?.ai_active_provider === provider
    const update = {
      ...keyUpdate(provider, null),
      ...(wasActive ? { ai_active_provider: null, ai_api_key: null } : {}),
    }

    const { error } = await admin
      .from('profiles')
      .update(update)
      .eq('id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, activeProvider: wasActive ? null : undefined })
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}

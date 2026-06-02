import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'
import { detectProvider } from '@/lib/ai/providers'

export async function POST(_req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const admin = createAdminClient()
  const { data: profileData } = await admin
    .from('profiles').select('ai_api_key').eq('id', user.id).single() as { data: { ai_api_key: string | null } | null }
  const key = profileData?.ai_api_key ?? null

  if (!key) return NextResponse.json({ ok: false, error: 'Aucune clé active configurée' })

  const provider = detectProvider(key)
  if (!provider) return NextResponse.json({ ok: false, error: 'Provider non reconnu' })

  try {
    if (provider === 'gemini') {
      const url = `https://generativelanguage.googleapis.com/v1/models/gemini-2.0-flash:generateContent?key=${key}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'Réponds juste "ok"' }] }],
          generationConfig: { maxOutputTokens: 5 },
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        const url2 = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash-latest:generateContent?key=${key}`
        const res2 = await fetch(url2, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: 'Réponds juste "ok"' }] }],
            generationConfig: { maxOutputTokens: 5 },
          }),
        })
        if (!res2.ok) {
          const err2 = await res2.json().catch(() => ({}))
          const url3 = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`
          const res3 = await fetch(url3, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: 'Réponds juste "ok"' }] }],
              generationConfig: { maxOutputTokens: 5 },
            }),
          })
          if (!res3.ok) {
            const err3 = await res3.json().catch(() => ({}))
            return NextResponse.json({
              ok: false,
              provider,
              tried: ['v1/gemini-2.0-flash', 'v1/gemini-1.5-flash-latest', 'v1beta/gemini-2.0-flash'],
              errors: {
                'v1/gemini-2.0-flash': err?.error?.message ?? `HTTP ${res.status}`,
                'v1/gemini-1.5-flash-latest': err2?.error?.message ?? `HTTP ${res2.status}`,
                'v1beta/gemini-2.0-flash': err3?.error?.message ?? `HTTP ${res3.status}`,
              },
            })
          }
          const d3 = await res3.json()
          return NextResponse.json({
            ok: true,
            provider,
            workingUrl: 'v1beta/gemini-2.0-flash',
            response: d3?.candidates?.[0]?.content?.parts?.[0]?.text,
          })
        }
        const d2 = await res2.json()
        return NextResponse.json({
          ok: true,
          provider,
          workingUrl: 'v1/gemini-1.5-flash-latest',
          response: d2?.candidates?.[0]?.content?.parts?.[0]?.text,
        })
      }
      const d = await res.json()
      return NextResponse.json({
        ok: true,
        provider,
        workingUrl: 'v1/gemini-2.0-flash',
        response: d?.candidates?.[0]?.content?.parts?.[0]?.text,
      })
    }

    if (provider === 'openai') {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [{ role: 'user', content: 'Say ok' }],
          max_tokens: 5,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return NextResponse.json({ ok: false, provider, error: err?.error?.message ?? `HTTP ${res.status}` })
      }
      const d = await res.json()
      return NextResponse.json({ ok: true, provider, response: d?.choices?.[0]?.message?.content })
    }

    if (provider === 'claude') {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': key,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 5,
          messages: [{ role: 'user', content: 'Say ok' }],
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return NextResponse.json({ ok: false, provider, error: err?.error?.message ?? `HTTP ${res.status}` })
      }
      const d = await res.json()
      return NextResponse.json({ ok: true, provider, response: d?.content?.[0]?.text })
    }

    if (provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: 'Say ok' }],
          max_tokens: 5,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return NextResponse.json({ ok: false, provider, error: err?.error?.message ?? `HTTP ${res.status}` })
      }
      const d = await res.json()
      return NextResponse.json({ ok: true, provider, response: d?.choices?.[0]?.message?.content })
    }

    if (provider === 'huggingface') {
      const res = await fetch('https://api-inference.huggingface.co/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: 'mistralai/Mistral-7B-Instruct-v0.3',
          messages: [{ role: 'user', content: 'Say ok' }],
          max_tokens: 5,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        return NextResponse.json({ ok: false, provider, error: err?.error?.message ?? `HTTP ${res.status}` })
      }
      const d = await res.json()
      return NextResponse.json({ ok: true, provider, response: d?.choices?.[0]?.message?.content })
    }

    return NextResponse.json({ ok: false, error: 'Provider inconnu' })
  } catch (e: any) {
    return NextResponse.json({ ok: false, provider, error: e?.message ?? 'Erreur réseau' })
  }
}

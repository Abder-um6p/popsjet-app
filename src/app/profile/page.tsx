'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Camera, Save, Lock, Eye, EyeOff, CheckCircle2, XCircle, Sparkles, Trash2, ExternalLink, KeyRound } from 'lucide-react'
import { getInitials, LABELS } from '@/lib/utils'
import { cn } from '@/lib/utils'

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8 caractères min.', ok: password.length >= 8 },
    { label: 'Une majuscule',     ok: /[A-Z]/.test(password) },
    { label: 'Un chiffre',        ok: /\d/.test(password) },
    { label: 'Caractère spécial', ok: /[^A-Za-z0-9]/.test(password) },
  ]
  const score = checks.filter(c => c.ok).length
  const bar = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-yellow-400', 'bg-green-500'][score]
  if (!password) return null
  return (
    <div className="mt-2 space-y-1.5">
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${bar}`} style={{ width: `${(score / 4) * 100}%` }} />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
        {checks.map(c => (
          <div key={c.label} className="flex items-center gap-1.5">
            {c.ok
              ? <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
              : <XCircle className="w-3 h-3 text-gray-300 shrink-0" />
            }
            <span className={`text-xs ${c.ok ? 'text-gray-600' : 'text-gray-400'}`}>{c.label}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [form, setForm] = useState({ full_name: '', bio: '' })
  const fileRef = useRef<HTMLInputElement>(null)

  // Password change state
  const [pwForm, setPwForm] = useState({ current: '', new: '', confirm: '' })
  const [pwLoading, setPwLoading] = useState(false)
  const [showCurrent, setShowCurrent] = useState(false)
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)

  // AI multi-key state
  type AiProvider = 'gemini' | 'openai' | 'claude' | 'groq' | 'huggingface'
  type ProviderStatus = { configured: boolean; masked: string | null }
  const [activeProvider, setActiveProvider] = useState<AiProvider | null>(null)
  const [providers, setProviders] = useState<Record<AiProvider, ProviderStatus>>({
    gemini:      { configured: false, masked: null },
    openai:      { configured: false, masked: null },
    claude:      { configured: false, masked: null },
    groq:        { configured: false, masked: null },
    huggingface: { configured: false, masked: null },
  })
  const [aiInputs, setAiInputs] = useState<Record<AiProvider, string>>({
    gemini: '', openai: '', claude: '', groq: '', huggingface: '',
  })
  const [aiShow, setAiShow] = useState<Record<AiProvider, boolean>>({
    gemini: false, openai: false, claude: false, groq: false, huggingface: false,
  })
  const [aiLoading, setAiLoading] = useState<AiProvider | null>(null)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [testLoading, setTestLoading] = useState(false)
  const [expandedProvider, setExpandedProvider] = useState<AiProvider | null>(null)

  async function handleTestKey() {
    setTestLoading(true)
    setTestResult(null)
    try {
      const res = await fetch('/api/ai/test-key', { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (json.ok) {
        const where = json.workingUrl ? `${json.workingUrl} fonctionne` : `${json.provider ?? 'provider'} fonctionne`
        const resp = typeof json.response === 'string' ? json.response.trim() : ''
        setTestResult({ ok: true, message: `✅ ${where}${resp ? ` — réponse : "${resp}"` : ''}` })
      } else if (json.tried && json.errors) {
        const details = (json.tried as string[])
          .map(u => `${u}: ${json.errors[u] ?? 'erreur'}`)
          .join(' · ')
        setTestResult({ ok: false, message: `❌ Toutes les URLs ont échoué — ${details}` })
      } else {
        setTestResult({ ok: false, message: `❌ Erreur : ${json.error ?? 'inconnue'}` })
      }
    } catch (e: any) {
      setTestResult({ ok: false, message: `❌ Erreur réseau : ${e?.message ?? 'inconnue'}` })
    }
    setTestLoading(false)
  }

  useEffect(() => {
    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      if (data) {
        setProfile(data)
        setForm({ full_name: data.full_name ?? '', bio: data.bio ?? '' })
      }
      await refreshAiKeys()
    }
    load()
  }, [])

  async function refreshAiKeys() {
    const res = await fetch('/api/ai/user-key')
    if (!res.ok) return
    const json = await res.json()
    setActiveProvider(json.activeProvider ?? null)
    if (json.providers) setProviders(json.providers)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const { error } = await supabase.from('profiles').update({
      full_name: form.full_name.trim(),
      bio: form.bio.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', user!.id)
    if (error) { toast.error(error.message); setLoading(false); return }
    setProfile((p: any) => ({ ...p, ...form }))
    toast.success('Profil mis à jour')
    setLoading(false)
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { toast.error('Image trop grande (max 2 Mo)'); return }
    const ALLOWED_AVATAR_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
    if (!ALLOWED_AVATAR_MIME.includes(file.type)) { toast.error('Format non autorisé (JPG, PNG, WebP, GIF uniquement)'); return }

    setUploading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const ext = file.name.split('.').pop()
    const path = `${user!.id}/avatar.${ext}`

    const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
    if (uploadError) { toast.error(uploadError.message); setUploading(false); return }

    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
    const { error } = await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', user!.id)
    if (error) { toast.error(error.message); setUploading(false); return }

    setProfile((p: any) => ({ ...p, avatar_url: publicUrl + '?t=' + Date.now() }))
    toast.success('Avatar mis à jour')
    setUploading(false)
  }

  if (!profile) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">Mon profil</h1>
        <p className="text-sm text-gray-500 mt-1">Gérez vos informations personnelles</p>
      </div>

      {/* Avatar */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Photo de profil</h2>
        <div className="flex items-center gap-5">
          <div className="relative">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xl font-bold overflow-hidden">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt={profile.full_name} className="w-full h-full object-cover" />
              ) : (
                getInitials(profile.full_name)
              )}
            </div>
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700 transition shadow-md disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-800">{profile.full_name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{profile.email}</p>
            <p className="text-xs text-blue-600 mt-1">{LABELS.user_role[profile.role as keyof typeof LABELS.user_role]}</p>
            <button onClick={() => fileRef.current?.click()} disabled={uploading}
              className="mt-2 text-xs text-blue-600 hover:underline disabled:opacity-50">
              {uploading ? 'Upload en cours...' : 'Changer la photo'}
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>
      </div>

      {/* Informations */}
      <form onSubmit={handleSave} className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <h2 className="text-lg font-semibold text-gray-800">Informations personnelles</h2>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nom complet *</label>
            <input type="text" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input type="email" value={profile.email} disabled
              className="w-full px-3 py-2.5 border border-gray-100 rounded-lg text-sm text-gray-400 bg-gray-50 cursor-not-allowed" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Rôle</label>
          <input value={LABELS.user_role[profile.role as keyof typeof LABELS.user_role]} disabled
            className="w-full px-3 py-2.5 border border-gray-100 rounded-lg text-sm text-gray-400 bg-gray-50 cursor-not-allowed" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Bio</label>
          <textarea value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
            placeholder="Quelques mots sur vous, votre rôle à l'I&E Lab..."
            rows={3} className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        <div className="flex justify-end">
          <button type="submit" disabled={loading || !form.full_name.trim()}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50">
            <Save className="w-4 h-4" />
            {loading ? 'Sauvegarde...' : 'Sauvegarder'}
          </button>
        </div>
      </form>

      {/* Sécurité — Changement de mot de passe */}
      <form
        onSubmit={async (e) => {
          e.preventDefault()
          if (pwForm.new !== pwForm.confirm) { toast.error('Les mots de passe ne correspondent pas'); return }
          if (pwForm.new.length < 8) { toast.error('Minimum 8 caractères'); return }
          setPwLoading(true)
          const res = await fetch('/api/profile/password', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ currentPassword: pwForm.current, newPassword: pwForm.new }),
          })
          const json = await res.json()
          if (!res.ok) { toast.error(json.error ?? 'Erreur'); setPwLoading(false); return }
          toast.success('Mot de passe mis à jour')
          setPwForm({ current: '', new: '', confirm: '' })
          setPwLoading(false)
        }}
        className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <Lock className="w-4.5 h-4.5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Sécurité</h2>
            <p className="text-xs text-gray-400 mt-0.5">Changer votre mot de passe</p>
          </div>
        </div>

        {/* Current password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe actuel</label>
          <div className="relative">
            <input
              type={showCurrent ? 'text' : 'password'}
              value={pwForm.current}
              onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
              required
              autoComplete="current-password"
              className="w-full px-3 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShowCurrent(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* New password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Nouveau mot de passe</label>
          <div className="relative">
            <input
              type={showNew ? 'text' : 'password'}
              value={pwForm.new}
              onChange={e => setPwForm(f => ({ ...f, new: e.target.value }))}
              required
              autoComplete="new-password"
              className="w-full px-3 pr-10 py-2.5 border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400"
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShowNew(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <PasswordStrength password={pwForm.new} />
        </div>

        {/* Confirm */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer le nouveau mot de passe</label>
          <div className="relative">
            <input
              type={showConfirm ? 'text' : 'password'}
              value={pwForm.confirm}
              onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
              required
              autoComplete="new-password"
              className={cn(
                'w-full px-3 pr-10 py-2.5 border rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-400',
                pwForm.confirm && pwForm.new !== pwForm.confirm ? 'border-red-300 ring-1 ring-red-300' : 'border-gray-200'
              )}
              placeholder="••••••••"
            />
            <button type="button" onClick={() => setShowConfirm(v => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {pwForm.confirm && pwForm.new !== pwForm.confirm && (
            <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
          )}
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={pwLoading || !pwForm.current || !pwForm.new || !pwForm.confirm || pwForm.new !== pwForm.confirm || pwForm.new.length < 8}
            className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
          >
            <Lock className="w-4 h-4" />
            {pwLoading ? 'Mise à jour…' : 'Changer le mot de passe'}
          </button>
        </div>
      </form>

      {/* ── Paramètres IA ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-violet-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-gray-800">Clés IA personnelles</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              Choisissez un provider IA pour les résumés, risques, suggestions et analyses
            </p>
          </div>
        </div>

        {(() => {
          const PROVIDER_META: Record<AiProvider, {
            name: string; badge: 'Gratuit' | 'Payant'; badgeCls: string; prefix: string
            placeholder: string; accent: string; activeBg: string; activeBorder: string
            note: string; initials: string
            steps: Array<{ text: string; link?: { href: string; label: string } }>
          }> = {
            gemini: {
              name: 'Google Gemini Flash', badge: 'Gratuit', badgeCls: 'bg-green-100 text-green-700',
              prefix: 'AIza', placeholder: 'AIzaSy…', accent: 'text-blue-700',
              activeBg: 'bg-blue-50', activeBorder: 'border-blue-300', initials: 'G',
              note: 'Gratuit · 15 req/min · 1M tokens/jour',
              steps: [
                { text: 'Aller sur', link: { href: 'https://aistudio.google.com/apikey', label: 'aistudio.google.com/apikey' } },
                { text: 'Se connecter avec votre compte Google' },
                { text: 'Cliquer sur « Créer une clé API »' },
                { text: 'Copier la clé (commence par AIza)' },
              ],
            },
            openai: {
              name: 'OpenAI GPT-4o mini', badge: 'Payant', badgeCls: 'bg-yellow-100 text-yellow-700',
              prefix: 'sk-', placeholder: 'sk-…', accent: 'text-emerald-700',
              activeBg: 'bg-emerald-50', activeBorder: 'border-emerald-300', initials: 'AI',
              note: 'Payant · ~$0.15/1M tokens',
              steps: [
                { text: 'Aller sur', link: { href: 'https://platform.openai.com/api-keys', label: 'platform.openai.com/api-keys' } },
                { text: 'Se connecter et aller dans « API keys »' },
                { text: 'Cliquer sur « Create new secret key »' },
                { text: 'Copier la clé (commence par sk-)' },
              ],
            },
            claude: {
              name: 'Anthropic Claude Haiku', badge: 'Payant', badgeCls: 'bg-yellow-100 text-yellow-700',
              prefix: 'sk-ant-', placeholder: 'sk-ant-…', accent: 'text-orange-700',
              activeBg: 'bg-orange-50', activeBorder: 'border-orange-300', initials: 'C',
              note: 'Payant · ~$0.25/1M tokens',
              steps: [
                { text: 'Aller sur', link: { href: 'https://console.anthropic.com/settings/keys', label: 'console.anthropic.com/settings/keys' } },
                { text: 'Se connecter à votre compte Anthropic' },
                { text: 'Cliquer sur « Create Key »' },
                { text: 'Copier la clé (commence par sk-ant-)' },
              ],
            },
            groq: {
              name: 'Groq Llama 3.3', badge: 'Gratuit', badgeCls: 'bg-purple-100 text-purple-700',
              prefix: 'gsk_', placeholder: 'gsk_…', accent: 'text-purple-700',
              activeBg: 'bg-purple-50', activeBorder: 'border-purple-300', initials: 'Gr',
              note: 'Gratuit · 14 400 req/jour · Llama 3.3 70B',
              steps: [
                { text: 'Aller sur', link: { href: 'https://console.groq.com/keys', label: 'console.groq.com/keys' } },
                { text: 'Créer un compte gratuit (pas de carte bancaire)' },
                { text: 'Cliquer sur « Create API Key »' },
                { text: 'Copier la clé (commence par gsk_)' },
              ],
            },
            huggingface: {
              name: 'Hugging Face Mistral 7B', badge: 'Gratuit', badgeCls: 'bg-yellow-100 text-yellow-700',
              prefix: 'hf_', placeholder: 'hf_…', accent: 'text-yellow-700',
              activeBg: 'bg-yellow-50', activeBorder: 'border-yellow-300', initials: 'HF',
              note: 'Gratuit · Mistral 7B · limites selon compte',
              steps: [
                { text: 'Aller sur', link: { href: 'https://huggingface.co/settings/tokens', label: 'huggingface.co/settings/tokens' } },
                { text: 'Créer un compte gratuit' },
                { text: 'Cliquer sur « New token » → type « Read »' },
                { text: 'Copier le token (commence par hf_)' },
              ],
            },
          }

          async function callApi(body: Record<string, unknown>): Promise<{ ok: boolean; json: any }> {
            const res = await fetch('/api/ai/user-key', {
              method: 'POST', headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            })
            return { ok: res.ok, json: await res.json().catch(() => ({})) }
          }

          async function handleSaveKey(p: AiProvider) {
            const key = aiInputs[p].trim()
            if (key.length < 20) { toast.error('Clé trop courte'); return }
            if (!key.startsWith(PROVIDER_META[p].prefix)) {
              toast.error(`Cette clé doit commencer par "${PROVIDER_META[p].prefix}"`); return
            }
            setAiLoading(p)
            const { ok, json } = await callApi({ action: 'save', provider: p, key })
            setAiLoading(null)
            if (!ok) { toast.error(json.error ?? 'Erreur'); return }
            setAiInputs(s => ({ ...s, [p]: '' }))
            toast.success(`Clé ${PROVIDER_META[p].name} sauvegardée`)
            await refreshAiKeys()
          }

          async function handleActivateKey(p: AiProvider) {
            setAiLoading(p)
            const { ok, json } = await callApi({ action: 'activate', provider: p })
            setAiLoading(null)
            if (!ok) { toast.error(json.error ?? 'Erreur'); return }
            toast.success(`${PROVIDER_META[p].name} est maintenant actif ✨`)
            await refreshAiKeys()
          }

          async function handleDeleteKey(p: AiProvider) {
            if (!confirm(`Supprimer votre clé ${PROVIDER_META[p].name} ?`)) return
            setAiLoading(p)
            const { ok, json } = await callApi({ action: 'delete', provider: p })
            setAiLoading(null)
            if (!ok) { toast.error(json.error ?? 'Erreur'); return }
            toast.success('Clé supprimée')
            if (expandedProvider === p) setExpandedProvider(null)
            await refreshAiKeys()
          }

          // ── Vue détail d'un provider ────────────────────────────────────────
          const ep = expandedProvider
          if (ep) {
            const meta    = PROVIDER_META[ep]
            const status  = providers[ep]
            const isAct   = activeProvider === ep
            const inputVal = aiInputs[ep]
            const inputT   = inputVal.trim()
            const invalid  = inputT.length > 4 && !inputT.startsWith(meta.prefix)
            const canSave  = inputT.length >= 20 && inputT.startsWith(meta.prefix) && aiLoading !== ep

            return (
              <div className="space-y-4">
                {/* Back */}
                <button type="button" onClick={() => setExpandedProvider(null)}
                  className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium transition">
                  ← Choisir un autre provider
                </button>

                {/* Provider header */}
                <div className={cn('rounded-xl border p-4', isAct ? `${meta.activeBg} ${meta.activeBorder}` : 'border-gray-200 bg-gray-50')}>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0', meta.activeBg, meta.accent)}>
                      {meta.initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-sm font-semibold', isAct ? meta.accent : 'text-gray-800')}>{meta.name}</span>
                        <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', meta.badgeCls)}>{meta.badge}</span>
                        {isAct && (
                          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full border bg-white', meta.activeBorder, meta.accent)}>
                            <CheckCircle2 className="w-3 h-3" /> Actif
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">{meta.note}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {status.configured && !isAct && (
                        <button type="button" onClick={() => handleActivateKey(ep)} disabled={aiLoading === ep}
                          className="text-xs px-3 py-1.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition disabled:opacity-50 font-medium">
                          {aiLoading === ep ? '…' : 'Activer'}
                        </button>
                      )}
                      {status.configured && (
                        <button type="button" onClick={() => handleDeleteKey(ep)} disabled={aiLoading === ep}
                          className="inline-flex items-center gap-1 text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition">
                          <Trash2 className="w-3 h-3" /> Supprimer
                        </button>
                      )}
                    </div>
                  </div>
                  {status.configured && (
                    <div className="mt-3 flex items-center gap-2 text-xs">
                      <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0" />
                      <span className="font-mono text-gray-600">{status.masked}</span>
                      <span className="text-gray-300">·</span>
                      <span className="text-gray-400">Clé enregistrée</span>
                    </div>
                  )}
                </div>

                {/* Instructions */}
                <div className="bg-violet-50 border border-violet-100 rounded-xl px-4 py-3.5 space-y-2">
                  <p className="text-[11px] font-semibold text-violet-700 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5" />
                    Comment obtenir votre clé {meta.name}
                  </p>
                  <ol className="list-decimal list-inside space-y-1.5">
                    {meta.steps.map((s, i) => (
                      <li key={i} className="text-[11px] text-gray-600 leading-relaxed">
                        {s.text}{' '}
                        {s.link && (
                          <a href={s.link.href} target="_blank" rel="noopener noreferrer"
                            className="text-violet-600 underline hover:text-violet-800 inline-flex items-center gap-0.5">
                            {s.link.label} <ExternalLink className="w-2.5 h-2.5" />
                          </a>
                        )}
                      </li>
                    ))}
                  </ol>
                </div>

                {/* Champ clé */}
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1.5">
                    {status.configured ? 'Remplacer la clé' : 'Coller votre clé API'}
                  </label>
                  <div className="flex items-stretch gap-2">
                    <div className="relative flex-1">
                      <input
                        type={aiShow[ep] ? 'text' : 'password'}
                        value={inputVal}
                        onChange={e => setAiInputs(s => ({ ...s, [ep]: e.target.value }))}
                        placeholder={status.configured ? `Remplacer · ${meta.placeholder}` : meta.placeholder}
                        className={cn(
                          'w-full px-3 pr-10 py-2.5 border rounded-lg text-sm font-mono text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2',
                          invalid ? 'border-red-300 focus:ring-red-300' : 'border-gray-200 focus:ring-violet-500'
                        )}
                      />
                      <button type="button" onClick={() => setAiShow(s => ({ ...s, [ep]: !s[ep] }))}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {aiShow[ep] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    <button type="button" disabled={!canSave} onClick={() => handleSaveKey(ep)}
                      className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition disabled:opacity-50">
                      <KeyRound className="w-4 h-4" />
                      {aiLoading === ep ? '…' : 'Sauvegarder'}
                    </button>
                  </div>
                  {invalid && (
                    <p className="mt-1 text-xs text-red-500">La clé doit commencer par « {meta.prefix} »</p>
                  )}
                </div>

                {/* Test connexion */}
                {isAct && (
                  <div className="flex items-center gap-3 flex-wrap pt-1">
                    <button type="button" onClick={handleTestKey} disabled={testLoading}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-violet-300 text-violet-700 rounded-lg hover:bg-violet-50 transition disabled:opacity-50">
                      <Sparkles className="w-3.5 h-3.5" />
                      {testLoading ? 'Test en cours…' : 'Tester la connexion IA'}
                    </button>
                    {testResult && (
                      <p className={cn('text-xs', testResult.ok ? 'text-green-700' : 'text-red-600')}>
                        {testResult.message}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )
          }

          // ── Vue picker (sélection du provider) ─────────────────────────────
          const anyConfigured = Object.values(providers).some(s => s.configured)
          return (
            <div className="space-y-3">
              {/* Provider actif */}
              {activeProvider && (
                <div className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border',
                  PROVIDER_META[activeProvider].activeBg,
                  PROVIDER_META[activeProvider].activeBorder,
                  PROVIDER_META[activeProvider].accent
                )}>
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  Provider actif : <strong>{PROVIDER_META[activeProvider].name}</strong>
                  <button type="button" onClick={handleTestKey} disabled={testLoading}
                    className="ml-auto inline-flex items-center gap-1 text-[11px] underline opacity-70 hover:opacity-100">
                    <Sparkles className="w-3 h-3" />
                    {testLoading ? 'Test…' : 'Tester'}
                  </button>
                </div>
              )}
              {activeProvider && testResult && (
                <p className={cn('text-xs px-1', testResult.ok ? 'text-green-700' : 'text-red-600')}>
                  {testResult.message}
                </p>
              )}

              {/* Grille de sélection */}
              <p className="text-xs text-gray-500 font-medium">Sélectionnez un provider pour le configurer :</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(['gemini', 'openai', 'claude', 'groq', 'huggingface'] as AiProvider[]).map(p => {
                  const meta   = PROVIDER_META[p]
                  const status = providers[p]
                  const isAct  = activeProvider === p
                  return (
                    <button key={p} type="button" onClick={() => setExpandedProvider(p)}
                      className={cn(
                        'flex items-center gap-3 p-3 rounded-xl border text-left transition hover:shadow-sm group',
                        isAct
                          ? `${meta.activeBg} ${meta.activeBorder}`
                          : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
                      )}>
                      <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold shrink-0', meta.activeBg, meta.accent)}>
                        {meta.initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn('text-xs font-semibold', isAct ? meta.accent : 'text-gray-800')}>
                            {meta.name}
                          </span>
                          <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full font-medium', meta.badgeCls)}>
                            {meta.badge}
                          </span>
                          {isAct && (
                            <span className={cn('text-[10px] font-bold', meta.accent)}>✓ Actif</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {status.configured ? (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                              <span className="text-[10px] text-gray-500 font-mono truncate">{status.masked}</span>
                            </>
                          ) : (
                            <>
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-200 shrink-0" />
                              <span className="text-[10px] text-gray-400">Non configurée</span>
                            </>
                          )}
                        </div>
                      </div>
                      <span className="text-gray-300 group-hover:text-gray-500 transition shrink-0 text-sm">→</span>
                    </button>
                  )
                })}
              </div>

              {!anyConfigured && (
                <p className="text-xs text-gray-400 text-center py-1">
                  Aucune clé configurée — choisissez un provider ci-dessus pour commencer
                </p>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}

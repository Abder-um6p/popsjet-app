'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { Eye, EyeOff, Lock, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'

function PasswordStrength({ password }: { password: string }) {
  const checks = [
    { label: '8 caractères minimum', ok: password.length >= 8 },
    { label: 'Une majuscule', ok: /[A-Z]/.test(password) },
    { label: 'Un chiffre', ok: /\d/.test(password) },
    { label: 'Un caractère spécial', ok: /[^A-Za-z0-9]/.test(password) },
  ]
  const score = checks.filter(c => c.ok).length

  const color =
    score <= 1 ? 'bg-red-500' :
    score === 2 ? 'bg-orange-400' :
    score === 3 ? 'bg-yellow-400' :
    'bg-green-500'

  const label =
    score <= 1 ? 'Faible' :
    score === 2 ? 'Moyen' :
    score === 3 ? 'Bon' :
    'Fort'

  if (!password) return null

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${color}`}
            style={{ width: `${(score / 4) * 100}%` }}
          />
        </div>
        <span className={`text-xs font-medium ${
          score <= 1 ? 'text-red-500' :
          score === 2 ? 'text-orange-500' :
          score === 3 ? 'text-yellow-600' :
          'text-green-600'
        }`}>{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-1">
        {checks.map(c => (
          <div key={c.label} className="flex items-center gap-1.5">
            {c.ok
              ? <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
              : <XCircle className="w-3 h-3 text-gray-300 shrink-0" />
            }
            <span className={`text-xs ${c.ok ? 'text-gray-600' : 'text-gray-400'}`}>
              {c.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [ready, setReady] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const supabase = createClient()

    // Vérifier la session existante (flux PKCE via callback)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setReady(true)
    })

    // Écouter les événements auth — PASSWORD_RECOVERY (hash) ou SIGNED_IN (PKCE)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session)) {
        setReady(true)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Les mots de passe ne correspondent pas')
      return
    }
    if (password.length < 8) {
      toast.error('Le mot de passe doit faire au moins 8 caractères')
      return
    }

    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      toast.error(error.message)
      setLoading(false)
      return
    }

    setDone(true)
    toast.success('Mot de passe mis à jour !')
    // Vérifier si l'onboarding est complété (user invité → onboarding, sinon dashboard)
    const supabase2 = createClient()
    const { data: { user: u } } = await supabase2.auth.getUser()
    if (u) {
      const { data: profile } = await supabase2.from('profiles').select('onboarding_completed').eq('id', u.id).single()
      setTimeout(() => router.push(profile?.onboarding_completed ? '/dashboard' : '/auth/onboarding'), 2500)
    } else {
      setTimeout(() => router.push('/dashboard'), 2500)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 px-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <img src="/logo.svg" alt="Jet Pops" className="w-16 h-16 rounded-2xl shadow-md" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Jet Pops</h1>
          <p className="text-gray-500 text-sm mt-1">I&E Lab Platform – UM6P</p>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-8">
          {done ? (
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Mot de passe mis à jour !</h2>
                <p className="text-sm text-gray-500 mt-2">
                  Redirection vers votre espace en cours…
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
                  <Lock className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-800">Nouveau mot de passe</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Choisissez un mot de passe sécurisé</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nouveau mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      autoComplete="new-password"
                      className="w-full px-4 pr-10 py-2.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder-gray-400 transition"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <PasswordStrength password={password} />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confirmer le mot de passe
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirm}
                      onChange={(e) => setConfirm(e.target.value)}
                      required
                      autoComplete="new-password"
                      className={`w-full px-4 pr-10 py-2.5 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm text-gray-900 placeholder-gray-400 transition ${
                        confirm && password !== confirm
                          ? 'border-red-300 ring-1 ring-red-300'
                          : 'border-gray-200'
                      }`}
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {confirm && password !== confirm && (
                    <p className="text-xs text-red-500 mt-1">Les mots de passe ne correspondent pas</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading || !ready || password !== confirm || password.length < 8}
                  className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-medium rounded-lg transition text-sm mt-2"
                >
                  {loading ? 'Mise à jour…' : 'Définir le nouveau mot de passe'}
                </button>
              </form>

              <div className="mt-4 text-center">
                <Link href="/auth/login" className="text-xs text-gray-400 hover:text-gray-600 transition">
                  Retour à la connexion
                </Link>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

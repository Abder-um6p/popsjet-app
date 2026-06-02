'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, UserPlus, Mail, ShieldCheck, Send, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

const schema = z.object({
  email: z.string().email('Email invalide'),
  role: z.enum(['admin', 'directeur', 'chef_projet', 'membre'], {
    required_error: 'Rôle requis',
  }),
  note: z.string().max(300, 'Note trop longue').optional(),
})

type FormData = z.infer<typeof schema>

const ROLE_OPTIONS = [
  {
    value: 'admin',
    label: 'Administrateur',
    desc: 'Accès complet à toutes les fonctionnalités',
    color: 'text-red-600',
    bg: 'bg-red-50 border-red-200',
    selectedBg: 'bg-red-600 text-white border-red-600',
  },
  {
    value: 'directeur',
    label: 'Directeur',
    desc: 'Supervision des projets, accès aux rapports',
    color: 'text-purple-600',
    bg: 'bg-purple-50 border-purple-200',
    selectedBg: 'bg-purple-600 text-white border-purple-600',
  },
  {
    value: 'chef_projet',
    label: 'Chef de projet',
    desc: 'Crée et gère des projets',
    color: 'text-blue-600',
    bg: 'bg-blue-50 border-blue-200',
    selectedBg: 'bg-blue-600 text-white border-blue-600',
  },
  {
    value: 'membre',
    label: 'Membre',
    desc: 'Participe aux projets assignés',
    color: 'text-gray-600',
    bg: 'bg-gray-50 border-gray-200',
    selectedBg: 'bg-gray-600 text-white border-gray-600',
  },
]

export default function AddUserModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [sentEmail, setSentEmail] = useState('')

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'membre' },
  })

  const selectedRole = watch('role')

  async function onSubmit(data: FormData) {
    setLoading(true)
    const res = await fetch('/api/admin/users/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? 'Erreur lors de l\'invitation')
      setLoading(false)
      return
    }
    setSentEmail(data.email)
    setSent(true)
    setLoading(false)
    toast.success(json.updated ? 'Rôle mis à jour' : 'Invitation envoyée !')
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder-gray-400'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <UserPlus className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Inviter un utilisateur</h2>
              <p className="text-xs text-gray-400 mt-0.5">Un email d'invitation sera envoyé</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5">
          {sent ? (
            /* Success state */
            <div className="text-center py-6 space-y-4">
              <div className="w-16 h-16 rounded-full bg-green-50 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Invitation envoyée !</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Un email d'invitation a été envoyé à <strong>{sentEmail}</strong>.
                  L'utilisateur devra cliquer sur le lien pour compléter son onboarding.
                </p>
              </div>
              <div className="flex gap-3 justify-center pt-2">
                <button
                  onClick={() => { setSent(false); setSentEmail('') }}
                  className="px-4 py-2 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
                >
                  Inviter un autre
                </button>
                <button
                  onClick={onSuccess}
                  className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                >
                  Fermer
                </button>
              </div>
            </div>
          ) : (
            <form id="invite-form" onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              {/* Email */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Adresse email <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input
                    {...register('email')}
                    type="email"
                    placeholder="prenom.nom@um6p.ma"
                    className={cn(inputCls, 'pl-9', errors.email && 'border-red-300 ring-1 ring-red-300')}
                  />
                </div>
                {errors.email && (
                  <p className="text-xs text-red-500 mt-1">{errors.email.message}</p>
                )}
              </div>

              {/* Role — card-style selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rôle sur la plateforme <span className="text-red-500">*</span>
                </label>
                <div className="space-y-2">
                  {ROLE_OPTIONS.map(opt => {
                    const selected = selectedRole === opt.value
                    return (
                      <label
                        key={opt.value}
                        className={cn(
                          'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                          selected
                            ? 'border-blue-500 bg-blue-50/60 shadow-[0_0_0_2px_#3b82f6]'
                            : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        )}
                      >
                        <input
                          type="radio"
                          value={opt.value}
                          checked={selected}
                          onChange={() => setValue('role', opt.value as FormData['role'])}
                          className="sr-only"
                        />
                        <div className={cn(
                          'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                          selected ? 'bg-blue-100' : 'bg-gray-100'
                        )}>
                          <ShieldCheck className={cn('w-4 h-4', selected ? 'text-blue-600' : 'text-gray-400')} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className={cn('text-sm font-medium', selected ? 'text-blue-700' : 'text-gray-800')}>
                            {opt.label}
                          </div>
                          <div className="text-xs text-gray-400 mt-0.5">{opt.desc}</div>
                        </div>
                        <div className={cn(
                          'w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center',
                          selected ? 'border-blue-600 bg-blue-600' : 'border-gray-300'
                        )}>
                          {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                        </div>
                      </label>
                    )
                  })}
                </div>
                {errors.role && (
                  <p className="text-xs text-red-500 mt-1">{errors.role.message}</p>
                )}
              </div>

              {/* Note interne */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Note interne <span className="text-gray-400 font-normal">(optionnel)</span>
                </label>
                <textarea
                  {...register('note')}
                  rows={2}
                  placeholder="Ex: Chef de projet — rejoint l'équipe Innovation Hub"
                  className={cn(inputCls, 'resize-none')}
                />
                {errors.note && (
                  <p className="text-xs text-red-500 mt-1">{errors.note.message}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  Cette note n'est visible que par les administrateurs
                </p>
              </div>
            </form>
          )}
        </div>

        {/* Footer */}
        {!sent && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 shrink-0 bg-gray-50/50 rounded-b-2xl">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
            >
              Annuler
            </button>
            <button
              type="submit"
              form="invite-form"
              disabled={loading}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50 shadow-sm"
            >
              <Send className="w-3.5 h-3.5" />
              {loading ? 'Envoi en cours…' : 'Envoyer l\'invitation'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

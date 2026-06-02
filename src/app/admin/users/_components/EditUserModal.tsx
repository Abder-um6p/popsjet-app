'use client'

import { useState } from 'react'
import { X, ShieldAlert, ShieldCheck, AlertTriangle, Check } from 'lucide-react'
import { toast } from 'sonner'
import { cn, LABELS } from '@/lib/utils'
import type { AdminUser } from './UserTable'

const ROLE_OPTIONS = [
  { value: 'admin',       label: 'Administrateur', desc: 'Accès complet', color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200',    critical: true },
  { value: 'directeur',   label: 'Directeur',      desc: 'Supervision',   color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200', critical: true },
  { value: 'chef_projet', label: 'Chef de projet', desc: 'Gestion projet', color: 'text-blue-600',  bg: 'bg-blue-50',   border: 'border-blue-200',   critical: false },
  { value: 'membre',      label: 'Membre',         desc: 'Accès standard', color: 'text-gray-600',  bg: 'bg-gray-50',   border: 'border-gray-200',   critical: false },
]

const CRITICAL_ROLES = ['admin', 'directeur']

export default function EditUserModal({
  user,
  onClose,
  onSuccess,
}: {
  user: AdminUser
  onClose: () => void
  onSuccess: () => void
}) {
  const [selectedRole, setSelectedRole] = useState(user.role)
  const [loading, setLoading] = useState(false)
  const [confirming, setConfirming] = useState(false)

  const hasChanged = selectedRole !== user.role
  const isCriticalChange = (
    CRITICAL_ROLES.includes(selectedRole) ||
    CRITICAL_ROLES.includes(user.role)
  ) && hasChanged

  async function handleSave() {
    if (!hasChanged) { onClose(); return }
    if (isCriticalChange && !confirming) {
      setConfirming(true)
      return
    }
    setLoading(true)
    const res = await fetch(`/api/admin/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'role', role: selectedRole }),
    })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? 'Erreur')
      setLoading(false)
      return
    }
    toast.success(`Rôle mis à jour → ${LABELS.user_role[selectedRole as keyof typeof LABELS.user_role]}`)
    onSuccess()
  }

  const selectedOpt = ROLE_OPTIONS.find(r => r.value === selectedRole)
  const currentOpt  = ROLE_OPTIONS.find(r => r.value === user.role)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900">Modifier le rôle</h2>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{user.full_name} — {user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {/* Current role */}
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
            <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center', currentOpt?.bg)}>
              <ShieldCheck className={cn('w-3.5 h-3.5', currentOpt?.color)} />
            </div>
            <div>
              <div className="text-xs text-gray-400">Rôle actuel</div>
              <div className={cn('text-sm font-semibold', currentOpt?.color)}>{currentOpt?.label}</div>
            </div>
          </div>

          {/* Role selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Nouveau rôle</label>
            <div className="space-y-2">
              {ROLE_OPTIONS.map(opt => {
                const selected = selectedRole === opt.value
                const isCurrent = user.role === opt.value
                return (
                  <label
                    key={opt.value}
                    className={cn(
                      'flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all',
                      selected && !isCurrent
                        ? 'border-blue-500 bg-blue-50/60 shadow-[0_0_0_2px_#3b82f6]'
                        : isCurrent && selected
                          ? 'border-gray-200 bg-gray-50/50'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                    )}
                  >
                    <input
                      type="radio"
                      checked={selected}
                      onChange={() => { setSelectedRole(opt.value); setConfirming(false) }}
                      className="sr-only"
                    />
                    <div className={cn('w-7 h-7 rounded-lg flex items-center justify-center shrink-0', opt.bg)}>
                      <ShieldCheck className={cn('w-3.5 h-3.5', opt.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={cn('text-sm font-medium', selected ? opt.color : 'text-gray-800')}>
                          {opt.label}
                        </span>
                        {isCurrent && (
                          <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">
                            Actuel
                          </span>
                        )}
                        {opt.critical && (
                          <ShieldAlert className="w-3 h-3 text-orange-400" />
                        )}
                      </div>
                      <div className="text-xs text-gray-400">{opt.desc}</div>
                    </div>
                    <div className={cn(
                      'w-4 h-4 rounded-full border-2 shrink-0',
                      selected ? 'border-blue-600 bg-blue-600 flex items-center justify-center' : 'border-gray-300'
                    )}>
                      {selected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </div>
                  </label>
                )
              })}
            </div>
          </div>

          {/* Critical change warning */}
          {confirming && isCriticalChange && (
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <div className="font-semibold text-amber-800 mb-1">Confirmation requise</div>
                <p className="text-amber-700 text-xs leading-relaxed">
                  Vous êtes sur le point de changer un rôle critique.{' '}
                  {CRITICAL_ROLES.includes(selectedRole)
                    ? `Attribuer le rôle "${selectedOpt?.label}" donne des accès étendus à la plateforme.`
                    : `Retirer le rôle "${currentOpt?.label}" supprime des permissions importantes.`
                  }
                </p>
                <div className="mt-2 flex items-center gap-2 text-xs font-medium text-amber-700">
                  <span className="line-through opacity-60">{currentOpt?.label}</span>
                  <span>→</span>
                  <span className="font-semibold">{selectedOpt?.label}</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Annuler
          </button>
          {confirming && isCriticalChange ? (
            <>
              <button
                onClick={() => setConfirming(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
              >
                Revenir
              </button>
              <button
                onClick={handleSave}
                disabled={loading}
                className="inline-flex items-center gap-2 px-5 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg hover:bg-amber-600 transition disabled:opacity-50"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {loading ? 'Enregistrement…' : 'Confirmer le changement'}
              </button>
            </>
          ) : (
            <button
              onClick={handleSave}
              disabled={loading || !hasChanged}
              className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              <Check className="w-3.5 h-3.5" />
              {loading ? 'Enregistrement…' : isCriticalChange ? 'Continuer' : 'Enregistrer'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

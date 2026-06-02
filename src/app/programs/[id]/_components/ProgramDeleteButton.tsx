'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, RefreshCw, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface Props {
  programId:   string
  programName: string
}

export default function ProgramDeleteButton({ programId, programName }: Props) {
  const router = useRouter()
  const [showModal,  setShowModal]  = useState(false)
  const [loading,    setLoading]    = useState(false)
  const [confirmed,  setConfirmed]  = useState(false)

  async function handleDelete() {
    setLoading(true)
    const res  = await fetch(`/api/programs/${programId}/delete`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) {
      toast.error(json.error ?? 'Erreur lors de la suppression')
      setLoading(false)
    } else {
      toast.success(`« ${json.name} » déplacé dans la corbeille`)
      router.push('/programs')
    }
  }

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="inline-flex items-center gap-2 px-4 py-2 border border-red-200 text-red-600 text-sm font-medium rounded-lg hover:bg-red-50 transition"
      >
        <Trash2 className="w-4 h-4" />
        Mettre à la corbeille
      </button>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-amber-500" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-gray-900">Mettre à la corbeille ?</h3>
                <p className="text-xs text-gray-500 mt-0.5">Peut être restauré depuis la corbeille</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
              <p className="text-sm font-semibold text-gray-900">{programName}</p>
            </div>

            <p className="text-sm text-gray-600 leading-relaxed">
              Le programme sera déplacé dans la corbeille. Ses projets et données resteront intacts.
              Vous pourrez le restaurer depuis{' '}
              <span className="font-medium text-blue-600">Programmes → Corbeille</span>.
            </p>

            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={e => setConfirmed(e.target.checked)}
                className="mt-0.5 w-4 h-4 rounded border-gray-300 text-red-600 focus:ring-red-500"
              />
              <span className="text-xs text-gray-600">
                Je confirme vouloir déplacer ce programme dans la corbeille.
              </span>
            </label>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Annuler
              </button>
              <button
                onClick={handleDelete}
                disabled={loading || !confirmed}
                className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-40"
              >
                {loading
                  ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  : <Trash2 className="w-3.5 h-3.5" />
                }
                {loading ? 'Déplacement…' : 'Mettre à la corbeille'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

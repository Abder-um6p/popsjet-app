import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import TrashCenter from './_components/TrashCenter'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Corbeille — Jet Pops' }

export default async function TrashPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, role, full_name')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/auth/login')

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour au dashboard
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Corbeille globale</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Restaurez ou supprimez définitivement les éléments supprimés
            </p>
          </div>
        </div>
      </div>

      <TrashCenter userRole={profile.role} userId={profile.id} />
    </div>
  )
}

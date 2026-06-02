import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trash2 } from 'lucide-react'
import ProgramsTrashTable from './_components/TrashTable'

export const dynamic = 'force-dynamic'

export default async function ProgramsTrashPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'directeur'].includes(profile.role)) {
    redirect('/programs')
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/programs"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition mb-4"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Retour aux programmes
        </Link>
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center">
            <Trash2 className="w-5 h-5 text-red-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Corbeille des programmes</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Restaurez ou supprimez définitivement les programmes supprimés
            </p>
          </div>
        </div>
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-100 rounded-xl text-sm text-amber-700">
        <Trash2 className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
        <p>
          Les programmes dans la corbeille conservent leurs projets et références budgétaires associés.{' '}
          <strong>La suppression définitive est irréversible.</strong>{' '}
          Seuls les administrateurs et directeurs peuvent effectuer ces actions.
        </p>
      </div>

      <ProgramsTrashTable />
    </div>
  )
}

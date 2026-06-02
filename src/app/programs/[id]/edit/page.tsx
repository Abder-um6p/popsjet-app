import { createAdminClient, createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { Layers } from 'lucide-react'
import EditProgramForm from './_components/EditProgramForm'

export default async function EditProgramPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  const { data: profile } = await admin
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile || !['admin', 'directeur'].includes(profile.role)) {
    redirect(`/programs/${id}`)
  }

  const { data: row } = await admin
    .from('programs')
    .select('*')
    .eq('id', id)
    .single()

  if (!row || (row.deleted_at && row.deleted_at !== null)) notFound()

  const program = {
    id:              row.id,
    name:            row.name,
    code:            row.code,
    description:     row.description     ?? null,
    objectives:      row.objectives      ?? null,
    is_active:       row.is_active       ?? true,
    is_confidential: row.is_confidential ?? false,
    start_date:      row.start_date      ?? null,
    end_date:        row.end_date        ?? null,
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Layers className="w-5 h-5 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-gray-900">Modifier le programme</h1>
          <p className="text-xs text-gray-400 font-mono mt-0.5">{program.code} · {program.name}</p>
        </div>
      </div>

      <EditProgramForm program={program} />
    </div>
  )
}

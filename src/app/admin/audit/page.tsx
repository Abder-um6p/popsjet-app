import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { ShieldCheck } from 'lucide-react'
import AuditTable from './_components/AuditTable'

export default async function AuditPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'admin') redirect('/dashboard')

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Audit Logs</h1>
          <p className="text-sm text-gray-500 mt-0.5">Historique complet des actions sur la plateforme</p>
        </div>
      </div>

      <AuditTable />
    </div>
  )
}

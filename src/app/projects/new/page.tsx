import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import NewProjectForm from './_components/NewProjectFormLoader'

export default async function NewProjectPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!['admin', 'directeur', 'chef_projet'].includes(profile?.role ?? '')) {
    redirect('/projects')
  }

  const adminClient = createAdminClient()
  const [{ data: programs }, { data: profiles }] = await Promise.all([
    supabase
      .from('programs')
      .select('id, name, description')
      .is('deleted_at', null)
      .order('name'),
    adminClient
      .from('profiles')
      .select('id, full_name, email, role, avatar_url')
      .eq('onboarding_completed', true)
      .order('full_name'),
  ])

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex items-center gap-3">
        <Link
          href="/projects"
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Nouveau projet</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Configurez votre projet en quelques étapes
          </p>
        </div>
      </div>

      <NewProjectForm
        programs={programs ?? []}
        profiles={profiles ?? []}
        currentUserId={user.id}
        currentUserRole={profile?.role ?? 'membre'}
      />
    </div>
  )
}

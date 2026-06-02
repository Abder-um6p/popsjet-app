import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TasksUI from './_components/TasksUI'

export default async function TasksPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single()

  return <TasksUI userId={user.id} role={profile?.role ?? 'membre'} />
}

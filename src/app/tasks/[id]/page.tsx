import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import TaskDetailUI from './_components/TaskDetailUI'

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, role')
    .eq('id', user.id)
    .single()

  return (
    <TaskDetailUI
      taskId={id}
      userId={user.id}
      role={profile?.role ?? 'membre'}
    />
  )
}

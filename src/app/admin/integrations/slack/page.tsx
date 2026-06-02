import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import SlackConfigForm from './_components/SlackConfigForm'

export default async function SlackIntegrationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  let initialData = {
    enabled: false,
    config: { mode: 'webhook' as 'webhook' | 'bot_token', webhook_url: '', bot_token: '', default_channel: '#popsjet-notifications' },
    options: { notify_project_created: true, notify_task_assigned: true, notify_member_added: true, notify_task_status: false, notify_document_upload: false, channel_projects: '', channel_tasks: '' },
    tested_at: null as string | null,
  }

  try {
    const { data } = await admin
      .from('integration_settings')
      .select('enabled, config, options, tested_at')
      .eq('provider', 'slack')
      .single()

    if (data) {
      const config = data.config as Record<string, string>
      initialData = {
        enabled: data.enabled ?? false,
        config: {
          mode:            (config.mode as 'webhook' | 'bot_token') ?? 'webhook',
          webhook_url:     config.webhook_url ?? '',
          bot_token:       config.bot_token ? '••••••••••••••••' : '',
          default_channel: config.default_channel ?? '#popsjet-notifications',
        },
        options: { ...initialData.options, ...(data.options as object) },
        tested_at: data.tested_at ?? null,
      }
    }
  } catch { /* table pas encore migrée */ }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/integrations" className="flex items-center gap-1 hover:text-gray-700 transition">
          <ChevronLeft className="w-4 h-4" /> Intégrations
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Slack</span>
      </div>

      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
            <path d="M5.04 15.17a2.5 2.5 0 1 1-2.5-2.5h2.5v2.5z" fill="#E01E5A"/>
            <path d="M6.3 15.17a2.5 2.5 0 0 1 5 0v6.26a2.5 2.5 0 1 1-5 0v-6.26z" fill="#E01E5A"/>
            <path d="M8.83 5.04a2.5 2.5 0 1 1 2.5-2.5v2.5h-2.5z" fill="#36C5F0"/>
            <path d="M8.83 6.3a2.5 2.5 0 0 1 0 5H2.57a2.5 2.5 0 1 1 0-5h6.26z" fill="#36C5F0"/>
            <path d="M18.96 8.83a2.5 2.5 0 1 1 2.5 2.5h-2.5v-2.5z" fill="#2EB67D"/>
            <path d="M17.7 8.83a2.5 2.5 0 0 1-5 0V2.57a2.5 2.5 0 1 1 5 0v6.26z" fill="#2EB67D"/>
            <path d="M15.17 18.96a2.5 2.5 0 1 1-2.5 2.5v-2.5h2.5z" fill="#ECB22E"/>
            <path d="M15.17 17.7a2.5 2.5 0 0 1 0-5h6.26a2.5 2.5 0 1 1 0 5h-6.26z" fill="#ECB22E"/>
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Slack</h1>
          <p className="text-sm text-gray-500 mt-0.5 max-w-xl">
            Recevez des notifications dans vos canaux Slack à chaque événement important : création de projet, assignation de tâche, ajout de membre.
          </p>
        </div>
      </div>

      <SlackConfigForm initialData={initialData} />
    </div>
  )
}

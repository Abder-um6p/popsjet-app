import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import GoogleConfigForm from './_components/GoogleConfigForm'

export default async function GoogleIntegrationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  let initialData = {
    enabled: false,
    config: { service_account_email: '', service_account_private_key: '', drive_folder_id: '' },
    options: { auto_create_folder: true, auto_share_members: true, create_task_subfolder: true, generate_sharing_links: true, share_role: 'reader' as 'reader' | 'commenter' | 'writer' },
    tested_at: null as string | null,
  }

  try {
    const { data } = await admin
      .from('integration_settings')
      .select('enabled, config, options, tested_at')
      .eq('provider', 'google')
      .single()

    if (data) {
      const config = data.config as Record<string, string>
      initialData = {
        enabled: data.enabled ?? false,
        config: {
          service_account_email:       config.service_account_email       ?? '',
          service_account_private_key: config.service_account_private_key ? '••••••••••••••••' : '',
          drive_folder_id:             config.drive_folder_id             ?? '',
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
        <span className="text-gray-900 font-medium">Google Workspace</span>
      </div>

      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-8 h-8">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Google Workspace</h1>
          <p className="text-sm text-gray-500 mt-0.5 max-w-xl">
            Créez automatiquement des dossiers Google Drive à la création de chaque projet et partagez-les avec les membres de l'équipe via un Service Account.
          </p>
        </div>
      </div>

      <GoogleConfigForm initialData={initialData} />
    </div>
  )
}

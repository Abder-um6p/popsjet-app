import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import MicrosoftConfigForm from './_components/MicrosoftConfigForm'

export default async function MicrosoftIntegrationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminClient()

  let initialData = {
    enabled:    false,
    config: {
      tenant_id:          '',
      client_id:          '',
      client_secret:      '',
      storage_backend:    'onedrive' as 'sharepoint' | 'onedrive',
      sharepoint_site_id: '',
      onedrive_user:      '',
    },
    options: {
      auto_create_folder:     true,
      auto_invite_members:    true,
      create_task_subfolder:  true,
      generate_sharing_links: true,
      link_type:              'view' as 'view' | 'edit',
    },
    tested_at: null as string | null,
  }

  try {
    const { data } = await admin
      .from('integration_settings')
      .select('enabled, config, options, tested_at')
      .eq('provider', 'microsoft')
      .single()

    if (data) {
      const config = data.config as Record<string, string>
      initialData = {
        enabled: data.enabled ?? false,
        config: {
          tenant_id:          config.tenant_id          ?? '',
          client_id:          config.client_id          ?? '',
          client_secret:      config.client_secret ? '••••••••••••••••' : '',
          storage_backend:    (config.storage_backend as 'sharepoint' | 'onedrive') ?? 'onedrive',
          sharepoint_site_id: config.sharepoint_site_id ?? '',
          onedrive_user:      config.onedrive_user      ?? '',
        },
        options: { ...initialData.options, ...(data.options as object) },
        tested_at: data.tested_at ?? null,
      }
    }
  } catch { /* table pas encore migrée */ }

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/admin/integrations" className="flex items-center gap-1 hover:text-gray-700 transition">
          <ChevronLeft className="w-4 h-4" />
          Intégrations
        </Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Microsoft 365</span>
      </div>

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
          <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none">
            <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
            <rect x="13" y="1" width="10" height="10" fill="#7fba00"/>
            <rect x="1" y="13" width="10" height="10" fill="#00a4ef"/>
            <rect x="13" y="13" width="10" height="10" fill="#ffb900"/>
          </svg>
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Microsoft 365</h1>
          <p className="text-sm text-gray-500 mt-0.5 max-w-xl">
            Créez automatiquement des dossiers SharePoint/OneDrive à la création de chaque projet, partagez-les avec les membres de l'équipe et stockez tous les fichiers sur le compte Microsoft de votre entreprise.
          </p>
        </div>
      </div>

      {/* Formulaire client */}
      <MicrosoftConfigForm initialData={initialData} />
    </div>
  )
}

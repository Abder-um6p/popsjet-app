import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plug, ChevronRight, CheckCircle2, XCircle } from 'lucide-react'

export default async function IntegrationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user!.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  // Charge l'état de toutes les intégrations
  const admin = createAdminClient()

  let microsoftEnabled  = false, microsoftTestedAt:  string | null = null
  let googleEnabled     = false, googleTestedAt:     string | null = null
  let slackEnabled      = false, slackTestedAt:      string | null = null

  try {
    const { data: rows } = await admin
      .from('integration_settings')
      .select('provider, enabled, tested_at')
      .in('provider', ['microsoft', 'google', 'slack'])

    for (const row of rows ?? []) {
      if (row.provider === 'microsoft') { microsoftEnabled = row.enabled; microsoftTestedAt = row.tested_at }
      if (row.provider === 'google')    { googleEnabled    = row.enabled; googleTestedAt    = row.tested_at }
      if (row.provider === 'slack')     { slackEnabled     = row.enabled; slackTestedAt     = row.tested_at }
    }
  } catch { /* table pas encore migrée */ }

  const integrations = [
    {
      id:          'microsoft',
      name:        'Microsoft 365',
      description: 'SharePoint, OneDrive et Forms — stockage des fichiers et dossiers projets directement sur le compte Microsoft de l\'entreprise.',
      href:        '/admin/integrations/microsoft',
      enabled:     microsoftEnabled,
      testedAt:    microsoftTestedAt,
      logo:        (
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
          <rect x="1" y="1" width="10" height="10" fill="#f25022"/>
          <rect x="13" y="1" width="10" height="10" fill="#7fba00"/>
          <rect x="1" y="13" width="10" height="10" fill="#00a4ef"/>
          <rect x="13" y="13" width="10" height="10" fill="#ffb900"/>
        </svg>
      ),
      badge: 'Recommandé',
    },
    {
      id:          'google',
      name:        'Google Workspace',
      description: 'Google Drive — créez automatiquement des dossiers Drive par projet et partagez-les avec les membres de l\'équipe via Service Account.',
      href:        '/admin/integrations/google',
      enabled:     googleEnabled,
      testedAt:    googleTestedAt,
      logo:        (
        <svg viewBox="0 0 24 24" className="w-7 h-7">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
      ),
      badge: null,
    },
    {
      id:          'slack',
      name:        'Slack',
      description: 'Notifications en temps réel dans vos canaux Slack : création de projet, assignation de tâche, ajout de membre.',
      href:        '/admin/integrations/slack',
      enabled:     slackEnabled,
      testedAt:    slackTestedAt,
      logo:        (
        <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none">
          <path d="M5.04 15.17a2.5 2.5 0 1 1-2.5-2.5h2.5v2.5z" fill="#E01E5A"/>
          <path d="M6.3 15.17a2.5 2.5 0 0 1 5 0v6.26a2.5 2.5 0 1 1-5 0v-6.26z" fill="#E01E5A"/>
          <path d="M8.83 5.04a2.5 2.5 0 1 1 2.5-2.5v2.5h-2.5z" fill="#36C5F0"/>
          <path d="M8.83 6.3a2.5 2.5 0 0 1 0 5H2.57a2.5 2.5 0 1 1 0-5h6.26z" fill="#36C5F0"/>
          <path d="M18.96 8.83a2.5 2.5 0 1 1 2.5 2.5h-2.5v-2.5z" fill="#2EB67D"/>
          <path d="M17.7 8.83a2.5 2.5 0 0 1-5 0V2.57a2.5 2.5 0 1 1 5 0v6.26z" fill="#2EB67D"/>
          <path d="M15.17 18.96a2.5 2.5 0 1 1-2.5 2.5v-2.5h2.5z" fill="#ECB22E"/>
          <path d="M15.17 17.7a2.5 2.5 0 0 1 0-5h6.26a2.5 2.5 0 1 1 0 5h-6.26z" fill="#ECB22E"/>
        </svg>
      ),
      badge: null,
    },
  ]

  return (
    <div className="space-y-8 max-w-3xl">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Plug className="w-5 h-5 text-gray-400" />
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Intégrations</h1>
        </div>
        <p className="text-sm text-gray-500">
          Connectez Popsjet à vos outils externes pour centraliser les fichiers et automatiser les workflows.
        </p>
      </div>

      {/* Liste */}
      <div className="space-y-3">
        {integrations.map(integration => {
          const isAvailable = integration.href !== '#'
          return (
            <div
              key={integration.id}
              className={`bg-white rounded-xl border shadow-sm overflow-hidden transition ${
                isAvailable ? 'border-gray-100 hover:border-gray-200' : 'border-gray-100 opacity-60'
              }`}
            >
              <div className="p-5 flex items-center gap-4">
                {/* Logo */}
                <div className="w-12 h-12 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center shrink-0">
                  {integration.logo}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-semibold text-gray-900">{integration.name}</span>
                    {integration.badge === 'Recommandé' && (
                      <span className="text-[10px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                        Recommandé
                      </span>
                    )}
                    {integration.badge === 'Bientôt' && (
                      <span className="text-[10px] font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                        Bientôt
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 leading-relaxed">{integration.description}</p>
                  {integration.testedAt && (
                    <p className="text-[10px] text-green-600 mt-1">
                      Dernière connexion réussie : {new Date(integration.testedAt).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  )}
                </div>

                {/* Statut + lien */}
                <div className="flex items-center gap-3 shrink-0">
                  {integration.enabled ? (
                    <div className="flex items-center gap-1.5 text-green-700 bg-green-50 px-2.5 py-1 rounded-full">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Activé</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-gray-400 bg-gray-50 px-2.5 py-1 rounded-full">
                      <XCircle className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">Désactivé</span>
                    </div>
                  )}
                  {isAvailable && (
                    <Link
                      href={integration.href}
                      className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition"
                    >
                      Configurer
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

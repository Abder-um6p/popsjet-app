'use client'

import { useState } from 'react'
import {
  Eye, EyeOff, CheckCircle2, XCircle, Loader2,
  Save, Power, FlaskConical, Info, AlertTriangle,
} from 'lucide-react'

interface Config {
  tenant_id:          string
  client_id:          string
  client_secret:      string
  storage_backend:    'sharepoint' | 'onedrive'
  sharepoint_site_id: string
  onedrive_user:      string
}

interface Options {
  auto_create_folder:     boolean
  auto_invite_members:    boolean
  create_task_subfolder:  boolean
  generate_sharing_links: boolean
  link_type:              'view' | 'edit'
}

interface Props {
  initialData: {
    enabled:   boolean
    config:    Config
    options:   Options
    tested_at: string | null
  }
}

export default function MicrosoftConfigForm({ initialData }: Props) {
  const [enabled,   setEnabled]   = useState(initialData.enabled)
  const [config,    setConfig]    = useState<Config>(initialData.config)
  const [options,   setOptions]   = useState<Options>(initialData.options)
  const [showSecret, setShowSecret] = useState(false)

  const [saving,       setSaving]       = useState(false)
  const [testing,      setTesting]      = useState(false)
  const [saveMsg,      setSaveMsg]      = useState<{ ok: boolean; text: string } | null>(null)
  const [testMsg,      setTestMsg]      = useState<{ ok: boolean; text: string } | null>(null)
  const [showConfirm,  setShowConfirm]  = useState(false)

  // ── Helpers ─────────────────────────────────────────────────────────────────

  function setField(field: keyof Config, value: string) {
    setConfig(prev => ({ ...prev, [field]: value }))
    setTestMsg(null)
  }

  function setOption(field: keyof Options, value: boolean | string) {
    setOptions(prev => ({ ...prev, [field]: value }))
  }

  // ── Sauvegarde ───────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true)
    setSaveMsg(null)
    try {
      const res = await fetch('/api/admin/integrations/microsoft', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ enabled, config, options }),
      })
      const data = await res.json()
      if (res.ok) {
        setSaveMsg({ ok: true, text: 'Configuration enregistrée.' })
      } else {
        setSaveMsg({ ok: false, text: data.error ?? 'Erreur lors de la sauvegarde.' })
      }
    } catch {
      setSaveMsg({ ok: false, text: 'Erreur réseau.' })
    } finally {
      setSaving(false)
    }
  }

  // ── Test connexion ────────────────────────────────────────────────────────────

  async function handleTest() {
    setTesting(true)
    setTestMsg(null)
    try {
      const res = await fetch('/api/admin/integrations/microsoft/test', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ config }),
      })
      const data = await res.json()
      setTestMsg({ ok: data.ok, text: data.message })
    } catch {
      setTestMsg({ ok: false, text: 'Erreur réseau.' })
    } finally {
      setTesting(false)
    }
  }

  // ── Rendu ─────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">

      {/* Modale confirmation désactivation */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Désactiver Microsoft 365 ?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  En désactivant ce plugin, les conséquences suivantes s'appliqueront :
                </p>
              </div>
            </div>
            <ul className="space-y-2 mb-5 ml-2">
              {[
                'Les nouveaux projets ne créeront plus de dossier SharePoint',
                'Les liens SharePoint existants seront toujours accessibles mais ne seront plus mis à jour',
                'Les nouvelles invitations de membres ne seront plus envoyées',
                'Les fichiers déjà uploadés sur SharePoint restent intacts',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                  <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirm(false)}
                className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">
                Annuler
              </button>
              <button onClick={() => { setEnabled(false); setShowConfirm(false) }}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition">
                Désactiver quand même
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Statut global */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-800">Statut du plugin</p>
            <p className="text-xs text-gray-400 mt-0.5">
              {enabled
                ? `Le plugin est actif — dossiers ${config.storage_backend === 'onedrive' ? 'OneDrive' : 'SharePoint'} créés automatiquement.`
                : `Le plugin est désactivé — aucune action sur ${config.storage_backend === 'onedrive' ? 'OneDrive' : 'SharePoint'}.`}
            </p>
          </div>
          <button
            onClick={() => enabled ? setShowConfirm(true) : setEnabled(true)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              enabled
                ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100'
                : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
            }`}
          >
            <Power className="w-4 h-4" />
            {enabled ? 'Désactiver' : 'Activer'}
          </button>
        </div>
      </div>

      {/* Credentials Azure */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-sm font-semibold text-gray-800">Identifiants Azure AD</h2>
          <a
            href="https://portal.azure.com/#view/Microsoft_AAD_RegisteredApps/ApplicationsListBlade"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center gap-0.5"
          >
            <Info className="w-3 h-3" /> Portail Azure
          </a>
        </div>

        <div className="grid grid-cols-1 gap-4">
          <Field
            label="Tenant ID"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={config.tenant_id}
            onChange={v => setField('tenant_id', v)}
            hint="Votre Azure Directory (tenant) ID"
          />
          <Field
            label="Client ID (Application ID)"
            placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            value={config.client_id}
            onChange={v => setField('client_id', v)}
            hint="L'ID de votre App Registration"
          />
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">Client Secret</label>
            <div className="relative">
              <input
                type={showSecret ? 'text' : 'password'}
                value={config.client_secret}
                onChange={e => setField('client_secret', e.target.value)}
                placeholder="Votre secret client Azure"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowSecret(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                {showSecret ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
            <p className="text-[10px] text-gray-400">Jamais affiché en clair après la première sauvegarde</p>
          </div>
          {/* Sélecteur de backend de stockage */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-700">Backend de stockage</label>
            <div className="flex gap-3">
              {([
                { value: 'onedrive',   label: 'OneDrive',   desc: 'Compte personnel ou professionnel' },
                { value: 'sharepoint', label: 'SharePoint', desc: 'Licence Microsoft 365 Business/Enterprise' },
              ] as const).map(opt => (
                <label key={opt.value} className={`flex-1 flex items-start gap-2.5 p-3 border rounded-lg cursor-pointer transition ${config.storage_backend === opt.value ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
                  <input type="radio" name="storage_backend" value={opt.value}
                    checked={config.storage_backend === opt.value}
                    onChange={() => setField('storage_backend', opt.value)}
                    className="mt-0.5 text-blue-600" />
                  <div>
                    <p className="text-xs font-semibold text-gray-800">{opt.label}</p>
                    <p className="text-[10px] text-gray-400 mt-0.5">{opt.desc}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Champ conditionnel selon le backend */}
          {config.storage_backend === 'sharepoint' ? (
            <Field
              label="SharePoint Site ID"
              placeholder="votre-entreprise.sharepoint.com,xxxxxxxx-...,xxxxxxxx-..."
              value={config.sharepoint_site_id}
              onChange={v => setField('sharepoint_site_id', v)}
              hint="Récupéré via : GET https://graph.microsoft.com/v1.0/sites/{hostname}:/sites/{siteName}"
            />
          ) : (
            <Field
              label="Email du compte OneDrive"
              placeholder="vous@outlook.com"
              value={config.onedrive_user}
              onChange={v => setField('onedrive_user', v)}
              hint="Email Microsoft du compte dont le OneDrive sera utilisé pour le stockage"
            />
          )}
        </div>

        {/* Bouton test */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleTest}
            disabled={testing || !config.tenant_id || !config.client_id || !config.client_secret ||
              (config.storage_backend === 'onedrive' ? !config.onedrive_user : !config.sharepoint_site_id)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
            Tester la connexion
          </button>

          {testMsg && (
            <div className={`flex items-center gap-1.5 text-xs font-medium ${testMsg.ok ? 'text-green-700' : 'text-red-600'}`}>
              {testMsg.ok
                ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                : <XCircle className="w-4 h-4 shrink-0" />}
              {testMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* Options */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">Options</h2>

        <div className="space-y-3">
          <ToggleOption
            label="Créer un dossier SharePoint à la création d'un projet"
            description="Génère automatiquement Popsjet/Projets/{code}/ avec sous-dossiers Documents, Tâches, Formulaires."
            checked={options.auto_create_folder}
            onChange={v => setOption('auto_create_folder', v)}
          />
          <ToggleOption
            label="Inviter automatiquement les membres du projet"
            description="Quand un membre est ajouté au projet, il reçoit une invitation Microsoft sur le dossier."
            checked={options.auto_invite_members}
            onChange={v => setOption('auto_invite_members', v)}
          />
          <ToggleOption
            label="Créer un sous-dossier par tâche assignée"
            description="Quand une tâche est assignée, crée Tâches/{id}/ et invite l'assigné."
            checked={options.create_task_subfolder}
            onChange={v => setOption('create_task_subfolder', v)}
          />
          <ToggleOption
            label="Générer des liens de partage sur les documents"
            description="Chaque fichier uploadé génère un lien affichable sur Popsjet."
            checked={options.generate_sharing_links}
            onChange={v => setOption('generate_sharing_links', v)}
          />

          {/* Type de lien */}
          {options.generate_sharing_links && (
            <div className="ml-7 space-y-1">
              <label className="text-xs font-medium text-gray-700">Type de lien par défaut</label>
              <div className="flex gap-3">
                {(['view', 'edit'] as const).map(type => (
                  <label key={type} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="link_type"
                      value={type}
                      checked={options.link_type === type}
                      onChange={() => setOption('link_type', type)}
                      className="text-blue-600"
                    />
                    <span className="text-xs text-gray-700">
                      {type === 'view' ? '👁 Lecture seule' : '✏️ Collaboration (édition)'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Guide Azure */}
      <div className="bg-blue-50 rounded-xl border border-blue-100 p-5">
        <h3 className="text-xs font-semibold text-blue-800 mb-2">Comment obtenir ces identifiants ?</h3>
        <ol className="text-xs text-blue-700 space-y-1 list-decimal list-inside">
          <li>Ouvrez <strong>portal.azure.com</strong> → Azure Active Directory → Inscriptions d'applications</li>
          <li>Cliquez <strong>"Nouvelle inscription"</strong> → donnez un nom (ex: "Popsjet Integration")</li>
          <li>Copiez le <strong>Tenant ID</strong> et le <strong>Client ID</strong> depuis la vue d'ensemble</li>
          <li>Allez dans <strong>Certificats et secrets</strong> → Nouveau secret → copiez la valeur</li>
          <li>Dans <strong>API autorisées</strong>, ajoutez : <code>Sites.ReadWrite.All</code> et <code>Files.ReadWrite.All</code> (permissions d'application) → accorder le consentement admin</li>
          <li>Pour le <strong>Site ID SharePoint</strong> : appelez <code>GET https://graph.microsoft.com/v1.0/sites/&#123;votre-domaine&#125;.sharepoint.com:/sites/&#123;nom-du-site&#125;</code></li>
        </ol>
      </div>

      {/* Bouton sauvegarder */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer
        </button>

        {saveMsg && (
          <div className={`flex items-center gap-1.5 text-xs font-medium ${saveMsg.ok ? 'text-green-700' : 'text-red-600'}`}>
            {saveMsg.ok
              ? <CheckCircle2 className="w-4 h-4 shrink-0" />
              : <XCircle className="w-4 h-4 shrink-0" />}
            {saveMsg.text}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Composants UI locaux ─────────────────────────────────────────────────────

function Field({
  label, placeholder, value, onChange, hint,
}: {
  label: string
  placeholder: string
  value: string
  onChange: (v: string) => void
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <label className="block text-xs font-medium text-gray-700">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono placeholder:font-sans placeholder:text-gray-300"
      />
      {hint && <p className="text-[10px] text-gray-400">{hint}</p>}
    </div>
  )
}

function ToggleOption({
  label, description, checked, onChange,
}: {
  label:       string
  description: string
  checked:     boolean
  onChange:    (v: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5 shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={e => onChange(e.target.checked)}
          className="sr-only"
        />
        <div
          className={`w-9 h-5 rounded-full transition-colors ${checked ? 'bg-blue-600' : 'bg-gray-200'}`}
          onClick={() => onChange(!checked)}
        >
          <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-0'}`} />
        </div>
      </div>
      <div>
        <p className="text-sm text-gray-700 group-hover:text-gray-900 transition">{label}</p>
        <p className="text-xs text-gray-400 mt-0.5">{description}</p>
      </div>
    </label>
  )
}

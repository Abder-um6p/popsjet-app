'use client'

import { useState } from 'react'
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Save, Power, FlaskConical, Info, AlertTriangle } from 'lucide-react'

interface Props {
  initialData: {
    enabled:   boolean
    config:    { service_account_email: string; service_account_private_key: string; drive_folder_id: string }
    options:   { auto_create_folder: boolean; auto_share_members: boolean; create_task_subfolder: boolean; generate_sharing_links: boolean; share_role: 'reader' | 'commenter' | 'writer' }
    tested_at: string | null
  }
}

export default function GoogleConfigForm({ initialData }: Props) {
  const [enabled,     setEnabled]     = useState(initialData.enabled)
  const [config,      setConfig]      = useState(initialData.config)
  const [options,     setOptions]     = useState(initialData.options)
  const [showKey,      setShowKey]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [testing,      setTesting]      = useState(false)
  const [saveMsg,      setSaveMsg]      = useState<{ ok: boolean; text: string } | null>(null)
  const [testMsg,      setTestMsg]      = useState<{ ok: boolean; text: string } | null>(null)
  const [showConfirm,  setShowConfirm]  = useState(false)

  async function handleSave() {
    setSaving(true); setSaveMsg(null)
    try {
      const res = await fetch('/api/admin/integrations/google', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled, config, options }),
      })
      const data = await res.json()
      setSaveMsg(res.ok ? { ok: true, text: 'Configuration enregistrée.' } : { ok: false, text: data.error ?? 'Erreur.' })
    } catch { setSaveMsg({ ok: false, text: 'Erreur réseau.' }) }
    finally { setSaving(false) }
  }

  async function handleTest() {
    setTesting(true); setTestMsg(null)
    try {
      const res = await fetch('/api/admin/integrations/google/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      const data = await res.json()
      setTestMsg({ ok: data.ok, text: data.message })
    } catch { setTestMsg({ ok: false, text: 'Erreur réseau.' }) }
    finally { setTesting(false) }
  }

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
                <h3 className="text-sm font-bold text-gray-900">Désactiver Google Workspace ?</h3>
                <p className="text-sm text-gray-500 mt-1">En désactivant ce plugin, les conséquences suivantes s'appliqueront :</p>
              </div>
            </div>
            <ul className="space-y-2 mb-5 ml-2">
              {[
                'Les nouveaux projets ne créeront plus de dossier Google Drive',
                'Les liens Drive existants seront toujours accessibles mais ne seront plus mis à jour',
                'Les partages de fichiers avec les membres seront interrompus',
                'Les fichiers déjà uploadés sur Drive restent intacts',
              ].map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                  <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />{item}
                </li>
              ))}
            </ul>
            <div className="flex gap-3 justify-end">
              <button onClick={() => setShowConfirm(false)} className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition">Annuler</button>
              <button onClick={() => { setEnabled(false); setShowConfirm(false) }} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition">Désactiver quand même</button>
            </div>
          </div>
        </div>
      )}

      {/* Statut */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-gray-800">Statut du plugin</p>
          <p className="text-xs text-gray-400 mt-0.5">{enabled ? 'Actif — dossiers Drive créés automatiquement.' : 'Désactivé — aucune action sur Google Drive.'}</p>
        </div>
        <button onClick={() => enabled ? setShowConfirm(true) : setEnabled(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${enabled ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100' : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'}`}>
          <Power className="w-4 h-4" />{enabled ? 'Désactiver' : 'Activer'}
        </button>
      </div>

      {/* Credentials */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-sm font-semibold text-gray-800">Service Account Google</h2>
          <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline flex items-center gap-0.5">
            <Info className="w-3 h-3" /> Console Google Cloud
          </a>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">Email du Service Account</label>
          <input type="email" value={config.service_account_email} onChange={e => setConfig(p => ({ ...p, service_account_email: e.target.value }))}
            placeholder="popsjet@mon-projet.iam.gserviceaccount.com"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono placeholder:font-sans placeholder:text-gray-300" />
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">Clé privée (JSON ou PEM)</label>
          <div className="relative">
            <textarea
              rows={showKey ? 5 : 2}
              value={config.service_account_private_key}
              onChange={e => setConfig(p => ({ ...p, service_account_private_key: e.target.value }))}
              placeholder="-----BEGIN PRIVATE KEY-----\n..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono placeholder:font-sans placeholder:text-gray-300 pr-10 resize-none"
            />
            <button type="button" onClick={() => setShowKey(v => !v)} className="absolute right-3 top-3 text-gray-400 hover:text-gray-600">
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-gray-400">Collez la valeur du champ <code>private_key</code> du JSON téléchargé depuis Google Cloud Console</p>
        </div>

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">ID du dossier Drive racine</label>
          <input type="text" value={config.drive_folder_id} onChange={e => setConfig(p => ({ ...p, drive_folder_id: e.target.value }))}
            placeholder="1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono placeholder:font-sans placeholder:text-gray-300" />
          <p className="text-[10px] text-gray-400">L'ID se trouve dans l'URL du dossier Drive partagé avec le service account</p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleTest} disabled={testing || !config.service_account_email || !config.service_account_private_key}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
            Tester la connexion
          </button>
          {testMsg && (
            <div className={`flex items-center gap-1.5 text-xs font-medium ${testMsg.ok ? 'text-green-700' : 'text-red-600'}`}>
              {testMsg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
              {testMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* Options */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">Options</h2>
        <div className="space-y-3">
          {[
            { key: 'auto_create_folder',    label: 'Créer un dossier Drive à la création d\'un projet', desc: 'Génère Projets/{code}/ avec sous-dossiers Documents, Tâches, Formulaires.' },
            { key: 'auto_share_members',    label: 'Partager automatiquement avec les membres du projet', desc: 'Chaque membre reçoit une invitation Google Drive.' },
            { key: 'create_task_subfolder', label: 'Créer un sous-dossier par tâche assignée', desc: 'Crée Tâches/{id}/ et partage avec l\'assigné.' },
            { key: 'generate_sharing_links',label: 'Générer des liens de partage sur les documents', desc: 'Lien webViewLink affiché sur Popsjet.' },
          ].map(({ key, label, desc }) => (
            <label key={key} className="flex items-start gap-3 cursor-pointer group">
              <div className="relative mt-0.5 shrink-0">
                <div className={`w-9 h-5 rounded-full transition-colors ${(options as any)[key] ? 'bg-blue-600' : 'bg-gray-200'}`}
                  onClick={() => setOptions(p => ({ ...p, [key]: !(p as any)[key] }))}>
                  <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${(options as any)[key] ? 'translate-x-4' : 'translate-x-0'}`} />
                </div>
              </div>
              <div>
                <p className="text-sm text-gray-700">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
              </div>
            </label>
          ))}

          {options.auto_share_members && (
            <div className="ml-7 space-y-1">
              <label className="text-xs font-medium text-gray-700">Rôle Drive par défaut</label>
              <div className="flex gap-3">
                {(['reader', 'commenter', 'writer'] as const).map(r => (
                  <label key={r} className="flex items-center gap-2 cursor-pointer">
                    <input type="radio" name="share_role" value={r} checked={options.share_role === r} onChange={() => setOptions(p => ({ ...p, share_role: r }))} className="text-blue-600" />
                    <span className="text-xs text-gray-700">
                      {r === 'reader' ? '👁 Lecteur' : r === 'commenter' ? '💬 Commentateur' : '✏️ Éditeur'}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Guide */}
      <div className="bg-green-50 rounded-xl border border-green-100 p-5">
        <h3 className="text-xs font-semibold text-green-800 mb-2">Comment configurer le Service Account ?</h3>
        <ol className="text-xs text-green-700 space-y-1 list-decimal list-inside">
          <li>Ouvrez <strong>console.cloud.google.com</strong> → IAM et administration → Comptes de service</li>
          <li>Créez un compte de service → copiez l'<strong>email</strong></li>
          <li>Dans les clés → <strong>Ajouter une clé JSON</strong> → téléchargez le fichier</li>
          <li>Dans le fichier JSON, copiez la valeur de <code>private_key</code></li>
          <li>Activez l'<strong>API Google Drive</strong> dans APIs & Services → Bibliothèque</li>
          <li>Créez un dossier Drive, partagez-le avec l'email du service account (éditeur)</li>
          <li>Copiez l'<strong>ID du dossier</strong> depuis son URL Drive</li>
        </ol>
      </div>

      <div className="flex items-center gap-3">
        <button onClick={handleSave} disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Enregistrer
        </button>
        {saveMsg && (
          <div className={`flex items-center gap-1.5 text-xs font-medium ${saveMsg.ok ? 'text-green-700' : 'text-red-600'}`}>
            {saveMsg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
            {saveMsg.text}
          </div>
        )}
      </div>
    </div>
  )
}

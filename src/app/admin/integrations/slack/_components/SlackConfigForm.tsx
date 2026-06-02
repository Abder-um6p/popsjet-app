'use client'

import { useState } from 'react'
import { Eye, EyeOff, CheckCircle2, XCircle, Loader2, Save, Power, FlaskConical, AlertTriangle } from 'lucide-react'

interface Props {
  initialData: {
    enabled:   boolean
    config:    { mode: 'webhook' | 'bot_token'; webhook_url: string; bot_token: string; default_channel: string }
    options:   { notify_project_created: boolean; notify_task_assigned: boolean; notify_member_added: boolean; notify_task_status: boolean; notify_document_upload: boolean; channel_projects: string; channel_tasks: string }
    tested_at: string | null
  }
}

export default function SlackConfigForm({ initialData }: Props) {
  const [enabled,   setEnabled]   = useState(initialData.enabled)
  const [config,    setConfig]    = useState(initialData.config)
  const [options,   setOptions]   = useState(initialData.options)
  const [showToken,    setShowToken]    = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [testing,      setTesting]      = useState(false)
  const [saveMsg,      setSaveMsg]      = useState<{ ok: boolean; text: string } | null>(null)
  const [testMsg,      setTestMsg]      = useState<{ ok: boolean; text: string } | null>(null)
  const [showConfirm,  setShowConfirm]  = useState(false)

  async function handleSave() {
    setSaving(true); setSaveMsg(null)
    try {
      const res = await fetch('/api/admin/integrations/slack', {
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
      const res = await fetch('/api/admin/integrations/slack/test', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      const data = await res.json()
      setTestMsg({ ok: data.ok, text: data.message })
    } catch { setTestMsg({ ok: false, text: 'Erreur réseau.' }) }
    finally { setTesting(false) }
  }

  const canTest = config.mode === 'webhook' ? !!config.webhook_url : !!config.bot_token

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
                <h3 className="text-sm font-bold text-gray-900">Désactiver Slack ?</h3>
                <p className="text-sm text-gray-500 mt-1">En désactivant ce plugin, les conséquences suivantes s'appliqueront :</p>
              </div>
            </div>
            <ul className="space-y-2 mb-5 ml-2">
              {[
                'Plus aucune notification ne sera envoyée dans vos canaux Slack',
                'Les événements (projets, tâches, membres) ne seront plus remontés',
                'La configuration et le webhook seront conservés pour une réactivation',
                'Les messages déjà envoyés restent visibles dans Slack',
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
          <p className="text-xs text-gray-400 mt-0.5">{enabled ? 'Actif — notifications envoyées automatiquement.' : 'Désactivé — aucune notification Slack.'}</p>
        </div>
        <button onClick={() => enabled ? setShowConfirm(true) : setEnabled(true)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${enabled ? 'bg-red-50 text-red-700 border border-red-200 hover:bg-red-100' : 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'}`}>
          <Power className="w-4 h-4" />{enabled ? 'Désactiver' : 'Activer'}
        </button>
      </div>

      {/* Credentials */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">Connexion Slack</h2>

        {/* Mode */}
        <div className="flex gap-3">
          {(['webhook', 'bot_token'] as const).map(m => (
            <label key={m} className={`flex-1 flex items-start gap-2.5 p-3 border rounded-lg cursor-pointer transition ${config.mode === m ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'}`}>
              <input type="radio" name="mode" value={m} checked={config.mode === m} onChange={() => setConfig(p => ({ ...p, mode: m }))} className="mt-0.5 text-blue-600" />
              <div>
                <p className="text-xs font-semibold text-gray-800">{m === 'webhook' ? 'Incoming Webhook' : 'Bot Token'}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{m === 'webhook' ? 'Simple, un canal fixe' : 'Plus flexible, plusieurs canaux'}</p>
              </div>
            </label>
          ))}
        </div>

        {config.mode === 'webhook' && (
          <div className="space-y-1">
            <label className="block text-xs font-medium text-gray-700">Webhook URL</label>
            <input type="url" value={config.webhook_url} onChange={e => setConfig(p => ({ ...p, webhook_url: e.target.value }))}
              placeholder="https://hooks.slack.com/services/T.../B.../..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono placeholder:font-sans placeholder:text-gray-300" />
            <p className="text-[10px] text-gray-400">Créez un webhook dans votre workspace Slack → Apps → Incoming Webhooks</p>
          </div>
        )}

        {config.mode === 'bot_token' && (
          <>
            <div className="space-y-1">
              <label className="block text-xs font-medium text-gray-700">Bot Token</label>
              <div className="relative">
                <input type={showToken ? 'text' : 'password'} value={config.bot_token} onChange={e => setConfig(p => ({ ...p, bot_token: e.target.value }))}
                  placeholder="xoxb-..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10 font-mono placeholder:font-sans placeholder:text-gray-300" />
                <button type="button" onClick={() => setShowToken(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showToken ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </>
        )}

        <div className="space-y-1">
          <label className="block text-xs font-medium text-gray-700">Canal par défaut</label>
          <input type="text" value={config.default_channel} onChange={e => setConfig(p => ({ ...p, default_channel: e.target.value }))}
            placeholder="#popsjet-notifications"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button onClick={handleTest} disabled={testing || !canTest}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed transition">
            {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
            Envoyer un message de test
          </button>
          {testMsg && (
            <div className={`flex items-center gap-1.5 text-xs font-medium ${testMsg.ok ? 'text-green-700' : 'text-red-600'}`}>
              {testMsg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <XCircle className="w-4 h-4 shrink-0" />}
              {testMsg.text}
            </div>
          )}
        </div>
      </div>

      {/* Options notifications */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-800">Événements à notifier</h2>
        <div className="space-y-3">
          {[
            { key: 'notify_project_created',  label: '🚀 Projet créé',          desc: 'Notifie quand un nouveau projet est créé sur Popsjet.' },
            { key: 'notify_task_assigned',    label: '📋 Tâche assignée',        desc: 'Notifie quand une tâche est assignée à un membre.' },
            { key: 'notify_member_added',     label: '👤 Membre ajouté',         desc: 'Notifie quand un membre rejoint un projet.' },
            { key: 'notify_task_status',      label: '🔄 Changement de statut',  desc: 'Notifie à chaque mise à jour de statut d\'une tâche.' },
            { key: 'notify_document_upload',  label: '📄 Document uploadé',      desc: 'Notifie quand un document est ajouté à un projet.' },
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
        </div>

        {/* Canaux optionnels (mode bot_token) */}
        {config.mode === 'bot_token' && (
          <div className="pt-2 space-y-3 border-t border-gray-100">
            <p className="text-xs font-medium text-gray-600">Canaux spécifiques (optionnel)</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block text-xs text-gray-500">Canal Projets</label>
                <input type="text" value={options.channel_projects} onChange={e => setOptions(p => ({ ...p, channel_projects: e.target.value }))}
                  placeholder="#projets" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-1">
                <label className="block text-xs text-gray-500">Canal Tâches</label>
                <input type="text" value={options.channel_tasks} onChange={e => setOptions(p => ({ ...p, channel_tasks: e.target.value }))}
                  placeholder="#taches" className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Guide */}
      <div className="bg-yellow-50 rounded-xl border border-yellow-100 p-5">
        <h3 className="text-xs font-semibold text-yellow-800 mb-2">Comment configurer Slack ?</h3>
        <div className="space-y-2 text-xs text-yellow-700">
          <div>
            <p className="font-semibold">Mode Webhook (recommandé pour débuter) :</p>
            <ol className="list-decimal list-inside space-y-0.5 mt-1">
              <li>Allez sur <strong>api.slack.com/apps</strong> → Créer une app</li>
              <li>Activez <strong>Incoming Webhooks</strong> → Add New Webhook to Workspace</li>
              <li>Choisissez le canal → copiez le Webhook URL</li>
            </ol>
          </div>
          <div>
            <p className="font-semibold">Mode Bot Token (plusieurs canaux) :</p>
            <ol className="list-decimal list-inside space-y-0.5 mt-1">
              <li>Créez une app → OAuth & Permissions → Scopes → <code>chat:write</code></li>
              <li>Installez l'app dans votre workspace</li>
              <li>Copiez le <strong>Bot User OAuth Token</strong> (xoxb-...)</li>
              <li>Invitez le bot dans chaque canal : <code>/invite @votre-bot</code></li>
            </ol>
          </div>
        </div>
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

'use client'

import { useState } from 'react'
import {
  Sparkles, Copy, CheckCheck, ChevronRight, ChevronLeft,
  Trash2, Check, X, RefreshCw, ListChecks, AlertTriangle,
} from 'lucide-react'
import { toast } from 'sonner'

interface ParsedLine {
  _id:         string
  code:        string
  designation: string
  notes:       string
  validated:   boolean
}

function makeId() { return Math.random().toString(36).slice(2) }

function buildPrompt(programName: string): string {
  return `Tu es un assistant de gestion budgétaire pour l'I&E Lab de l'UM6P.

Contexte du programme :
- Nom : ${programName}

---

Je vais te donner une description de lignes budgétaires (en langage naturel, liste, tableau, email, etc.).
Tu dois les extraire et renvoyer un tableau JSON STRICT, sans markdown, sans commentaires.

Format attendu :
[
  {
    "code": "string (ex: BUD-001, max 20 car.)",
    "designation": "string (libellé de la ligne budgétaire)",
    "notes": "string (remarques ou description complémentaire, peut être vide)"
  }
]

Règles :
- code : toujours en majuscules, format BUD-XXX ou similaire, unique
- designation : obligatoire, décrit la nature de la dépense
- notes : facultatif, string vide si rien à préciser
- Renvoie UNIQUEMENT le tableau JSON, rien d'autre`
}

function parseLines(raw: string): ParsedLine[] {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const arr = JSON.parse(cleaned)
  if (!Array.isArray(arr)) throw new Error('Pas un tableau')
  return arr.map((l: Record<string, string>) => ({
    _id:         makeId(),
    code:        (l.code ?? '').toUpperCase().slice(0, 20),
    designation: l.designation ?? '',
    notes:       l.notes ?? '',
    validated:   false,
  })).filter(l => l.designation)
}

interface Props {
  programName: string
  onImport: (lines: Array<{ code: string; designation: string; notes: string }>) => void
}

export default function BulkBudgetImport({ programName, onImport }: Props) {
  const [open,       setOpen]       = useState(false)
  const [step,       setStep]       = useState<1 | 2>(1)
  const [copied,     setCopied]     = useState(false)
  const [raw,        setRaw]        = useState('')
  const [parseErr,   setParseErr]   = useState('')
  const [lines,      setLines]      = useState<ParsedLine[]>([])
  const [submitting, setSubmitting] = useState(false)

  const prompt = buildPrompt(programName || 'Programme')

  function handleCopy() {
    navigator.clipboard.writeText(prompt)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function handleParse() {
    setParseErr('')
    try {
      const parsed = parseLines(raw)
      if (parsed.length === 0) { setParseErr('Aucune ligne détectée.'); return }
      setLines(parsed)
      setStep(2)
    } catch {
      setParseErr('Format non reconnu. Collez la réponse JSON de l\'IA.')
    }
  }

  function update(id: string, field: keyof ParsedLine, value: string | boolean) {
    setLines(prev => prev.map(l => l._id === id ? { ...l, [field]: value } : l))
  }

  function remove(id: string) {
    setLines(prev => prev.filter(l => l._id !== id))
  }

  function toggle(id: string) {
    setLines(prev => prev.map(l => l._id === id ? { ...l, validated: !l.validated } : l))
  }

  function toggleAll() {
    const allValidated = lines.every(l => l.validated)
    setLines(prev => prev.map(l => ({ ...l, validated: !allValidated })))
  }

  const validated = lines.filter(l => l.validated)

  function handleImport() {
    if (validated.length === 0) { toast.error('Validez au moins une ligne'); return }
    setSubmitting(true)
    onImport(validated.map(l => ({ code: l.code, designation: l.designation, notes: l.notes })))
    toast.success(`${validated.length} ligne${validated.length > 1 ? 's' : ''} prête${validated.length > 1 ? 's' : ''} à l'import`)
    setOpen(false)
    setStep(1)
    setRaw('')
    setLines([])
    setSubmitting(false)
  }

  function handleClose() {
    setOpen(false)
    setStep(1)
    setRaw('')
    setLines([])
    setParseErr('')
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!programName.trim()}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition disabled:opacity-40 disabled:cursor-not-allowed"
        title={!programName.trim() ? 'Renseignez d\'abord le nom du programme' : undefined}
      >
        <Sparkles className="w-3.5 h-3.5" /> Import IA
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 bg-gradient-to-r from-indigo-50 to-blue-50 shrink-0">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div className="flex-1">
            <h2 className="text-base font-semibold text-gray-900">Import IA — Lignes budgétaires</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {step === 1 ? 'Étape 1 — Copier le prompt et générer vos lignes' : `Étape 2 — Valider les lignes (${validated.length}/${lines.length} sélectionnée${validated.length > 1 ? 's' : ''})`}
            </p>
          </div>
          {/* Step indicators */}
          <div className="flex items-center gap-1.5">
            {[1, 2].map(s => (
              <div key={s} className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition
                ${step === s ? 'bg-indigo-600 text-white' : step > s ? 'bg-green-500 text-white' : 'bg-gray-200 text-gray-500'}`}>
                {step > s ? <Check className="w-3 h-3" /> : s}
              </div>
            ))}
          </div>
          <button onClick={handleClose} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* ── Étape 1 : prompt + coller ── */}
          {step === 1 && (
            <div className="p-6 space-y-4">
              <div className="p-4 bg-blue-50 border border-blue-100 rounded-xl text-sm text-blue-700 leading-relaxed">
                <p className="font-semibold mb-1">Comment ça marche ?</p>
                <ol className="list-decimal list-inside space-y-1 text-xs">
                  <li>Copiez le prompt ci-dessous</li>
                  <li>Collez-le dans <strong>ChatGPT</strong> ou <strong>Claude</strong> avec votre liste de lignes budgétaires</li>
                  <li>Copiez la réponse JSON générée par l'IA</li>
                  <li>Collez-la dans le champ ci-dessous</li>
                </ol>
              </div>

              {/* Prompt box */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">Prompt à copier</label>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition ${
                      copied ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200 border border-gray-200'
                    }`}
                  >
                    {copied ? <CheckCheck className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copié !' : 'Copier'}
                  </button>
                </div>
                <pre className="text-[11px] text-gray-600 bg-gray-50 border border-gray-200 rounded-xl p-4 overflow-auto max-h-52 whitespace-pre-wrap leading-relaxed font-mono">
                  {prompt}
                </pre>
              </div>

              {/* Zone de collage */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Coller la réponse de l'IA (JSON)</label>
                <textarea
                  value={raw}
                  onChange={e => { setRaw(e.target.value); setParseErr('') }}
                  rows={6}
                  placeholder={'[\n  {\n    "code": "BUD-001",\n    "designation": "Frais de communication",\n    "notes": "Impression, affichage"\n  }\n]'}
                  className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-xs font-mono text-gray-800 placeholder-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-gray-50"
                />
                {parseErr && (
                  <div className="flex items-start gap-2 mt-2 text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    {parseErr}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Étape 2 : révision ── */}
          {step === 2 && (
            <div className="p-6 space-y-3">
              <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-100 rounded-xl text-xs text-amber-700">
                <ListChecks className="w-4 h-4 shrink-0" />
                <span>Cochez les lignes à importer. Vous pouvez modifier le code et la désignation avant d'importer.</span>
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-600">{lines.length} ligne{lines.length > 1 ? 's' : ''} détectée{lines.length > 1 ? 's' : ''}</p>
                <button type="button" onClick={toggleAll} className="flex items-center gap-1 text-xs text-indigo-600 hover:underline">
                  <ListChecks className="w-3.5 h-3.5" />
                  {lines.every(l => l.validated) ? 'Tout décocher' : 'Tout cocher'}
                </button>
              </div>

              <div className="space-y-2">
                {lines.map(l => (
                  <div key={l._id} className={`border rounded-xl p-3 transition ${l.validated ? 'border-indigo-200 bg-indigo-50/40' : 'border-gray-100 bg-white'}`}>
                    <div className="flex items-start gap-2">
                      <button
                        type="button"
                        onClick={() => toggle(l._id)}
                        className={`mt-0.5 w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition ${l.validated ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 hover:border-indigo-400'}`}
                      >
                        {l.validated && <Check className="w-3 h-3 text-white" />}
                      </button>

                      <div className="flex-1 min-w-0 space-y-1.5">
                        <div className="flex gap-2">
                          <input
                            value={l.code}
                            onChange={e => update(l._id, 'code', e.target.value.toUpperCase())}
                            placeholder="Code"
                            maxLength={20}
                            className="w-28 border border-gray-200 rounded-lg px-2 py-1 text-xs font-mono font-semibold text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                          />
                          <input
                            value={l.designation}
                            onChange={e => update(l._id, 'designation', e.target.value)}
                            placeholder="Désignation"
                            className="flex-1 border border-gray-200 rounded-lg px-2 py-1 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-indigo-300"
                          />
                        </div>
                        {l.notes && (
                          <input
                            value={l.notes}
                            onChange={e => update(l._id, 'notes', e.target.value)}
                            placeholder="Notes"
                            className="w-full border border-gray-100 rounded-lg px-2 py-1 text-xs text-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-200 bg-white/50"
                          />
                        )}
                      </div>

                      <button type="button" onClick={() => remove(l._id)} className="p-1 text-gray-300 hover:text-red-400 transition flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          {step === 2 ? (
            <>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition"
              >
                <ChevronLeft className="w-4 h-4" /> Retour
              </button>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400">{validated.length} / {lines.length} sélectionnée{validated.length > 1 ? 's' : ''}</span>
                <button
                  type="button"
                  onClick={handleImport}
                  disabled={validated.length === 0 || submitting}
                  className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition disabled:opacity-40"
                >
                  {submitting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  Ajouter {validated.length > 0 ? validated.length : ''} ligne{validated.length > 1 ? 's' : ''}
                </button>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between w-full">
              <button type="button" onClick={handleClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition">
                Annuler
              </button>
              <button
                type="button"
                onClick={handleParse}
                disabled={!raw.trim()}
                className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition disabled:opacity-40"
              >
                Analyser <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

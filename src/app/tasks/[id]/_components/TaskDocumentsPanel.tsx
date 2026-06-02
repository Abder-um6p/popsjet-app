'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Paperclip, Upload, X, Download, Eye, Trash2, FileText,
  File as FileIcon, Image as ImageIcon, Archive, Loader2,
  AlertCircle,
} from 'lucide-react'
import { toast } from 'sonner'
import { cn, formatFileSize, formatDate } from '@/lib/utils'

// ─── Types ────────────────────────────────────────────────────────────────────

type Profile = { id: string; full_name: string; email: string; avatar_url: string | null }

type Doc = {
  id: string
  task_id: string
  project_id: string
  uploaded_by: string | null
  file_name: string
  file_url: string
  file_path: string
  file_size: number
  mime_type: string
  document_tag: string
  uploaded_at: string
  uploader?: Profile | null
}

type PendingFile = {
  id: string
  file: File
  tag: string
}

type Props = {
  taskId: string
  projectId: string
  userId: string
  role: string
  taskStatus: string
  assignedTo?: string | null
  createdBy: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_SIZE = 20 * 1024 * 1024 // 20 Mo
const ALLOWED_EXT = /\.(pdf|docx?|xlsx?|png|jpe?g|gif|webp|zip|txt)$/i

const TAG_OPTIONS: { value: string; label: string }[] = [
  { value: 'proof',       label: 'Preuve' },
  { value: 'invoice',     label: 'Facture' },
  { value: 'deliverable', label: 'Livrable' },
  { value: 'report',      label: 'Rapport' },
  { value: 'screenshot',  label: 'Capture' },
  { value: 'other',       label: 'Autre' },
]

const TAG_LABEL: Record<string, string> = Object.fromEntries(
  TAG_OPTIONS.map(t => [t.value, t.label])
)

const TAG_COLOR: Record<string, string> = {
  deliverable: 'bg-green-50 text-green-700 border border-green-100',
  invoice:     'bg-orange-50 text-orange-700 border border-orange-100',
  proof:       'bg-blue-50 text-blue-700 border border-blue-100',
  report:      'bg-indigo-50 text-indigo-700 border border-indigo-100',
  screenshot:  'bg-violet-50 text-violet-700 border border-violet-100',
  other:       'bg-gray-50 text-gray-700 border border-gray-100',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isImage(mime: string, name: string): boolean {
  return mime.startsWith('image/') || /\.(png|jpe?g|gif|webp)$/i.test(name)
}

function isPdf(mime: string, name: string): boolean {
  return mime === 'application/pdf' || /\.pdf$/i.test(name)
}

function fileIconFor(mime: string, name: string) {
  if (isImage(mime, name)) return <ImageIcon className="w-5 h-5 text-violet-500" />
  if (isPdf(mime, name))   return <FileText className="w-5 h-5 text-red-500" />
  if (mime.includes('word')      || /\.docx?$/i.test(name)) return <FileText className="w-5 h-5 text-blue-500" />
  if (mime.includes('sheet')     || mime.includes('excel') || /\.xlsx?$/i.test(name)) return <FileText className="w-5 h-5 text-green-600" />
  if (mime.includes('zip')       || /\.zip$/i.test(name)) return <Archive className="w-5 h-5 text-orange-500" />
  return <FileIcon className="w-5 h-5 text-gray-400" />
}

function validateFile(f: File): string | null {
  if (f.size === 0) return `${f.name} est vide`
  if (f.size > MAX_SIZE) return `${f.name} dépasse 20 Mo`
  if (!ALLOWED_EXT.test(f.name)) return `${f.name} : type non autorisé`
  return null
}

function makeId(): string {
  return Math.random().toString(36).slice(2)
}

// ─── DocumentCard ─────────────────────────────────────────────────────────────

function DocumentCard({
  doc,
  canDelete,
  onDelete,
}: {
  doc: Doc
  canDelete: boolean
  onDelete: (id: string) => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const preview = isImage(doc.mime_type, doc.file_name) || isPdf(doc.mime_type, doc.file_name)

  async function handleDownload() {
    setDownloading(true)
    try {
      const r = await fetch(doc.file_url)
      if (!r.ok) throw new Error('Téléchargement impossible')
      const blob = await r.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = doc.file_name
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur téléchargement')
    }
    setDownloading(false)
  }

  return (
    <div className="group flex items-center gap-3 p-3 rounded-xl border border-gray-100 hover:border-gray-200 hover:bg-gray-50/60 transition">
      <div className="w-10 h-10 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0">
        {fileIconFor(doc.mime_type, doc.file_name)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-gray-800 truncate">{doc.file_name}</p>
          <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0', TAG_COLOR[doc.document_tag] ?? TAG_COLOR.other)}>
            {TAG_LABEL[doc.document_tag] ?? 'Autre'}
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-gray-500 mt-0.5">
          <span>{formatFileSize(doc.file_size)}</span>
          <span>·</span>
          <span>{formatDate(doc.uploaded_at)}</span>
          {doc.uploader?.full_name && (
            <>
              <span>·</span>
              <span className="truncate">{doc.uploader.full_name}</span>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition shrink-0">
        {preview && (
          <a
            href={doc.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
            title="Aperçu"
          >
            <Eye className="w-4 h-4" />
          </a>
        )}
        <button
          type="button"
          onClick={handleDownload}
          disabled={downloading}
          className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition disabled:opacity-50"
          title="Télécharger"
        >
          {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        </button>
        {canDelete && (
          confirming ? (
            <div className="flex items-center gap-1 px-2 py-1 bg-red-50 rounded-lg">
              <span className="text-[11px] text-red-700 font-medium">Supprimer ?</span>
              <button
                type="button"
                onClick={() => { setConfirming(false); onDelete(doc.id) }}
                className="text-[11px] font-semibold text-red-700 hover:underline"
              >
                Oui
              </button>
              <button
                type="button"
                onClick={() => setConfirming(false)}
                className="text-[11px] text-gray-500 hover:underline"
              >
                Non
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirming(true)}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
              title="Supprimer"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )
        )}
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function TaskDocumentsPanel({
  taskId,
  userId,
  role,
  assignedTo,
  createdBy,
}: Props) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [dropZoneOpen, setDropZoneOpen] = useState(false)
  const [pending, setPending] = useState<PendingFile[]>([])
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const isPrivileged = ['admin', 'directeur', 'chef_projet'].includes(role)
  const canUpload = isPrivileged || assignedTo === userId || createdBy === userId

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const r = await fetch(`/api/tasks/${taskId}/documents`)
      const body = await r.json()
      if (!r.ok) {
        setError(body?.error ?? `HTTP ${r.status}`)
      } else {
        setDocs(Array.isArray(body) ? body : [])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur réseau')
    }
    setLoading(false)
  }, [taskId])

  useEffect(() => { load() }, [load])

  // ── File selection ──
  function handleFiles(files: FileList | File[]) {
    const arr = Array.from(files)
    const next: PendingFile[] = []
    for (const f of arr) {
      const err = validateFile(f)
      if (err) { toast.error(err); continue }
      next.push({ id: makeId(), file: f, tag: 'other' })
    }
    if (next.length > 0) {
      setPending(p => [...p, ...next])
      setDropZoneOpen(true)
    }
  }

  function removePending(id: string) {
    setPending(p => p.filter(x => x.id !== id))
  }

  function setPendingTag(id: string, tag: string) {
    setPending(p => p.map(x => x.id === id ? { ...x, tag } : x))
  }

  function cancelUpload() {
    if (uploading) return
    setPending([])
    setDropZoneOpen(false)
  }

  // ── Upload séquentiel ──
  async function handleUpload() {
    if (pending.length === 0 || uploading) return
    setUploading(true)
    setProgress(0)

    let fakeTimer: ReturnType<typeof setInterval> | null = null
    const startFake = () => {
      setProgress(0)
      fakeTimer = setInterval(() => {
        setProgress(p => Math.min(p + 7, 90))
      }, 180)
    }
    const stopFake = () => {
      if (fakeTimer) { clearInterval(fakeTimer); fakeTimer = null }
    }

    let success = 0
    let failed = 0
    const total = pending.length

    for (let i = 0; i < pending.length; i++) {
      const item = pending[i]
      startFake()
      try {
        const fd = new FormData()
        fd.append('file', item.file)
        fd.append('document_tag', item.tag)
        const r = await fetch(`/api/tasks/${taskId}/documents`, { method: 'POST', body: fd })
        const body = await r.json().catch(() => ({}))
        stopFake()
        if (!r.ok) {
          failed += 1
          toast.error(`${item.file.name} : ${body?.error ?? 'échec'}`)
        } else {
          success += 1
          setProgress(100)
        }
      } catch (e) {
        stopFake()
        failed += 1
        toast.error(`${item.file.name} : ${e instanceof Error ? e.message : 'erreur'}`)
      }
      if (i < pending.length - 1) {
        // petite pause visuelle entre les fichiers
        await new Promise(res => setTimeout(res, 120))
      }
    }

    stopFake()
    setProgress(0)
    setUploading(false)
    setPending([])
    setDropZoneOpen(false)
    if (success > 0) toast.success(success === total ? 'Documents joints' : `${success}/${total} document(s) joint(s)`)
    load()
  }

  // ── Delete ──
  async function handleDelete(docId: string) {
    try {
      const r = await fetch(`/api/tasks/${taskId}/documents/${docId}`, { method: 'DELETE' })
      const body = await r.json().catch(() => ({}))
      if (!r.ok) { toast.error(body?.error ?? 'Suppression impossible'); return }
      toast.success('Document supprimé')
      setDocs(d => d.filter(x => x.id !== docId))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur réseau')
    }
  }

  // ── Drag & drop ──
  function onDragOver(e: React.DragEvent) {
    if (!canUpload) return
    e.preventDefault()
    setDragOver(true)
  }
  function onDragLeave(e: React.DragEvent) {
    e.preventDefault()
    setDragOver(false)
  }
  function onDrop(e: React.DragEvent) {
    if (!canUpload) return
    e.preventDefault()
    setDragOver(false)
    const files = e.dataTransfer?.files
    if (files && files.length > 0) handleFiles(files)
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div
      className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b border-gray-50 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-gray-500" />
          <h2 className="text-sm font-semibold text-gray-700">Documents</h2>
          <span className="text-xs text-gray-400">({docs.length})</span>
        </div>
        {canUpload && !dropZoneOpen && (
          <button
            type="button"
            onClick={() => setDropZoneOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50 transition"
          >
            <Upload className="w-3.5 h-3.5" /> Joindre un fichier
          </button>
        )}
      </div>

      {/* Drop zone */}
      {canUpload && dropZoneOpen && (
        <div className="px-5 pt-4">
          <div
            onClick={() => !uploading && fileInputRef.current?.click()}
            className={cn(
              'cursor-pointer rounded-xl border-2 border-dashed p-6 text-center transition',
              dragOver
                ? 'border-blue-400 bg-gradient-to-br from-blue-50 to-violet-50'
                : 'border-gray-200 hover:border-blue-300 hover:bg-gradient-to-br hover:from-blue-50/40 hover:to-violet-50/40'
            )}
          >
            <Upload className="w-6 h-6 text-blue-500 mx-auto" />
            <p className="text-sm font-medium text-gray-700 mt-2">
              Glissez vos fichiers ici ou cliquez pour parcourir
            </p>
            <p className="text-xs text-gray-400 mt-1">
              PDF, DOCX, XLSX, images, ZIP · max 20 Mo par fichier
            </p>
            <input
              ref={fileInputRef}
              type="file"
              hidden
              multiple
              onChange={e => {
                if (e.target.files) handleFiles(e.target.files)
                e.target.value = ''
              }}
            />
          </div>

          {pending.length > 0 && (
            <div className="mt-4 space-y-2">
              {pending.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg">
                  <div className="w-8 h-8 rounded-md bg-white border border-gray-100 flex items-center justify-center shrink-0">
                    {fileIconFor(p.file.type, p.file.name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">{p.file.name}</p>
                    <p className="text-[11px] text-gray-500">{formatFileSize(p.file.size)}</p>
                  </div>
                  <select
                    value={p.tag}
                    onChange={e => setPendingTag(p.id, e.target.value)}
                    disabled={uploading}
                    className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
                  >
                    {TAG_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => removePending(p.id)}
                    disabled={uploading}
                    className="p-1 text-gray-400 hover:text-red-500 transition disabled:opacity-50"
                    title="Retirer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {uploading && (
            <div className="mt-3">
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-violet-500 transition-all duration-200"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-[11px] text-gray-500 mt-1">Envoi en cours…</p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 mt-3 pb-2">
            <button
              type="button"
              onClick={cancelUpload}
              disabled={uploading}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={pending.length === 0 || uploading}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {uploading
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Envoi…</>
                : <><Upload className="w-3.5 h-3.5" /> Envoyer {pending.length > 0 ? `(${pending.length})` : ''}</>
              }
            </button>
          </div>
        </div>
      )}

      {/* Documents list */}
      <div className="px-5 py-4 space-y-2">
        {loading ? (
          <div className="space-y-2">
            {[0, 1, 2].map(i => (
              <div key={i} className="h-14 bg-gray-50 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center justify-between gap-2 p-3 rounded-xl bg-red-50 border border-red-100">
            <div className="flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={load}
              className="text-xs text-red-700 font-medium hover:underline"
            >
              Réessayer
            </button>
          </div>
        ) : docs.length === 0 ? (
          <div className="py-8 text-center">
            <Paperclip className="w-8 h-8 text-gray-300 mx-auto" />
            <p className="text-sm text-gray-400 mt-2">Aucun document attaché</p>
            {canUpload && !dropZoneOpen && (
              <button
                type="button"
                onClick={() => setDropZoneOpen(true)}
                className="text-xs text-blue-600 hover:underline mt-1"
              >
                Joindre un fichier
              </button>
            )}
          </div>
        ) : (
          docs.map(d => (
            <DocumentCard
              key={d.id}
              doc={d}
              canDelete={d.uploaded_by === userId || isPrivileged}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>
    </div>
  )
}

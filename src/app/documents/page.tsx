import { createClient, createAdminClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { FileText, Download, File, FileImage, FileCode } from 'lucide-react'

function formatBytes(bytes: number) {
  if (bytes < 1024) return bytes + ' o'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' Ko'
  return (bytes / (1024 * 1024)).toFixed(1) + ' Mo'
}

function fileIcon(mime: string) {
  if (mime.startsWith('image/')) return <FileImage className="w-5 h-5 text-purple-500" />
  if (mime === 'application/pdf') return <File className="w-5 h-5 text-red-500" />
  if (mime.includes('word') || mime.includes('document')) return <FileText className="w-5 h-5 text-blue-500" />
  if (mime.includes('sheet') || mime.includes('excel')) return <FileText className="w-5 h-5 text-green-500" />
  if (mime.startsWith('text/')) return <FileCode className="w-5 h-5 text-gray-500" />
  return <File className="w-5 h-5 text-gray-400" />
}

export default async function DocumentsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const admin = createAdminClient()

  // P-06 — récupérer le rôle et les projets accessibles à cet utilisateur
  const { data: callerProfile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isPrivileged = ['admin', 'directeur'].includes((callerProfile as any)?.role ?? '')

  // Projets accessibles selon le rôle
  let accessibleProjectIds: string[] | null = null // null = tous (admin/directeur)
  if (!isPrivileged) {
    // Projets où l'utilisateur est membre OU créateur
    const [{ data: memberships }, { data: createdProjects }] = await Promise.all([
      admin.from('project_members').select('project_id').eq('profile_id', user.id),
      admin.from('projects').select('id').eq('created_by', user.id).is('deleted_at', null),
    ])
    accessibleProjectIds = [
      ...new Set([
        ...(memberships ?? []).map((m: any) => m.project_id),
        ...(createdProjects ?? []).map((p: any) => p.id),
      ])
    ]
  }

  const docsQuery = admin
    .from('documents')
    .select('*, uploader:profiles!documents_uploaded_by_fkey(full_name)')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })

  const [{ data: documents }, { data: projects }] = await Promise.all([
    accessibleProjectIds !== null
      ? docsQuery.in('project_id', accessibleProjectIds.length > 0 ? accessibleProjectIds : ['__none__'])
      : docsQuery,
    admin.from('projects').select('id, title, code').is('deleted_at', null).order('title'),
  ])

  const docs = documents ?? []
  const projectMap = Object.fromEntries((projects ?? []).map(p => [p.id, p]))

  const byProject: Record<string, typeof docs> = {}
  for (const doc of docs) {
    const key = doc.project_id ?? '__none__'
    if (!byProject[key]) byProject[key] = []
    byProject[key].push(doc)
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Documents</h1>
          <p className="text-sm text-gray-500 mt-0.5">{docs.length} document{docs.length !== 1 ? 's' : ''} au total</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total', value: docs.length },
          { label: 'Projets couverts', value: Object.keys(byProject).filter(k => k !== '__none__').length },
          { label: 'Taille totale', value: formatBytes(docs.reduce((s, d) => s + (d.file_size ?? 0), 0)) },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <div className="text-2xl font-bold text-gray-900">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>

      {docs.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm py-20 text-center">
          <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Aucun document</p>
          <p className="text-gray-400 text-xs mt-1">Les documents sont uploadés depuis la page d'un projet</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(byProject).map(([projectId, projectDocs]) => {
            const project = projectMap[projectId]
            return (
              <div key={projectId} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                <div className="px-5 py-3 border-b border-gray-100 bg-gray-50/50 flex items-center gap-2">
                  <span className="font-mono text-xs text-gray-400">{project?.code ?? '—'}</span>
                  <span className="text-sm font-semibold text-gray-800">{project?.title ?? 'Sans projet'}</span>
                  <span className="ml-auto text-xs text-gray-400">{projectDocs.length} fichier{projectDocs.length > 1 ? 's' : ''}</span>
                </div>
                <div className="divide-y divide-gray-50">
                  {projectDocs.map(doc => (
                    <div key={doc.id} className="flex items-center gap-3 px-5 py-3 hover:bg-gray-50/50 transition group">
                      <div className="shrink-0">{fileIcon(doc.mime_type ?? '')}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{doc.title || doc.file_name}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {formatBytes(doc.file_size ?? 0)} · v{doc.version ?? 1} · {(doc.uploader as any)?.full_name ?? '—'}
                        </p>
                      </div>
                      {doc.file_url && (
                        <a href={doc.file_url} target="_blank" rel="noopener noreferrer"
                          className="shrink-0 p-1.5 rounded-lg text-gray-300 hover:text-blue-600 hover:bg-blue-50 transition opacity-0 group-hover:opacity-100">
                          <Download className="w-4 h-4" />
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

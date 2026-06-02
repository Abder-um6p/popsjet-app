'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, Trash2, RefreshCw, AlertTriangle, Sparkles, Lightbulb } from 'lucide-react'
import { toast } from 'sonner'
import { PopcornIcon } from '@/components/ui/PopcornIcon'
import { getInitials } from '@/lib/utils'

const EMOJIS = ['👏', '🔥', '💡', '🚀', '⭐', '💪', '🎯', '❤️']

function timeAgo(date: string) {
  const d = new Date(date)
  const diff = (Date.now() - d.getTime()) / 1000
  if (diff < 60) return 'À l\'instant'
  if (diff < 3600) return `Il y a ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `Il y a ${Math.floor(diff / 3600)} h`
  return `Il y a ${Math.floor(diff / 86400)} j`
}

function DeleteConfirmModal({
  content,
  onClose,
  onConfirm,
  loading,
}: {
  content:   string
  onClose:   () => void
  onConfirm: () => void
  loading:   boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
            <AlertTriangle className="w-6 h-6 text-amber-500" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-gray-900">Mettre ce Pop à la corbeille ?</h3>
            <p className="text-xs text-gray-500 mt-0.5">Peut être restauré depuis la corbeille</p>
          </div>
        </div>

        <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
          <p className="text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap">{content}</p>
        </div>

        <div className="flex justify-end gap-3 pt-1">
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
          >
            Annuler
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition disabled:opacity-40"
          >
            {loading
              ? <RefreshCw className="w-3.5 h-3.5 animate-spin" />
              : <Trash2 className="w-3.5 h-3.5" />
            }
            {loading ? 'Suppression…' : 'Mettre à la corbeille'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PopsPage() {
  const [pops, setPops]             = useState<any[]>([])
  const [me, setMe]                 = useState<any>(null)
  const [content, setContent]       = useState('')
  const [posting, setPosting]       = useState(false)
  const [confirmPop, setConfirmPop] = useState<any>(null)
  const [deleting, setDeleting]     = useState(false)
  const [popAnalysis, setPopAnalysis]   = useState<any>(null)
  const [analyzing, setAnalyzing]       = useState(false)

  async function load() {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const [{ data: prof }, { data: feed }] = await Promise.all([
      supabase.from('profiles').select('id, full_name, avatar_url, role').eq('id', user.id).single(),
      supabase.from('pops')
        .select('*, author:profiles!pops_author_id_fkey(id, full_name, avatar_url), reactions:pop_reactions(*)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50),
    ])
    setMe({ ...prof, id: user.id })
    setPops(feed ?? [])
  }

  useEffect(() => { load() }, [])

  async function handlePost(e: React.FormEvent) {
    e.preventDefault()
    if (!content.trim()) return
    setPosting(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('pops').insert({ content: content.trim(), author_id: user!.id })
    setContent('')
    setPopAnalysis(null)
    await load()
    setPosting(false)
  }

  async function analyzePop() {
    if (content.trim().length < 5) return
    setAnalyzing(true)
    setPopAnalysis(null)
    try {
      const res = await fetch('/api/ai/pop-analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) throw new Error()
      setPopAnalysis(await res.json())
    } catch {
      toast.error('Analyse indisponible')
    } finally {
      setAnalyzing(false)
    }
  }

  async function handleReact(popId: string, emoji: string) {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const existing = pops.find(p => p.id === popId)
      ?.reactions?.find((r: any) => r.user_id === user.id && r.emoji === emoji)

    if (existing) {
      await supabase.from('pop_reactions').delete().eq('id', existing.id)
    } else {
      await supabase.from('pop_reactions').insert({ pop_id: popId, user_id: user.id, emoji })
    }
    await load()
  }

  async function handleDelete() {
    if (!confirmPop) return
    setDeleting(true)
    const res  = await fetch(`/api/pops/${confirmPop.id}/delete`, { method: 'DELETE' })
    const json = await res.json()
    setDeleting(false)
    if (!res.ok) {
      toast.error(json.error ?? 'Erreur lors de la suppression')
    } else {
      toast.success('Pop déplacé dans la corbeille')
      setConfirmPop(null)
      setPops(prev => prev.filter(p => p.id !== confirmPop.id))
    }
  }

  const canDelete = (pop: any) => {
    if (!me) return false
    const isPrivileged = ['admin', 'directeur'].includes(me.role)
    return isPrivileged || pop.author_id === me.id
  }

  return (
    <div className="space-y-8 max-w-2xl mx-auto">
      {confirmPop && (
        <DeleteConfirmModal
          content={confirmPop.content}
          onClose={() => setConfirmPop(null)}
          onConfirm={handleDelete}
          loading={deleting}
        />
      )}

      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-yellow-100 flex items-center justify-center">
          <PopcornIcon className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Pops</h1>
          <p className="text-sm text-gray-500 mt-0.5">Valorisez les contributions de l'équipe</p>
        </div>
      </div>

      {/* Compose */}
      <form onSubmit={handlePost} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex gap-3">
          <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold shrink-0">
            {me ? getInitials(me.full_name ?? '') : '?'}
          </div>
          <div className="flex-1">
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              placeholder="Partagez un bravo, une réalisation, une idée… 🚀"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-gray-50 text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent focus:bg-white transition resize-none"
            />
            {popAnalysis && (
              <div className="mt-2 flex flex-wrap items-center gap-2 px-3 py-2 bg-violet-50 rounded-xl border border-violet-100 text-xs">
                <Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                <span className="font-semibold text-violet-700">{popAnalysis.type?.charAt(0).toUpperCase() + popAnalysis.type?.slice(1)}</span>
                <span className="text-violet-400">·</span>
                <span className="px-1.5 py-0.5 rounded-full font-medium" style={{
                  backgroundColor: popAnalysis.priority === 'high' ? '#fee2e2' : popAnalysis.priority === 'medium' ? '#fef3c7' : '#f0fdf4',
                  color: popAnalysis.priority === 'high' ? '#dc2626' : popAnalysis.priority === 'medium' ? '#d97706' : '#16a34a',
                }}>
                  {popAnalysis.priority === 'high' ? 'Priorité haute' : popAnalysis.priority === 'medium' ? 'Priorité moyenne' : 'Priorité faible'}
                </span>
                <span className="text-violet-400">·</span>
                <span className="text-violet-600">#{popAnalysis.tag}</span>
                {popAnalysis.tip && (
                  <>
                    <span className="text-violet-400">·</span>
                    <span className="flex items-center gap-1 text-gray-500 italic"><Lightbulb className="w-3 h-3 text-amber-400" />{popAnalysis.tip}</span>
                  </>
                )}
              </div>
            )}
            <div className="flex items-center justify-between mt-2">
              <button
                type="button"
                onClick={analyzePop}
                disabled={analyzing || content.trim().length < 5}
                className="inline-flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-800 font-medium transition disabled:opacity-40"
              >
                {analyzing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                {analyzing ? 'Analyse…' : 'Analyser via IA'}
              </button>
              <button type="submit" disabled={posting || !content.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
                <Send className="w-3.5 h-3.5" />
                {posting ? 'Publication…' : 'Publier'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Feed */}
      {pops.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm py-16 text-center">
          <PopcornIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Soyez le premier à publier un Pop !</p>
        </div>
      ) : (
        <div className="space-y-4">
          {pops.map(pop => {
            const author = pop.author as any
            const reactions = (pop.reactions ?? []) as any[]
            const reactionMap: Record<string, { count: number; mine: boolean }> = {}
            for (const r of reactions) {
              if (!reactionMap[r.emoji]) reactionMap[r.emoji] = { count: 0, mine: false }
              reactionMap[r.emoji].count++
              if (r.user_id === me?.id) reactionMap[r.emoji].mine = true
            }

            return (
              <div key={pop.id} className="group relative bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-sm font-bold shrink-0">
                    {author?.avatar_url
                      ? <img src={author.avatar_url} className="w-full h-full object-cover rounded-full" alt="" />
                      : getInitials(author?.full_name ?? '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-semibold text-gray-900">{author?.full_name ?? 'Anonyme'}</span>
                      <span className="text-xs text-gray-400">{timeAgo(pop.created_at)}</span>
                    </div>
                    <p className="text-sm text-gray-700 mt-1.5 whitespace-pre-wrap">{pop.content}</p>

                    {/* Reactions */}
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      {Object.entries(reactionMap).map(([emoji, { count, mine }]) => (
                        <button key={emoji} onClick={() => handleReact(pop.id, emoji)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-sm border transition ${
                            mine ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
                          }`}>
                          {emoji} <span className="text-xs font-medium">{count}</span>
                        </button>
                      ))}
                      <div className="flex gap-1 ml-1">
                        {EMOJIS.map(emoji => (
                          <button key={emoji} onClick={() => handleReact(pop.id, emoji)}
                            className="w-7 h-7 flex items-center justify-center rounded-full text-sm hover:bg-gray-100 transition opacity-40 hover:opacity-100">
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Trash button — visible au survol pour auteur / admin / directeur */}
                {canDelete(pop) && (
                  <button
                    onClick={() => setConfirmPop(pop)}
                    className="absolute bottom-3 right-3 p-2 rounded-lg bg-white border border-red-100 text-red-400 hover:text-red-600 hover:bg-red-50 hover:border-red-200 shadow-sm transition-all opacity-0 group-hover:opacity-100"
                    title="Mettre à la corbeille"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

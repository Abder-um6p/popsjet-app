import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

const WRITE_ROLES = ['admin', 'directeur', 'chef_projet']

// GET /api/programs/[id]/documents
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const admin = createAdminClient()
    const { data, error } = await admin
      .from('program_documents')
      .select('id, created_at, document:document_id(id, title, file_name, mime_type, file_size, file_url)')
      .eq('program_id', id)
      .order('created_at', { ascending: true })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data ?? [])
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// POST /api/programs/[id]/documents — { document_id }
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !WRITE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const body = await req.json()
    const { document_id } = body
    if (!document_id) return NextResponse.json({ error: 'document_id requis' }, { status: 400 })

    const { data, error } = await admin
      .from('program_documents')
      .insert({ program_id: id, document_id })
      .select('id, created_at, document:document_id(id, title, file_name, mime_type, file_size, file_url)')
      .single()
    if (error) {
      if (error.code === '23505') return NextResponse.json({ error: 'Document déjà lié' }, { status: 409 })
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json(data, { status: 201 })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

// DELETE /api/programs/[id]/documents?document_id=xxx
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

    const admin = createAdminClient()
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).single()
    if (!profile || !WRITE_ROLES.includes(profile.role)) {
      return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })
    }

    const documentId = new URL(req.url).searchParams.get('document_id')
    if (!documentId) return NextResponse.json({ error: 'document_id requis' }, { status: 400 })

    const { error } = await admin
      .from('program_documents')
      .delete()
      .eq('program_id', id)
      .eq('document_id', documentId)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (err: unknown) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 })
  }
}

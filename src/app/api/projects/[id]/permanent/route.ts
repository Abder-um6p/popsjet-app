import { NextRequest, NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase/server'

// DELETE /api/projects/[id]/permanent — suppression définitive et irréversible
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles').select('role').eq('id', user.id).single()

  if (!profile || !['admin', 'directeur'].includes(profile.role)) {
    return NextResponse.json({ error: 'Réservé aux administrateurs et directeurs' }, { status: 403 })
  }

  const admin = createAdminClient()

  // Vérifier l'état du projet via deleted_at (toujours présent)
  const { data: project, error: fetchError } = await admin
    .from('projects')
    .select('id, title, deleted_at')
    .eq('id', id)
    .single()

  if (fetchError || !project) {
    return NextResponse.json({ error: 'Projet introuvable' }, { status: 404 })
  }

  // Sécurité : exiger que le projet soit d'abord dans la corbeille
  if (!project.deleted_at) {
    return NextResponse.json(
      { error: 'Le projet doit d\'abord être mis à la corbeille avant d\'être supprimé définitivement.' },
      { status: 400 }
    )
  }

  // Suppression définitive — les FK ON DELETE CASCADE nettoient les enregistrements liés
  const { error: deleteError } = await admin
    .from('projects')
    .delete()
    .eq('id', id)

  if (deleteError) {
    console.error('[projects PERMANENT DELETE] Erreur :', deleteError.message)
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, title: project.title })
}

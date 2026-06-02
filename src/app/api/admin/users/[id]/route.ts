import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function getAdminAuthClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

async function guardAdmin() {
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'Non authentifié', status: 401, callerId: null, callerEmail: null }
  const { data: profile } = await supabase.from('profiles').select('role, email').eq('id', user.id).single()
  if (profile?.role !== 'admin') return { error: 'Accès refusé', status: 403, callerId: null, callerEmail: null }
  return { error: null, status: 200, callerId: user.id, callerEmail: profile?.email ?? null }
}

/** PATCH /api/admin/users/[id]
 * body: { action: 'role' | 'disable' | 'enable', role?: string }
 */
export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const guard = await guardAdmin()
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const body = await req.json()
  const { action, role } = body as { action: string; role?: string }

  const adminClient = getAdminAuthClient()

  // Prevent self-modification
  if (id === guard.callerId && (action === 'disable' || action === 'role')) {
    return NextResponse.json({ error: 'Impossible de modifier votre propre compte ici' }, { status: 400 })
  }

  // Fetch target profile for audit log context
  const { data: targetProfile } = await adminClient
    .from('profiles')
    .select('role, email, full_name')
    .eq('id', id)
    .single()

  const now = new Date().toISOString()

  if (action === 'role') {
    const validRoles = ['admin', 'directeur', 'chef_projet', 'membre']
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json({ error: 'Rôle invalide' }, { status: 400 })
    }
    const oldRole = targetProfile?.role ?? null
    const { error } = await adminClient
      .from('profiles')
      .update({ role, updated_at: now })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Audit log (non-bloquant)
    try {
      await adminClient.from('audit_logs').insert({
        user_id:     guard.callerId,
        user_email:  guard.callerEmail,
        action:      'user_role_change',
        entity_type: 'profile',
        entity_id:   id,
        entity_name: targetProfile?.full_name ?? targetProfile?.email ?? id,
        old_data:    { role: oldRole },
        new_data:    { role },
        ip_address:  null,
        user_agent:  null,
      })
    } catch { /* swallow */ }
    return NextResponse.json({ message: 'Rôle mis à jour' })
  }

  if (action === 'disable') {
    const { error } = await adminClient
      .from('profiles')
      .update({ disabled_at: now, updated_at: now })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Also ban in Supabase Auth
    await adminClient.auth.admin.updateUserById(id, { ban_duration: '876600h' }) // ~100 years
    // Audit log (non-bloquant)
    try {
      await adminClient.from('audit_logs').insert({
        user_id:     guard.callerId,
        user_email:  guard.callerEmail,
        action:      'user_disabled',
        entity_type: 'profile',
        entity_id:   id,
        entity_name: targetProfile?.full_name ?? targetProfile?.email ?? id,
        old_data:    { disabled_at: null },
        new_data:    { disabled_at: now },
        ip_address:  null,
        user_agent:  null,
      })
    } catch { /* swallow */ }
    return NextResponse.json({ message: 'Compte désactivé' })
  }

  if (action === 'enable') {
    const { error } = await adminClient
      .from('profiles')
      .update({ disabled_at: null, updated_at: now })
      .eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // Unban in Supabase Auth
    await adminClient.auth.admin.updateUserById(id, { ban_duration: 'none' })
    // Audit log (non-bloquant)
    try {
      await adminClient.from('audit_logs').insert({
        user_id:     guard.callerId,
        user_email:  guard.callerEmail,
        action:      'user_enabled',
        entity_type: 'profile',
        entity_id:   id,
        entity_name: targetProfile?.full_name ?? targetProfile?.email ?? id,
        old_data:    { disabled_at: targetProfile?.email ?? null },
        new_data:    { disabled_at: null },
        ip_address:  null,
        user_agent:  null,
      })
    } catch { /* swallow */ }
    return NextResponse.json({ message: 'Compte réactivé' })
  }

  return NextResponse.json({ error: 'Action inconnue' }, { status: 400 })
}

/** GET /api/admin/users/[id] — full profile with projects, tasks, last_sign_in */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const guard = await guardAdmin()
  if (guard.error) return NextResponse.json({ error: guard.error }, { status: guard.status })

  const adminClient = getAdminAuthClient()

  // Profile
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (profileError || !profile) {
    return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 })
  }

  // Auth user (for last_sign_in_at)
  const { data: authUser } = await adminClient.auth.admin.getUserById(id)

  // Projects (via project_members)
  const { data: memberships } = await adminClient
    .from('project_members')
    .select('role, project_id, joined_at')
    .eq('profile_id', id)

  const projectIds = (memberships ?? []).map(m => m.project_id)
  const { data: projects } = projectIds.length
    ? await adminClient
        .from('projects')
        .select('id, title, code, status, type')
        .in('id', projectIds)
        .is('deleted_at', null)
    : { data: [] }

  // Task stats
  const { count: totalTasks } = await adminClient
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('assigned_to', id)
    .is('deleted_at', null)

  const { count: doneTasks } = await adminClient
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('assigned_to', id)
    .eq('status', 'done')
    .is('deleted_at', null)

  const projectMap = Object.fromEntries((projects ?? []).map(p => [p.id, p]))
  const projectsWithRole = (memberships ?? []).map(m => ({
    ...projectMap[m.project_id],
    memberRole: m.role,
    joinedAt: m.joined_at,
  })).filter(p => p.id)

  return NextResponse.json({
    profile,
    lastSignIn: authUser?.user?.last_sign_in_at ?? null,
    projects: projectsWithRole,
    tasks: { total: totalTasks ?? 0, done: doneTasks ?? 0 },
  })
}

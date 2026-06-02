/**
 * api-helpers.ts — Centralized API route utilities for Jet Pops
 *
 * Usage:
 *   import { requireAuth, requireRole, Err } from '@/lib/api-helpers'
 *
 *   const result = await requireAuth()
 *   if ('error' in result) return result.error
 *   const { ctx, admin } = result
 *
 *   const result = await requireRole(['admin', 'directeur'])
 *   if ('error' in result) return result.error
 */

import { createClient, createAdminClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'directeur' | 'chef_projet' | 'membre'

export interface AuthContext {
  userId:    string
  userEmail: string | null
  role:      UserRole
}

export type AdminClient = ReturnType<typeof createAdminClient>

export type AuthResult =
  | { ctx: AuthContext; admin: AdminClient }
  | { error: NextResponse }

// ─── Standard error factory ────────────────────────────────────────────────────

export const Err = {
  /** 401 Non authentifié */
  unauth: (msg = 'Non authentifié') =>
    NextResponse.json({ error: msg }, { status: 401 }),

  /** 403 Accès refusé */
  forbidden: (msg = 'Accès refusé') =>
    NextResponse.json({ error: msg }, { status: 403 }),

  /** 404 Ressource introuvable */
  notFound: (msg = 'Ressource introuvable') =>
    NextResponse.json({ error: msg }, { status: 404 }),

  /** 409 Conflit d'état */
  conflict: (msg: string) =>
    NextResponse.json({ error: msg }, { status: 409 }),

  /** 400 Requête invalide */
  badRequest: (msg: string) =>
    NextResponse.json({ error: msg }, { status: 400 }),

  /** 500 Erreur interne */
  internal: (msg: string) =>
    NextResponse.json({ error: msg }, { status: 500 }),
}

// ─── Auth helpers ─────────────────────────────────────────────────────────────

/**
 * requireAuth — vérifie la session et charge le profil utilisateur.
 *
 * Retourne { ctx, admin } si OK, { error: NextResponse } si non authentifié ou
 * profil introuvable.
 *
 * @example
 * const result = await requireAuth()
 * if ('error' in result) return result.error
 * const { ctx, admin } = result
 */
export async function requireAuth(): Promise<AuthResult> {
  const supabase = await createClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) return { error: Err.unauth() }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('role, email')
    .eq('id', user.id)
    .single()

  if (!profile) return { error: Err.forbidden('Profil introuvable') }

  return {
    ctx: {
      userId:    user.id,
      userEmail: (profile as { role: string; email: string | null }).email ?? null,
      role:      (profile as { role: string; email: string | null }).role as UserRole,
    },
    admin,
  }
}

/**
 * requireRole — vérifie la session ET qu'au moins un des rôles autorisés correspond.
 *
 * Retourne { ctx, admin } si OK, { error: NextResponse } sinon.
 *
 * @param allowedRoles  Liste des rôles autorisés, ex: ['admin', 'directeur']
 *
 * @example
 * const result = await requireRole(['admin', 'directeur'])
 * if ('error' in result) return result.error
 * const { ctx, admin } = result
 */
export async function requireRole(allowedRoles: UserRole[]): Promise<AuthResult> {
  const result = await requireAuth()
  if ('error' in result) return result

  if (!allowedRoles.includes(result.ctx.role)) {
    return { error: Err.forbidden() }
  }

  return result
}

// ─── Audit log helper ─────────────────────────────────────────────────────────

export interface AuditLogPayload {
  admin:       AdminClient
  userId:      string
  userEmail:   string | null
  action:      string
  entityType:  string
  entityId:    string | null
  entityName:  string | null
  oldData?:    unknown
  newData?:    unknown
}

/**
 * insertAuditLog — insère une entrée dans audit_logs. Non-bloquant : ne lève
 * jamais d'erreur (swallow), ne doit jamais bloquer la réponse principale.
 */
export async function insertAuditLog({
  admin,
  userId,
  userEmail,
  action,
  entityType,
  entityId,
  entityName,
  oldData,
  newData,
}: AuditLogPayload): Promise<void> {
  try {
    await admin.from('audit_logs').insert({
      user_id:     userId,
      user_email:  userEmail,
      action,
      entity_type: entityType,
      entity_id:   entityId,
      entity_name: entityName,
      old_data:    oldData ?? null,
      new_data:    newData ?? null,
      ip_address:  null,
      user_agent:  null,
    })
  } catch {
    /* swallow — audit log is never blocking */
  }
}

// ─── Role constants ───────────────────────────────────────────────────────────

export const ADMIN_ROLES:     UserRole[] = ['admin', 'directeur']
export const MANAGER_ROLES:   UserRole[] = ['admin', 'directeur', 'chef_projet']
export const ALL_AUTH_ROLES:  UserRole[] = ['admin', 'directeur', 'chef_projet', 'membre']

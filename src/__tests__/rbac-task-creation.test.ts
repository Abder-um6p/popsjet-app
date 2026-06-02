/**
 * Test RBAC — Création de tâche (P-05)
 *
 * Teste la logique d'autorisation isolée du contexte HTTP/Supabase.
 * On extrait et teste la fonction de décision de permission.
 */

import { describe, it, expect } from 'vitest'

// ─── Logique extraite de POST /api/tasks ─────────────────────────────────────

type UserRole = 'admin' | 'directeur' | 'chef_projet' | 'membre' | 'observateur'
type MembershipRole = 'chef_projet' | 'membre' | 'observateur' | null

interface PermissionContext {
  userRole:        UserRole
  isProjectCreator: boolean
  membershipRole:  MembershipRole   // null = pas membre
}

type PermissionResult =
  | { allowed: true }
  | { allowed: false; reason: string; httpStatus: 403 | 404 }

function canCreateTask(ctx: PermissionContext): PermissionResult {
  const { userRole, isProjectCreator, membershipRole } = ctx

  // admin et directeur ont toujours accès
  if (['admin', 'directeur'].includes(userRole)) {
    return { allowed: true }
  }

  // Créateur du projet a accès
  if (isProjectCreator) return { allowed: true }

  // Non-membre : refusé
  if (membershipRole === null) {
    return { allowed: false, reason: 'Accès refusé — vous n\'êtes pas membre de ce projet.', httpStatus: 403 }
  }

  // Observateur : refusé
  if (membershipRole === 'observateur') {
    return { allowed: false, reason: 'Les observateurs ne peuvent pas créer de tâches.', httpStatus: 403 }
  }

  return { allowed: true }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('P-05 — RBAC création de tâche', () => {

  describe('Rôles privilégiés (admin / directeur)', () => {
    it('admin non-membre → autorisé', () => {
      const result = canCreateTask({ userRole: 'admin', isProjectCreator: false, membershipRole: null })
      expect(result.allowed).toBe(true)
    })

    it('directeur non-membre → autorisé', () => {
      const result = canCreateTask({ userRole: 'directeur', isProjectCreator: false, membershipRole: null })
      expect(result.allowed).toBe(true)
    })
  })

  describe('Créateur du projet', () => {
    it('chef_projet créateur → autorisé', () => {
      const result = canCreateTask({ userRole: 'chef_projet', isProjectCreator: true, membershipRole: null })
      expect(result.allowed).toBe(true)
    })

    it('membre créateur → autorisé', () => {
      const result = canCreateTask({ userRole: 'membre', isProjectCreator: true, membershipRole: null })
      expect(result.allowed).toBe(true)
    })
  })

  describe('Membres du projet', () => {
    it('chef_projet membre → autorisé', () => {
      const result = canCreateTask({ userRole: 'chef_projet', isProjectCreator: false, membershipRole: 'chef_projet' })
      expect(result.allowed).toBe(true)
    })

    it('membre standard → autorisé', () => {
      const result = canCreateTask({ userRole: 'membre', isProjectCreator: false, membershipRole: 'membre' })
      expect(result.allowed).toBe(true)
    })

    it('observateur → refusé (HTTP 403)', () => {
      const result = canCreateTask({ userRole: 'membre', isProjectCreator: false, membershipRole: 'observateur' })
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.httpStatus).toBe(403)
        expect(result.reason).toContain('observateur')
      }
    })
  })

  describe('Non-membres', () => {
    it('chef_projet non-membre → refusé (HTTP 403)', () => {
      const result = canCreateTask({ userRole: 'chef_projet', isProjectCreator: false, membershipRole: null })
      expect(result.allowed).toBe(false)
      if (!result.allowed) {
        expect(result.httpStatus).toBe(403)
        expect(result.reason).toContain('membre')
      }
    })

    it('membre non-membre d\'un autre projet → refusé', () => {
      const result = canCreateTask({ userRole: 'membre', isProjectCreator: false, membershipRole: null })
      expect(result.allowed).toBe(false)
      if (!result.allowed) expect(result.httpStatus).toBe(403)
    })
  })
})

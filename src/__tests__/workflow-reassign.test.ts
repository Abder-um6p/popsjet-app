/**
 * Test WF-05 — Workflow réassignation tâche refusée
 *
 * Teste les transitions d'état et les règles de permission
 * pour la réassignation d'une tâche refusée.
 */

import { describe, it, expect } from 'vitest'

// ─── Logique extraite de POST /api/tasks/[id]/reassign ───────────────────────

type TaskStatus = 'pending_acceptance' | 'todo' | 'in_progress' | 'review' | 'done' | 'cancelled' | 'refused'
type UserRole = 'admin' | 'directeur' | 'chef_projet' | 'membre'

interface ReassignContext {
  taskStatus:      TaskStatus
  callerUserId:    string
  taskCreatorId:   string
  callerRole:      UserRole
  isMember:        boolean
  newAssigneeId:   string | null
}

type ReassignResult =
  | { ok: true;  newStatus: 'pending_acceptance' }
  | { ok: false; error: string; httpStatus: number }

function canReassign(ctx: ReassignContext): ReassignResult {
  const { taskStatus, callerUserId, taskCreatorId, callerRole, isMember, newAssigneeId } = ctx

  // Seules les tâches refusées peuvent être réassignées
  if (taskStatus !== 'refused') {
    return { ok: false, error: `Seules les tâches refusées peuvent être réassignées (statut actuel : "${taskStatus}").`, httpStatus: 409 }
  }

  // new_assignee_id obligatoire
  if (!newAssigneeId) {
    return { ok: false, error: 'new_assignee_id est requis', httpStatus: 400 }
  }

  // Permission : créateur OU rôle qualifié OU membre
  const isCreator    = callerUserId === taskCreatorId
  const isPrivileged = ['admin', 'directeur', 'chef_projet'].includes(callerRole)
  if (!isCreator && !isPrivileged && !isMember) {
    return { ok: false, error: 'Accès refusé', httpStatus: 403 }
  }

  return { ok: true, newStatus: 'pending_acceptance' }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('WF-05 — Réassignation tâche refusée', () => {

  const baseCtx: ReassignContext = {
    taskStatus:    'refused',
    callerUserId:  'user-1',
    taskCreatorId: 'user-1',
    callerRole:    'chef_projet',
    isMember:      true,
    newAssigneeId: 'user-2',
  }

  describe('Transition de statut', () => {
    it('refused → pending_acceptance après réassignation', () => {
      const result = canReassign(baseCtx)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.newStatus).toBe('pending_acceptance')
    })

    it('tâche todo ne peut pas être réassignée via cette route', () => {
      const result = canReassign({ ...baseCtx, taskStatus: 'todo' })
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.httpStatus).toBe(409)
        expect(result.error).toContain('todo')
      }
    })

    it('tâche in_progress ne peut pas être réassignée', () => {
      const result = canReassign({ ...baseCtx, taskStatus: 'in_progress' })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.httpStatus).toBe(409)
    })

    it('tâche done ne peut pas être réassignée', () => {
      const result = canReassign({ ...baseCtx, taskStatus: 'done' })
      expect(result.ok).toBe(false)
    })
  })

  describe('Validation input', () => {
    it('new_assignee_id manquant → HTTP 400', () => {
      const result = canReassign({ ...baseCtx, newAssigneeId: null })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.httpStatus).toBe(400)
    })
  })

  describe('Permissions', () => {
    it('créateur de la tâche → autorisé', () => {
      const result = canReassign({ ...baseCtx, callerUserId: 'user-1', taskCreatorId: 'user-1', callerRole: 'membre', isMember: false })
      expect(result.ok).toBe(true)
    })

    it('admin non-créateur non-membre → autorisé', () => {
      const result = canReassign({ ...baseCtx, callerUserId: 'admin-1', taskCreatorId: 'user-1', callerRole: 'admin', isMember: false })
      expect(result.ok).toBe(true)
    })

    it('directeur → autorisé', () => {
      const result = canReassign({ ...baseCtx, callerUserId: 'dir-1', taskCreatorId: 'user-1', callerRole: 'directeur', isMember: false })
      expect(result.ok).toBe(true)
    })

    it('membre non-créateur non-privilégié non-membre projet → refusé', () => {
      const result = canReassign({
        ...baseCtx,
        callerUserId:  'other-user',
        taskCreatorId: 'user-1',
        callerRole:    'membre',
        isMember:      false,
      })
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.httpStatus).toBe(403)
    })
  })
})

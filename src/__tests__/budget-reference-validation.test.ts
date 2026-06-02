/**
 * Test FIN-05 — Validation référence budgétaire inactive
 *
 * Teste la logique de validation extraite des routes
 * POST /api/tasks, PATCH /api/tasks/[id], POST /api/expenses.
 */

import { describe, it, expect } from 'vitest'

// ─── Logique extraite des routes ──────────────────────────────────────────────

interface BudgetRef {
  id:        string
  is_active: boolean
}

type ValidationResult =
  | { valid: true }
  | { valid: false; error: string; httpStatus: 400 }

function validateBudgetReference(
  budgetReferenceId: string | null | undefined,
  foundRef: BudgetRef | null
): ValidationResult {
  // Pas de référence fournie → aucune validation requise
  if (!budgetReferenceId) return { valid: true }

  if (!foundRef) {
    return { valid: false, error: 'Référence budgétaire introuvable.', httpStatus: 400 }
  }

  if (!foundRef.is_active) {
    return {
      valid:      false,
      error:      'Cette référence budgétaire est inactive et ne peut plus être utilisée.',
      httpStatus: 400,
    }
  }

  return { valid: true }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FIN-05 — Validation référence budgétaire', () => {

  const activeRef:   BudgetRef = { id: 'ref-1', is_active: true }
  const inactiveRef: BudgetRef = { id: 'ref-2', is_active: false }

  describe('Sans référence fournie', () => {
    it('budget_reference_id null → validation ignorée', () => {
      const r = validateBudgetReference(null, null)
      expect(r.valid).toBe(true)
    })

    it('budget_reference_id undefined → validation ignorée', () => {
      const r = validateBudgetReference(undefined, null)
      expect(r.valid).toBe(true)
    })
  })

  describe('Référence active', () => {
    it('référence active → valide', () => {
      const r = validateBudgetReference('ref-1', activeRef)
      expect(r.valid).toBe(true)
    })
  })

  describe('Référence introuvable', () => {
    it('ID fourni mais non trouvé en DB → HTTP 400', () => {
      const r = validateBudgetReference('ref-inexistant', null)
      expect(r.valid).toBe(false)
      if (!r.valid) {
        expect(r.httpStatus).toBe(400)
        expect(r.error).toContain('introuvable')
      }
    })
  })

  describe('Référence inactive', () => {
    it('référence inactive → HTTP 400 avec message explicite', () => {
      const r = validateBudgetReference('ref-2', inactiveRef)
      expect(r.valid).toBe(false)
      if (!r.valid) {
        expect(r.httpStatus).toBe(400)
        expect(r.error).toBe('Cette référence budgétaire est inactive et ne peut plus être utilisée.')
      }
    })

    it('message d\'erreur contient "inactive"', () => {
      const r = validateBudgetReference('ref-2', inactiveRef)
      if (!r.valid) expect(r.error.toLowerCase()).toContain('inactive')
    })

    it('code HTTP est bien 400 (pas 403 ni 422)', () => {
      const r = validateBudgetReference('ref-2', inactiveRef)
      if (!r.valid) expect(r.httpStatus).toBe(400)
    })
  })

  describe('Cas limites', () => {
    it('is_active = false → invalide', () => {
      const r = validateBudgetReference('ref-2', { id: 'ref-2', is_active: false })
      expect(r.valid).toBe(false)
    })

    it('is_active = true → valide', () => {
      const r = validateBudgetReference('ref-1', { id: 'ref-1', is_active: true })
      expect(r.valid).toBe(true)
    })
  })
})

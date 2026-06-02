/**
 * Test FIN-04 — Calcul du résumé financier projet
 *
 * Teste la logique de calcul extraite de projects/[id]/page.tsx.
 */

import { describe, it, expect } from 'vitest'

// ─── Logique extraite de projects/[id]/page.tsx ───────────────────────────────

interface Expense { amount: number }

interface FinancialSummary {
  budget:        number
  totalApproved: number
  remaining:     number | null
  consumedPct:   number | null
  budgetAlert:   boolean
}

function computeFinancialSummary(
  projectBudget: number | null | undefined,
  approvedExpenses: Expense[]
): FinancialSummary {
  const budget       = projectBudget ?? 0
  const totalApproved = approvedExpenses.reduce((s, e) => s + (e.amount ?? 0), 0)
  const remaining    = budget > 0 ? budget - totalApproved : null
  const consumedPct  = budget > 0 ? Math.min(Math.round((totalApproved / budget) * 100), 100) : null
  const budgetAlert  = consumedPct !== null && consumedPct >= 80

  return { budget, totalApproved, remaining, consumedPct, budgetAlert }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('FIN-04 — Calcul résumé financier', () => {

  describe('Budget vide / nul', () => {
    it('budget null → remaining null, consumedPct null, pas d\'alerte', () => {
      const s = computeFinancialSummary(null, [{ amount: 500 }])
      expect(s.budget).toBe(0)
      expect(s.remaining).toBeNull()
      expect(s.consumedPct).toBeNull()
      expect(s.budgetAlert).toBe(false)
    })

    it('budget 0 → remaining null, pas de division par zéro', () => {
      const s = computeFinancialSummary(0, [{ amount: 100 }])
      expect(s.remaining).toBeNull()
      expect(s.consumedPct).toBeNull()
      expect(s.budgetAlert).toBe(false)
    })

    it('budget défini mais aucune dépense → 0% consommé', () => {
      const s = computeFinancialSummary(10000, [])
      expect(s.totalApproved).toBe(0)
      expect(s.remaining).toBe(10000)
      expect(s.consumedPct).toBe(0)
      expect(s.budgetAlert).toBe(false)
    })
  })

  describe('Budget partiellement consommé', () => {
    it('50% consommé → pas d\'alerte', () => {
      const s = computeFinancialSummary(10000, [{ amount: 5000 }])
      expect(s.totalApproved).toBe(5000)
      expect(s.remaining).toBe(5000)
      expect(s.consumedPct).toBe(50)
      expect(s.budgetAlert).toBe(false)
    })

    it('79% consommé → juste en dessous du seuil, pas d\'alerte', () => {
      const s = computeFinancialSummary(10000, [{ amount: 7900 }])
      expect(s.consumedPct).toBe(79)
      expect(s.budgetAlert).toBe(false)
    })

    it('80% consommé → alerte déclenchée', () => {
      const s = computeFinancialSummary(10000, [{ amount: 8000 }])
      expect(s.consumedPct).toBe(80)
      expect(s.budgetAlert).toBe(true)
    })

    it('85% consommé (plusieurs dépenses) → alerte', () => {
      const s = computeFinancialSummary(10000, [
        { amount: 4000 },
        { amount: 3000 },
        { amount: 1500 },
      ])
      expect(s.totalApproved).toBe(8500)
      expect(s.consumedPct).toBe(85)
      expect(s.budgetAlert).toBe(true)
    })
  })

  describe('Budget dépassé', () => {
    it('100% consommé exactement → alerte, remaining=0', () => {
      const s = computeFinancialSummary(10000, [{ amount: 10000 }])
      expect(s.totalApproved).toBe(10000)
      expect(s.remaining).toBe(0)
      expect(s.consumedPct).toBe(100)
      expect(s.budgetAlert).toBe(true)
    })

    it('dépassement → consumedPct plafonné à 100, remaining négatif', () => {
      const s = computeFinancialSummary(10000, [{ amount: 12000 }])
      expect(s.totalApproved).toBe(12000)
      expect(s.remaining).toBe(-2000)
      expect(s.consumedPct).toBe(100)  // Math.min(..., 100)
      expect(s.budgetAlert).toBe(true)
    })

    it('arrondi correct : 8333 / 10000 = 83%', () => {
      const s = computeFinancialSummary(10000, [{ amount: 8333 }])
      expect(s.consumedPct).toBe(83)
    })
  })
})

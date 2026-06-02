-- ============================================================
-- Migration 007 — Audit Logs : rétention financière + accès directeurs
-- À exécuter dans Supabase → SQL Editor
-- ============================================================

-- ── 1. Rétention différenciée (VH-01) ────────────────────────────────────────
-- Les logs financiers (expense_*) doivent être conservés ≥ 5 ans (obligation légale Maroc).
-- Les autres logs sont nettoyés après 90 jours.
CREATE OR REPLACE FUNCTION public.cleanup_old_audit_logs()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Supprimer les logs non-financiers de plus de 90 jours
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - INTERVAL '90 days'
    AND action NOT LIKE 'expense_%';

  -- Supprimer les logs financiers de plus de 5 ans
  DELETE FROM public.audit_logs
  WHERE created_at < NOW() - INTERVAL '5 years'
    AND action LIKE 'expense_%';
END;
$$;

-- ── 2. RLS : ouvrir la lecture aux directeurs (VH-02) ─────────────────────────
-- La politique existante est admin-only. On la remplace pour inclure les directeurs.
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.audit_logs;

CREATE POLICY "Admins and directors can read audit logs"
  ON public.audit_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'directeur')
    )
  );

-- ── Rafraîchit le cache PostgREST ────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';

-- ============================================================
-- RC1 RESET — Nettoyage complet des données métier de test
-- ⚠️  EXÉCUTER UNIQUEMENT APRÈS BACKUP CONFIRMÉ (rc1_02_backup)
-- ⚠️  IRRÉVERSIBLE sans backup
-- Conserve : abderrahmane.haddad@um6p.ma + paramètres système
-- ============================================================

BEGIN;

-- ── 0. Définir l'UUID admin à conserver ──────────────────────
-- Vérifier d'abord avec rc1_01_audit.sql que l'ID est correct.
DO $$
DECLARE
  v_admin_id UUID := 'a105de0a-a52f-46d3-bfbe-a0b570a3ddf9';
  v_admin_email TEXT;
BEGIN
  SELECT email INTO v_admin_email FROM public.profiles WHERE id = v_admin_id;
  IF v_admin_email IS NULL THEN
    RAISE EXCEPTION 'Admin introuvable (id=%). Vérifier rc1_01_audit.sql avant de continuer.', v_admin_id;
  END IF;
  RAISE NOTICE 'Admin identifié : % (%)', v_admin_email, v_admin_id;
END $$;

-- ── 1. Réactions sur Pops ─────────────────────────────────────
DELETE FROM public.pop_reactions;
RAISE NOTICE '✓ pop_reactions supprimées';

-- ── 2. Pops ───────────────────────────────────────────────────
DELETE FROM public.pops;
RAISE NOTICE '✓ pops supprimés';

-- ── 3. Task activity logs ─────────────────────────────────────
DELETE FROM public.task_activity_logs;
RAISE NOTICE '✓ task_activity_logs supprimés';

-- ── 4. Commentaires de tâches ─────────────────────────────────
DELETE FROM public.task_comments;
RAISE NOTICE '✓ task_comments supprimés';

-- ── 5. Documents de tâches (Storage à nettoyer séparément) ───
DELETE FROM public.task_documents;
RAISE NOTICE '✓ task_documents supprimés (fichiers Storage à purger via rc1_04_storage.sql)';

-- ── 6. Notifications ──────────────────────────────────────────
DELETE FROM public.notifications;
RAISE NOTICE '✓ notifications supprimées';

-- ── 7. Dépenses ───────────────────────────────────────────────
DELETE FROM public.expenses;
RAISE NOTICE '✓ expenses supprimées';

-- ── 8. Participants ───────────────────────────────────────────
DELETE FROM public.participants;
RAISE NOTICE '✓ participants supprimés';

-- ── 9. Documents projet (Storage à nettoyer séparément) ───────
DELETE FROM public.documents;
RAISE NOTICE '✓ documents supprimés';

-- ── 10. Tâches ────────────────────────────────────────────────
DELETE FROM public.tasks;
RAISE NOTICE '✓ tasks supprimées';

-- ── 11. Membres des projets ───────────────────────────────────
DELETE FROM public.project_members;
RAISE NOTICE '✓ project_members supprimés';

-- ── 12. Budget références ─────────────────────────────────────
DELETE FROM public.budget_references;
RAISE NOTICE '✓ budget_references supprimées';

-- ── 13. Projets ───────────────────────────────────────────────
DELETE FROM public.projects;
RAISE NOTICE '✓ projects supprimés';

-- ── 14. Programmes ────────────────────────────────────────────
DELETE FROM public.programs;
RAISE NOTICE '✓ programs supprimés';

-- ── 15. Audit logs (garder 0 — c'est un reset de test) ────────
DELETE FROM public.audit_logs;
RAISE NOTICE '✓ audit_logs supprimés';

-- ── 16. Profils — supprimer TOUT sauf admin ───────────────────
DELETE FROM public.profiles
WHERE id != 'a105de0a-a52f-46d3-bfbe-a0b570a3ddf9';
RAISE NOTICE '✓ profils non-admin supprimés';

-- ── 17. Auth users — supprimer TOUT sauf admin ────────────────
-- Ceci supprime les comptes Supabase Auth (connexion impossible pour ces utilisateurs)
DELETE FROM auth.users
WHERE id != 'a105de0a-a52f-46d3-bfbe-a0b570a3ddf9';
RAISE NOTICE '✓ auth.users non-admin supprimés';

-- ── 18. Paramètres système — conserver integration_settings ───
-- NE PAS SUPPRIMER : configuration Google/Microsoft/Slack conservée
-- DELETE FROM public.integration_settings; -- intentionnellement commenté

-- ── Résumé final ─────────────────────────────────────────────
RAISE NOTICE '====================================';
RAISE NOTICE 'RESET RC1 TERMINÉ';
RAISE NOTICE 'Compte conservé : abderrahmane.haddad@um6p.ma';
RAISE NOTICE '====================================';

COMMIT;

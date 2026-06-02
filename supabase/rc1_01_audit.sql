-- ============================================================
-- RC1 AUDIT — Compter les lignes par table métier
-- Exécuter dans Supabase → SQL Editor AVANT tout nettoyage
-- ============================================================

SELECT
  'profiles'            AS table_name, COUNT(*) AS rows FROM public.profiles
UNION ALL SELECT 'programs',            COUNT(*) FROM public.programs
UNION ALL SELECT 'projects',            COUNT(*) FROM public.projects
UNION ALL SELECT 'project_members',     COUNT(*) FROM public.project_members
UNION ALL SELECT 'tasks',               COUNT(*) FROM public.tasks
UNION ALL SELECT 'task_comments',       COUNT(*) FROM public.task_comments
UNION ALL SELECT 'task_documents',      COUNT(*) FROM public.task_documents
UNION ALL SELECT 'task_activity_logs',  COUNT(*) FROM public.task_activity_logs
UNION ALL SELECT 'expenses',            COUNT(*) FROM public.expenses
UNION ALL SELECT 'documents',           COUNT(*) FROM public.documents
UNION ALL SELECT 'participants',        COUNT(*) FROM public.participants
UNION ALL SELECT 'pops',                COUNT(*) FROM public.pops
UNION ALL SELECT 'pop_reactions',       COUNT(*) FROM public.pop_reactions
UNION ALL SELECT 'notifications',       COUNT(*) FROM public.notifications
UNION ALL SELECT 'budget_references',   COUNT(*) FROM public.budget_references
UNION ALL SELECT 'audit_logs',          COUNT(*) FROM public.audit_logs
UNION ALL SELECT 'integration_settings',COUNT(*) FROM public.integration_settings
ORDER BY table_name;

-- ── Compte admin à conserver ──────────────────────────────────
SELECT id, email, role, onboarding_completed
FROM public.profiles
WHERE email = 'abderrahmane.haddad@um6p.ma';

-- ── Liste des utilisateurs auth ───────────────────────────────
SELECT id, email, created_at
FROM auth.users
ORDER BY created_at;

-- ============================================================
-- RC1 VÉRIFICATION — Confirmer l'état post-reset
-- Exécuter après rc1_03_reset.sql + rc1_04_storage_cleanup.sql
-- ============================================================

-- ── Comptage final de toutes les tables ──────────────────────
SELECT
  'profiles'            AS table_name, COUNT(*) AS rows_remaining FROM public.profiles
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
ORDER BY table_name;

-- ── Résultat attendu ─────────────────────────────────────────
-- profiles          = 1  (admin uniquement)
-- programs          = 0
-- projects          = 0
-- project_members   = 0
-- tasks             = 0
-- task_comments     = 0
-- task_documents    = 0
-- task_activity_logs= 0
-- expenses          = 0
-- documents         = 0
-- participants      = 0
-- pops              = 0
-- pop_reactions     = 0
-- notifications     = 0
-- budget_references = 0
-- audit_logs        = 0

-- ── Vérifier que l'admin peut se connecter ────────────────────
SELECT
  p.id,
  p.email,
  p.role,
  p.full_name,
  p.onboarding_completed,
  u.email AS auth_email,
  u.last_sign_in_at
FROM public.profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.email = 'abderrahmane.haddad@um6p.ma';

-- ── Vérifier Storage ─────────────────────────────────────────
SELECT bucket_id, COUNT(*) as files_remaining
FROM storage.objects
WHERE bucket_id IN ('documents', 'task-documents', 'receipts', 'avatars')
GROUP BY bucket_id
ORDER BY bucket_id;

-- Résultat attendu Storage:
-- avatars         = N  (avatar admin conservé)
-- documents       = 0
-- receipts        = 0
-- task-documents  = 0

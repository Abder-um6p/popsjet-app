-- ============================================================
-- RC1 STORAGE CLEANUP — Supprimer les fichiers des buckets
-- Exécuter APRÈS rc1_03_reset.sql
-- Nécessite l'extension pg_net ou à faire manuellement via Supabase Storage UI
-- ============================================================

-- ── Option A : Via Supabase Storage UI (Recommandé) ──────────
-- 1. Aller sur https://supabase.com/dashboard/project/tfjiorvugvajzirjfmvq/storage/buckets
-- 2. Sélectionner le bucket "documents"    → tout sélectionner → supprimer
-- 3. Sélectionner le bucket "task-documents" → tout sélectionner → supprimer
-- 4. Sélectionner le bucket "receipts"    → tout sélectionner → supprimer
-- 5. NE PAS TOUCHER au bucket "avatars"   (contient l'avatar admin)

-- ── Option B : Via SQL (si storage.objects est accessible) ───
-- Supprimer les objets dans les buckets métier
DELETE FROM storage.objects
WHERE bucket_id IN ('documents', 'task-documents', 'receipts');

-- Vérification après nettoyage Storage
SELECT bucket_id, COUNT(*) as files_remaining
FROM storage.objects
GROUP BY bucket_id
ORDER BY bucket_id;

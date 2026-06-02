# Procédure de Backup avant Reset RC1

## Option A — Backup natif Supabase (Recommandé)

1. Aller sur https://supabase.com/dashboard/project/tfjiorvugvajzirjfmvq/database/backups
2. Cliquer sur **"Create backup"** ou télécharger la dernière sauvegarde automatique.
3. Conserver le fichier `.sql.gz` localement.

> Supabase Pro fait des backups automatiques quotidiens. Si le projet est sur le plan gratuit,
> utiliser l'Option B.

---

## Option B — Export via pg_dump (ligne de commande)

Récupérer le connection string dans :
Supabase → Settings → Database → Connection string (URI)

```bash
# Remplacer <PASSWORD> par le mot de passe DB
pg_dump \
  "postgresql://postgres:<PASSWORD>@db.tfjiorvugvajzirjfmvq.supabase.co:5432/postgres" \
  --no-owner \
  --no-acl \
  --format=custom \
  --file=popsjet_backup_rc1_$(date +%Y%m%d_%H%M%S).dump
```

---

## Option C — Export CSV via Supabase Table Editor

Pour chaque table importante :
1. Supabase → Table Editor → sélectionner la table
2. Cliquer **Export CSV**
3. Tables prioritaires : projects, tasks, expenses, profiles

---

## Vérification du backup

Après backup, vérifier :
```bash
pg_restore --list popsjet_backup_rc1_*.dump | head -30
```

---

## IMPORTANT
Ne pas exécuter `rc1_03_reset.sql` avant d'avoir confirmé le backup.

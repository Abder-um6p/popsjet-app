# 🚀 Démarrer Pops Jet en local

## 1. Ouvrir le Terminal

## 2. Aller dans le dossier du projet

```bash
cd ~/Documents/Claude\ Dev\ IE/popsjet-app
```

## 3. Installer les dépendances (une seule fois)

```bash
npm install
```

⏳ Attendre ~2-3 minutes la première fois.

## 4. Lancer le serveur de développement

```bash
npm run dev
```

## 5. Ouvrir dans le navigateur

```
http://localhost:3000
```

Tu devrais être redirigé vers la page de login Pops Jet.

---

## ⚠️ Avant de te connecter

Assure-toi que dans `.env.local` :
- `NEXT_PUBLIC_SUPABASE_URL` est rempli ✅
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` est rempli ✅
- `SUPABASE_SERVICE_ROLE_KEY` est à remplir depuis Supabase > Settings > API

---

## Compte de test

Crée d'abord un utilisateur admin depuis Supabase :
1. Supabase Dashboard → Authentication → Users → Invite user
2. Email : ton adresse
3. Après création, mettre à jour le profil :
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'ton@email.ma';
   ```

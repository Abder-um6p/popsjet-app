# Credentials Demo — Jet Pops / I&E Lab UM6P

Mot de passe universel : **`DemoPass2026!`**

| Nom | Email | Rôle | Description |
|-----|-------|------|-------------|
| Yasmine Benali | yasmine.benali@um6p.ma | `admin` | Administratrice plateforme — accès complet, gestion utilisateurs |
| Karim Alaoui | karim.alaoui@um6p.ma | `directeur` | Directeur I&E Lab — validation budgets, vision stratégique |
| Nadia El Fassi | nadia.elfassi@um6p.ma | `chef_projet` | Responsable Hackathon IA & Données + Workshop Design Thinking |
| Mehdi Chraibi | mehdi.chraibi@um6p.ma | `chef_projet` | Responsable Bootcamp Entrepreneuriat + Incubation Batch 3 |
| Sara Idrissi | sara.idrissi@um6p.ma | `membre` | Chargée communication — membre sur 3 projets |
| Youssef Tazi | youssef.tazi@um6p.ma | `membre` | Chargé logistique — membre sur 3 projets |
| Imane Bouhali | imane.bouhali@um6p.ma | `membre` | Analyste finance & reporting — membre sur 2 projets |
| Omar Benjelloun | omar.benjelloun@um6p.ma | `membre` | Coordinateur entrepreneuriat — membre sur 3 projets |

---

## Données de test rapide

### Projets disponibles

| Code | Titre | Programme | Statut | Avancement |
|------|-------|-----------|--------|------------|
| IH-HACK-26 | Hackathon IA & Données 2026 | Innovation Hub 2026 | Actif | 45% |
| IH-DT-26 | Workshop Design Thinking | Innovation Hub 2026 | Actif | 70% |
| SF-BOOT-26 | Bootcamp Entrepreneuriat S1 2026 | Startup Factory UM6P | Actif | 30% |
| SF-INC-26B3 | Incubation Batch 3 — 2026 | Startup Factory UM6P | Brouillon | 0% |

### Scénarios de test recommandés

1. **Admin (Yasmine)** — Voir tous les projets, gérer les utilisateurs, lire les audit logs
2. **Directeur (Karim)** — Approuver les dépenses en attente, créer un nouveau programme
3. **Chef projet (Nadia)** — Gérer les tâches du hackathon, soumettre une dépense
4. **Chef projet (Mehdi)** — Mettre à jour l'avancement du bootcamp, ajouter un membre
5. **Membre (Sara)** — Voir ses tâches assignées, publier un Pop
6. **Membre (Imane)** — Consulter les dépenses du bootcamp, voir le rapport budget

### Dépenses à valider (Karim/Admin)

- 4 dépenses `pending` sur le Hackathon → à approuver ou rejeter
- 1 dépense `pending` sur le Workshop  
- 2 dépenses `pending` sur le Bootcamp
- 3 dépenses `pending` sur l'Incubation Batch 3

### Tâches en retard potentiel

- *Recruter mentors et jury* (Hackathon) — due: 2026-05-25, statut: `review`
- *Préparer espace créativité* (Workshop) — due: 2026-05-25, statut: `review`

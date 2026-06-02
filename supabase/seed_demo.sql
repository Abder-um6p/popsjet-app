-- ============================================================
-- SEED DEMO — Jet Pops / I&E Lab UM6P
-- Exécuter dans le SQL Editor Supabase (service_role)
-- Idempotent : ON CONFLICT DO NOTHING partout
-- Mot de passe universel : DemoPass2026!
-- ============================================================

-- ⚠️  Prérequis : exécuter seed_demo_enums.sql en PREMIER
--    (PostgreSQL impose que les nouvelles valeurs d'enum soient
--     committées avant de pouvoir être utilisées dans un INSERT)

-- ────────────────────────────────────────────────────────────
-- 1. AUTH.USERS
-- ────────────────────────────────────────────────────────────

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  is_super_admin, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
) VALUES
  -- Yasmine Benali — Admin
  (
    'a0000001-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'yasmine.benali@um6p.ma',
    crypt('DemoPass2026!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    false, NOW(), NOW(), '', '', '', ''
  ),
  -- Karim Alaoui — Directeur
  (
    'a0000001-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'karim.alaoui@um6p.ma',
    crypt('DemoPass2026!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    false, NOW(), NOW(), '', '', '', ''
  ),
  -- Nadia El Fassi — Chef de Projet
  (
    'a0000001-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'nadia.elfassi@um6p.ma',
    crypt('DemoPass2026!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    false, NOW(), NOW(), '', '', '', ''
  ),
  -- Mehdi Chraibi — Chef de Projet
  (
    'a0000001-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'mehdi.chraibi@um6p.ma',
    crypt('DemoPass2026!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    false, NOW(), NOW(), '', '', '', ''
  ),
  -- Sara Idrissi — Membre
  (
    'a0000001-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'sara.idrissi@um6p.ma',
    crypt('DemoPass2026!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    false, NOW(), NOW(), '', '', '', ''
  ),
  -- Youssef Tazi — Membre
  (
    'a0000001-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'youssef.tazi@um6p.ma',
    crypt('DemoPass2026!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    false, NOW(), NOW(), '', '', '', ''
  ),
  -- Imane Bouhali — Membre
  (
    'a0000001-0000-0000-0000-000000000007',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'imane.bouhali@um6p.ma',
    crypt('DemoPass2026!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    false, NOW(), NOW(), '', '', '', ''
  ),
  -- Omar Benjelloun — Membre
  (
    'a0000001-0000-0000-0000-000000000008',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'omar.benjelloun@um6p.ma',
    crypt('DemoPass2026!', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}', '{}',
    false, NOW(), NOW(), '', '', '', ''
  )
ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- 2. PROFILES
-- ────────────────────────────────────────────────────────────

INSERT INTO public.profiles (
  id, full_name, email, role, bio,
  skills, languages, onboarding_completed,
  created_at, updated_at
) VALUES
  (
    'a0000001-0000-0000-0000-000000000001',
    'Yasmine Benali', 'yasmine.benali@um6p.ma', 'admin',
    'Responsable de la plateforme Jet Pops, coordination des équipes I&E Lab.',
    ARRAY['platform management','data analysis','reporting','coordination'],
    ARRAY['Français','Arabe','Anglais'],
    true, NOW(), NOW()
  ),
  (
    'a0000001-0000-0000-0000-000000000002',
    'Karim Alaoui', 'karim.alaoui@um6p.ma', 'directeur',
    'Directeur du laboratoire I&E, 12 ans d''expérience en innovation et développement de startups.',
    ARRAY['strategic planning','entrepreneurship','incubation','fundraising','leadership'],
    ARRAY['Français','Anglais','Arabe'],
    true, NOW(), NOW()
  ),
  (
    'a0000001-0000-0000-0000-000000000003',
    'Nadia El Fassi', 'nadia.elfassi@um6p.ma', 'chef_projet',
    'Gestion de workshops et hackathons depuis 5 ans, spécialiste en coordination événementielle.',
    ARRAY['project management','event coordination','logistics','communication','facilitation'],
    ARRAY['Français','Arabe'],
    true, NOW(), NOW()
  ),
  (
    'a0000001-0000-0000-0000-000000000004',
    'Mehdi Chraibi', 'mehdi.chraibi@um6p.ma', 'chef_projet',
    'Accompagnement de startups early-stage, expert en méthodologies agiles et design thinking.',
    ARRAY['incubation','startup coaching','design thinking','entrepreneurship','agile'],
    ARRAY['Français','Anglais'],
    true, NOW(), NOW()
  ),
  (
    'a0000001-0000-0000-0000-000000000005',
    'Sara Idrissi', 'sara.idrissi@um6p.ma', 'membre',
    'Communication digitale et création de contenu pour l''écosystème startup UM6P.',
    ARRAY['communication','social media','design','content creation','branding'],
    ARRAY['Français','Arabe','Anglais'],
    true, NOW(), NOW()
  ),
  (
    'a0000001-0000-0000-0000-000000000006',
    'Youssef Tazi', 'youssef.tazi@um6p.ma', 'membre',
    'Logistique événementielle et gestion des fournisseurs pour les événements I&E Lab.',
    ARRAY['logistics','event coordination','supplier management','budgeting','operations'],
    ARRAY['Français','Arabe'],
    true, NOW(), NOW()
  ),
  (
    'a0000001-0000-0000-0000-000000000007',
    'Imane Bouhali', 'imane.bouhali@um6p.ma', 'membre',
    'Suivi budgétaire des projets et reporting financier auprès de la direction.',
    ARRAY['finance','reporting','Excel','data analysis','budgeting','accounting'],
    ARRAY['Français','Anglais'],
    true, NOW(), NOW()
  ),
  (
    'a0000001-0000-0000-0000-000000000008',
    'Omar Benjelloun', 'omar.benjelloun@um6p.ma', 'membre',
    'Animation de la communauté entrepreneuriale et coaching des porteurs de projets.',
    ARRAY['entrepreneurship','coaching','event coordination','networking','community management'],
    ARRAY['Français','Arabe','Anglais'],
    true, NOW(), NOW()
  )
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- 3. PROGRAMS
-- ────────────────────────────────────────────────────────────

INSERT INTO public.programs (
  id, code, name, description, status, created_by, created_at
) VALUES
  (
    'b0000001-0000-0000-0000-000000000001',
    'IH-2026',
    'Innovation Hub 2026',
    'Programme annuel de soutien à l''innovation technologique et entrepreneuriale au sein de l''écosystème UM6P.',
    'active',
    'a0000001-0000-0000-0000-000000000002',
    NOW()
  ),
  (
    'b0000001-0000-0000-0000-000000000002',
    'SF-UM6P',
    'Startup Factory UM6P',
    'Programme d''incubation et d''accélération de startups deep-tech issues de la recherche académique et industrielle.',
    'active',
    'a0000001-0000-0000-0000-000000000002',
    NOW()
  )
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- 4. PROJECTS
-- ────────────────────────────────────────────────────────────

INSERT INTO public.projects (
  id, code, program_id, title, description, type, status,
  start_date, end_date, budget, completion_pct,
  chef_projet_id, is_structured, metadata,
  created_by, created_at, updated_at
) VALUES
  -- Hackathon IA & Données 2026
  (
    'c0000001-0000-0000-0000-000000000001',
    'IH-HACK-26',
    'b0000001-0000-0000-0000-000000000001',
    'Hackathon IA & Données 2026',
    'Compétition de 48h réunissant des étudiants et jeunes professionnels pour développer des solutions innovantes basées sur l''intelligence artificielle et les données ouvertes.',
    'hackathon', 'active',
    '2026-04-01', '2026-06-30',
    85000, 45,
    'a0000001-0000-0000-0000-000000000003',
    true,
    '{"confidentiality":"public_internal","participant_option":"form"}'::jsonb,
    'a0000001-0000-0000-0000-000000000001',
    '2026-03-20 09:00:00+00', '2026-03-20 09:00:00+00'
  ),
  -- Workshop Design Thinking
  (
    'c0000001-0000-0000-0000-000000000002',
    'IH-DT-26',
    'b0000001-0000-0000-0000-000000000001',
    'Workshop Design Thinking',
    'Atelier intensif d''une journée sur les méthodes de design thinking appliquées à l''innovation en entreprise. Ouvert aux porteurs de projets et équipes UM6P.',
    'workshop', 'active',
    '2026-05-01', '2026-05-31',
    25000, 70,
    'a0000001-0000-0000-0000-000000000003',
    true,
    '{"confidentiality":"public_internal","participant_option":"form"}'::jsonb,
    'a0000001-0000-0000-0000-000000000001',
    '2026-04-15 10:00:00+00', '2026-04-15 10:00:00+00'
  ),
  -- Bootcamp Entrepreneuriat S1
  (
    'c0000001-0000-0000-0000-000000000003',
    'SF-BOOT-26',
    'b0000001-0000-0000-0000-000000000002',
    'Bootcamp Entrepreneuriat S1 2026',
    'Programme intensif de 5 mois destiné aux porteurs de projets entrepreneuriaux. Sessions hebdomadaires animées par des coachs et entrepreneurs expérimentés.',
    'bootcamp', 'active',
    '2026-03-01', '2026-07-31',
    45000, 30,
    'a0000001-0000-0000-0000-000000000004',
    true,
    '{"confidentiality":"public_internal","participant_option":"import"}'::jsonb,
    'a0000001-0000-0000-0000-000000000001',
    '2026-02-20 11:00:00+00', '2026-02-20 11:00:00+00'
  ),
  -- Incubation Batch 3 — 2026
  (
    'c0000001-0000-0000-0000-000000000004',
    'SF-INC-26B3',
    'b0000001-0000-0000-0000-000000000002',
    'Incubation Batch 3 — 2026',
    'Troisième cohorte d''incubation de la Startup Factory UM6P. Programme d''accompagnement de 6 mois pour 8 à 12 startups sélectionnées, avec accès aux labos et au réseau industriel UM6P.',
    'incubation', 'draft',
    '2026-07-01', '2026-12-31',
    120000, 0,
    'a0000001-0000-0000-0000-000000000004',
    false,
    '{"confidentiality":"restricted","participant_option":"none"}'::jsonb,
    'a0000001-0000-0000-0000-000000000001',
    '2026-05-10 14:00:00+00', '2026-05-10 14:00:00+00'
  )
ON CONFLICT (id) DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- 5. PROJECT MEMBERS
-- ────────────────────────────────────────────────────────────

INSERT INTO public.project_members (
  id, project_id, profile_id, role, joined_at
) VALUES
  -- Hackathon IA & Données (c...-0001)
  ('d0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000003', 'responsible',  '2026-03-20 09:00:00+00'),
  ('d0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000005', 'membre',       '2026-03-20 09:00:00+00'),
  ('d0000001-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000006', 'membre',       '2026-03-20 09:00:00+00'),
  ('d0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000001', 'a0000001-0000-0000-0000-000000000008', 'membre',       '2026-03-20 09:00:00+00'),

  -- Workshop Design Thinking (c...-0002)
  ('d0000001-0000-0000-0000-000000000005', 'c0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000003', 'responsible',  '2026-04-15 10:00:00+00'),
  ('d0000001-0000-0000-0000-000000000006', 'c0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000005', 'membre',       '2026-04-15 10:00:00+00'),
  ('d0000001-0000-0000-0000-000000000007', 'c0000001-0000-0000-0000-000000000002', 'a0000001-0000-0000-0000-000000000008', 'membre',       '2026-04-15 10:00:00+00'),

  -- Bootcamp Entrepreneuriat (c...-0003)
  ('d0000001-0000-0000-0000-000000000008', 'c0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000004', 'responsible',  '2026-02-20 11:00:00+00'),
  ('d0000001-0000-0000-0000-000000000009', 'c0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000006', 'membre',       '2026-02-20 11:00:00+00'),
  ('d0000001-0000-0000-0000-000000000010', 'c0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000007', 'membre',       '2026-02-20 11:00:00+00'),
  ('d0000001-0000-0000-0000-000000000011', 'c0000001-0000-0000-0000-000000000003', 'a0000001-0000-0000-0000-000000000008', 'membre',       '2026-02-20 11:00:00+00'),

  -- Incubation Batch 3 (c...-0004)
  ('d0000001-0000-0000-0000-000000000012', 'c0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000004', 'responsible',  '2026-05-10 14:00:00+00'),
  ('d0000001-0000-0000-0000-000000000013', 'c0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000005', 'observateur',  '2026-05-10 14:00:00+00'),
  ('d0000001-0000-0000-0000-000000000014', 'c0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000007', 'membre',       '2026-05-10 14:00:00+00')
ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- 6. TASKS
-- ────────────────────────────────────────────────────────────

INSERT INTO public.tasks (
  id, project_id, title, description,
  status, priority, due_date,
  assigned_to,
  created_by, created_at, updated_at
) VALUES

  -- ── Hackathon IA & Données 2026 ──────────────────────────
  (
    'e0000001-0000-0000-0000-000000000001',
    'c0000001-0000-0000-0000-000000000001',
    'Définir la thématique et les défis du hackathon',
    'Identifier 3 défis clés autour de l''IA et des données, en collaboration avec les partenaires industriels.',
    'done', 'high', '2026-04-15',
    'a0000001-0000-0000-0000-000000000003',
    'a0000001-0000-0000-0000-000000000003',
    '2026-03-21 09:00:00+00', '2026-04-14 16:00:00+00'
  ),
  (
    'e0000001-0000-0000-0000-000000000002',
    'c0000001-0000-0000-0000-000000000001',
    'Contacter les sponsors et partenaires industriels',
    'Démarcher au moins 5 entreprises partenaires pour le sponsoring et la participation au jury.',
    'done', 'high', '2026-04-20',
    'a0000001-0000-0000-0000-000000000002',
    'a0000001-0000-0000-0000-000000000003',
    '2026-03-21 09:00:00+00', '2026-04-19 14:00:00+00'
  ),
  (
    'e0000001-0000-0000-0000-000000000003',
    'c0000001-0000-0000-0000-000000000001',
    'Préparer le kit de communication événementiel',
    'Créer visuels, flyers, posts réseaux sociaux et la page d''inscription pour le hackathon.',
    'in_progress', 'medium', '2026-05-30',
    'a0000001-0000-0000-0000-000000000005',
    'a0000001-0000-0000-0000-000000000003',
    '2026-04-01 09:00:00+00', '2026-05-10 11:00:00+00'
  ),
  (
    'e0000001-0000-0000-0000-000000000004',
    'c0000001-0000-0000-0000-000000000001',
    'Organiser la logistique salle et matériel technique',
    'Réserver la salle principale, prévoir le matériel informatique, la connectivité et la signalétique.',
    'in_progress', 'high', '2026-06-01',
    'a0000001-0000-0000-0000-000000000006',
    'a0000001-0000-0000-0000-000000000003',
    '2026-04-01 09:00:00+00', '2026-05-08 10:00:00+00'
  ),
  (
    'e0000001-0000-0000-0000-000000000005',
    'c0000001-0000-0000-0000-000000000001',
    'Recruter les mentors et constituer le jury',
    'Identifier et confirmer 8 mentors techniques et 5 membres du jury issus du monde académique et industriel.',
    'in_progress', 'high', '2026-05-25',
    'a0000001-0000-0000-0000-000000000003',
    'a0000001-0000-0000-0000-000000000003',
    '2026-04-05 09:00:00+00', '2026-05-15 17:00:00+00'
  ),
  (
    'e0000001-0000-0000-0000-000000000006',
    'c0000001-0000-0000-0000-000000000001',
    'Gérer les inscriptions et sélection des équipes',
    'Traiter les candidatures, former les équipes et confirmer les 30 participants retenus.',
    'todo', 'medium', '2026-06-10',
    'a0000001-0000-0000-0000-000000000008',
    'a0000001-0000-0000-0000-000000000003',
    '2026-04-10 09:00:00+00', '2026-04-10 09:00:00+00'
  ),

  -- ── Workshop Design Thinking ─────────────────────────────
  (
    'e0000001-0000-0000-0000-000000000007',
    'c0000001-0000-0000-0000-000000000002',
    'Concevoir le programme et le déroulé de la journée',
    'Structurer les blocs pédagogiques : empathie, définition, idéation, prototypage, test. Durée : 8h.',
    'done', 'high', '2026-05-05',
    'a0000001-0000-0000-0000-000000000003',
    'a0000001-0000-0000-0000-000000000003',
    '2026-04-15 10:00:00+00', '2026-05-04 16:00:00+00'
  ),
  (
    'e0000001-0000-0000-0000-000000000008',
    'c0000001-0000-0000-0000-000000000002',
    'Préparer les supports visuels et outils pédagogiques',
    'Créer les slides, les canvas empathie/persona, les gabarits de prototypage et les guides de facilitation.',
    'done', 'medium', '2026-05-08',
    'a0000001-0000-0000-0000-000000000005',
    'a0000001-0000-0000-0000-000000000003',
    '2026-04-15 10:00:00+00', '2026-05-07 15:00:00+00'
  ),
  (
    'e0000001-0000-0000-0000-000000000009',
    'c0000001-0000-0000-0000-000000000002',
    'Confirmer les facilitateurs experts design thinking',
    'Valider la participation de 2 facilitateurs certifiés et préparer leur brief d''intervention.',
    'done', 'high', '2026-05-10',
    'a0000001-0000-0000-0000-000000000003',
    'a0000001-0000-0000-0000-000000000003',
    '2026-04-20 09:00:00+00', '2026-05-09 18:00:00+00'
  ),
  (
    'e0000001-0000-0000-0000-000000000010',
    'c0000001-0000-0000-0000-000000000002',
    'Lancer la campagne de communication et inscriptions',
    'Publier l''événement sur les réseaux, envoyer les invitations par email et ouvrir les inscriptions en ligne.',
    'in_progress', 'medium', '2026-05-20',
    'a0000001-0000-0000-0000-000000000005',
    'a0000001-0000-0000-0000-000000000003',
    '2026-04-25 09:00:00+00', '2026-05-12 10:00:00+00'
  ),
  (
    'e0000001-0000-0000-0000-000000000011',
    'c0000001-0000-0000-0000-000000000002',
    'Préparer l''espace créativité et la scénographie',
    'Aménager la salle en îlots créatifs, installer le matériel (post-its, paperboards, feutres, LEGO Serious Play).',
    'in_progress', 'medium', '2026-05-25',
    'a0000001-0000-0000-0000-000000000006',
    'a0000001-0000-0000-0000-000000000003',
    '2026-05-01 09:00:00+00', '2026-05-16 14:00:00+00'
  ),

  -- ── Bootcamp Entrepreneuriat S1 ──────────────────────────
  (
    'e0000001-0000-0000-0000-000000000012',
    'c0000001-0000-0000-0000-000000000003',
    'Définir le curriculum pédagogique du bootcamp',
    'Élaborer les modules thématiques : idéation, lean startup, pitch, finance, legal, go-to-market.',
    'done', 'high', '2026-03-15',
    'a0000001-0000-0000-0000-000000000004',
    'a0000001-0000-0000-0000-000000000004',
    '2026-02-21 09:00:00+00', '2026-03-14 17:00:00+00'
  ),
  (
    'e0000001-0000-0000-0000-000000000013',
    'c0000001-0000-0000-0000-000000000003',
    'Sélectionner et contractualiser les coachs et intervenants',
    'Identifier 6 coachs spécialisés (tech, business, finance, juridique) et signer les conventions.',
    'in_progress', 'high', '2026-05-31',
    'a0000001-0000-0000-0000-000000000004',
    'a0000001-0000-0000-0000-000000000004',
    '2026-03-01 09:00:00+00', '2026-05-10 11:00:00+00'
  ),
  (
    'e0000001-0000-0000-0000-000000000014',
    'c0000001-0000-0000-0000-000000000003',
    'Établir le planning détaillé des sessions',
    'Planifier toutes les sessions hebdomadaires, les ateliers pratiques et les sessions de pitch intermédiaires.',
    'in_progress', 'medium', '2026-06-15',
    'a0000001-0000-0000-0000-000000000008',
    'a0000001-0000-0000-0000-000000000004',
    '2026-03-10 09:00:00+00', '2026-05-05 09:00:00+00'
  ),
  (
    'e0000001-0000-0000-0000-000000000015',
    'c0000001-0000-0000-0000-000000000003',
    'Préparer les espaces de formation et équipements',
    'Réserver les salles, configurer les outils numériques (Notion workspace, Google Meet, Miro).',
    'todo', 'medium', '2026-06-20',
    'a0000001-0000-0000-0000-000000000006',
    'a0000001-0000-0000-0000-000000000004',
    '2026-03-15 09:00:00+00', '2026-03-15 09:00:00+00'
  ),
  (
    'e0000001-0000-0000-0000-000000000016',
    'c0000001-0000-0000-0000-000000000003',
    'Gérer le budget et les conventions financières',
    'Préparer les bons de commande, suivre les dépenses vs budget et rédiger les conventions avec les intervenants.',
    'todo', 'high', '2026-06-30',
    'a0000001-0000-0000-0000-000000000007',
    'a0000001-0000-0000-0000-000000000004',
    '2026-03-15 09:00:00+00', '2026-03-15 09:00:00+00'
  ),

  -- ── Incubation Batch 3 — 2026 ───────────────────────────
  (
    'e0000001-0000-0000-0000-000000000017',
    'c0000001-0000-0000-0000-000000000004',
    'Définir les critères de sélection des startups',
    'Élaborer la grille d''évaluation : maturité technologique, taille marché, équipe, traction.',
    'todo', 'high', '2026-07-15',
    'a0000001-0000-0000-0000-000000000004',
    'a0000001-0000-0000-0000-000000000004',
    '2026-05-10 14:00:00+00', '2026-05-10 14:00:00+00'
  ),
  (
    'e0000001-0000-0000-0000-000000000018',
    'c0000001-0000-0000-0000-000000000004',
    'Préparer et diffuser l''appel à candidatures',
    'Rédiger le dossier de candidature, créer la landing page et lancer la campagne de communication.',
    'todo', 'high', '2026-07-20',
    'a0000001-0000-0000-0000-000000000005',
    'a0000001-0000-0000-0000-000000000004',
    '2026-05-10 14:00:00+00', '2026-05-10 14:00:00+00'
  ),
  (
    'e0000001-0000-0000-0000-000000000019',
    'c0000001-0000-0000-0000-000000000004',
    'Concevoir le programme d''accompagnement 6 mois',
    'Définir les jalons, les livrables attendus et les critères de progression pour chaque startup.',
    'todo', 'medium', '2026-07-31',
    'a0000001-0000-0000-0000-000000000004',
    'a0000001-0000-0000-0000-000000000004',
    '2026-05-10 14:00:00+00', '2026-05-10 14:00:00+00'
  ),
  (
    'e0000001-0000-0000-0000-000000000020',
    'c0000001-0000-0000-0000-000000000004',
    'Identifier et solliciter les mentors industriels',
    'Constituer un pool de 15 mentors issus du réseau UM6P, OCP, et startups marocaines.',
    'todo', 'medium', '2026-08-15',
    'a0000001-0000-0000-0000-000000000002',
    'a0000001-0000-0000-0000-000000000004',
    '2026-05-10 14:00:00+00', '2026-05-10 14:00:00+00'
  )
ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- 7. EXPENSES
-- ────────────────────────────────────────────────────────────

INSERT INTO public.expenses (
  id, project_id, title, amount, category, status,
  expense_date, submitted_by, approved_by,
  created_at, updated_at
) VALUES

  -- ── Hackathon IA & Données 2026 ──────────────────────────
  ('f0000001-0000-0000-0000-000000000001', 'c0000001-0000-0000-0000-000000000001',
   'Location salle et équipements événementiels',
   15000, 'equipment', 'approved', '2026-04-10',
   'a0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000002',
   '2026-04-10 14:00:00+00', '2026-04-12 10:00:00+00'),

  ('f0000001-0000-0000-0000-000000000002', 'c0000001-0000-0000-0000-000000000001',
   'Transport participants Casablanca–Benguerir (aller-retour)',
   8500, 'transport', 'approved', '2026-04-20',
   'a0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000002',
   '2026-04-20 11:00:00+00', '2026-04-22 09:00:00+00'),

  ('f0000001-0000-0000-0000-000000000003', 'c0000001-0000-0000-0000-000000000001',
   'Restauration équipe et participants hackathon (2 jours)',
   12000, 'other', 'pending', '2026-05-15',
   'a0000001-0000-0000-0000-000000000006', NULL,
   '2026-05-15 10:00:00+00', '2026-05-15 10:00:00+00'),

  ('f0000001-0000-0000-0000-000000000004', 'c0000001-0000-0000-0000-000000000001',
   'Kit participants (carnet, stylos, t-shirt, sac)',
   9500, 'equipment', 'pending', '2026-05-16',
   'a0000001-0000-0000-0000-000000000005', NULL,
   '2026-05-16 09:00:00+00', '2026-05-16 09:00:00+00'),

  -- ── Workshop Design Thinking ─────────────────────────────
  ('f0000001-0000-0000-0000-000000000005', 'c0000001-0000-0000-0000-000000000002',
   'Fournitures créativité (post-its, feutres, paperboards)',
   2800, 'equipment', 'approved', '2026-05-02',
   'a0000001-0000-0000-0000-000000000005', 'a0000001-0000-0000-0000-000000000002',
   '2026-05-02 11:00:00+00', '2026-05-04 09:00:00+00'),

  ('f0000001-0000-0000-0000-000000000006', 'c0000001-0000-0000-0000-000000000002',
   'Pause-café et déjeuner participants workshop',
   3500, 'other', 'approved', '2026-05-10',
   'a0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000002',
   '2026-05-10 12:00:00+00', '2026-05-11 14:00:00+00'),

  ('f0000001-0000-0000-0000-000000000007', 'c0000001-0000-0000-0000-000000000002',
   'Communication sponsorisée réseaux sociaux',
   1800, 'other', 'pending', '2026-05-12',
   'a0000001-0000-0000-0000-000000000005', NULL,
   '2026-05-12 10:00:00+00', '2026-05-12 10:00:00+00'),

  -- ── Bootcamp Entrepreneuriat S1 ──────────────────────────
  ('f0000001-0000-0000-0000-000000000008', 'c0000001-0000-0000-0000-000000000003',
   'Honoraires coachs et intervenants externes',
   18000, 'other', 'approved', '2026-03-05',
   'a0000001-0000-0000-0000-000000000004', 'a0000001-0000-0000-0000-000000000002',
   '2026-03-05 09:00:00+00', '2026-03-07 10:00:00+00'),

  ('f0000001-0000-0000-0000-000000000009', 'c0000001-0000-0000-0000-000000000003',
   'Hébergement participants venant de hors région',
   12000, 'accommodation', 'pending', '2026-04-01',
   'a0000001-0000-0000-0000-000000000006', NULL,
   '2026-04-01 10:00:00+00', '2026-04-01 10:00:00+00'),

  ('f0000001-0000-0000-0000-000000000010', 'c0000001-0000-0000-0000-000000000003',
   'Transport Rabat–Benguerir intervenants (2 déplacements)',
   4500, 'transport', 'approved', '2026-03-15',
   'a0000001-0000-0000-0000-000000000006', 'a0000001-0000-0000-0000-000000000002',
   '2026-03-15 14:00:00+00', '2026-03-16 11:00:00+00'),

  ('f0000001-0000-0000-0000-000000000011', 'c0000001-0000-0000-0000-000000000003',
   'Matériel pédagogique et impression supports',
   3200, 'equipment', 'rejected', '2026-04-10',
   'a0000001-0000-0000-0000-000000000007', 'a0000001-0000-0000-0000-000000000002',
   '2026-04-10 10:00:00+00', '2026-04-12 09:00:00+00'),

  -- ── Incubation Batch 3 — 2026 ───────────────────────────
  ('f0000001-0000-0000-0000-000000000012', 'c0000001-0000-0000-0000-000000000004',
   'Abonnements outils SaaS équipe (Notion, Figma, Slack)',
   8500, 'other', 'pending', '2026-05-12',
   'a0000001-0000-0000-0000-000000000004', NULL,
   '2026-05-12 11:00:00+00', '2026-05-12 11:00:00+00'),

  ('f0000001-0000-0000-0000-000000000013', 'c0000001-0000-0000-0000-000000000004',
   'Conception supports et identité visuelle programme',
   5000, 'other', 'pending', '2026-05-13',
   'a0000001-0000-0000-0000-000000000005', NULL,
   '2026-05-13 09:00:00+00', '2026-05-13 09:00:00+00'),

  ('f0000001-0000-0000-0000-000000000014', 'c0000001-0000-0000-0000-000000000004',
   'Déplacements mentors (sessions de kick-off)',
   3000, 'transport', 'pending', '2026-05-14',
   'a0000001-0000-0000-0000-000000000007', NULL,
   '2026-05-14 10:00:00+00', '2026-05-14 10:00:00+00')

ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- 8. POPS
-- ────────────────────────────────────────────────────────────

INSERT INTO public.pops (
  id, author_id, project_id, content, created_at, updated_at
) VALUES
  (
    'a0000009-0000-0000-0000-000000000001',
    'a0000001-0000-0000-0000-000000000001',
    NULL,
    'Bienvenue sur Jet Pops, la plateforme de gestion de projets du I&E Lab ! La plateforme est maintenant opérationnelle pour toute l''équipe. N''hésitez pas à explorer vos projets et à partager vos avancées ici.',
    '2026-03-15 09:00:00+00', '2026-03-15 09:00:00+00'
  ),
  (
    'a0000009-0000-0000-0000-000000000002',
    'a0000001-0000-0000-0000-000000000002',
    'c0000001-0000-0000-0000-000000000001',
    'Le Hackathon IA & Données 2026 est officiellement lancé ! Nous avons déjà confirmé 3 partenaires industriels majeurs comme sponsors. Merci à toute l''équipe pour la préparation rapide. Objectif : 80 participants sur 2 jours !',
    '2026-04-01 10:00:00+00', '2026-04-01 10:00:00+00'
  ),
  (
    'a0000009-0000-0000-0000-000000000003',
    'a0000001-0000-0000-0000-000000000003',
    'c0000001-0000-0000-0000-000000000002',
    'Workshop Design Thinking — 12 nouvelles inscriptions cette semaine ! On approche des 30 participants, ce qui est exactement notre cible. Les facilitateurs sont confirmés, les supports sont prêts. Dernière ligne droite !',
    '2026-04-28 11:00:00+00', '2026-04-28 11:00:00+00'
  ),
  (
    'a0000009-0000-0000-0000-000000000004',
    'a0000001-0000-0000-0000-000000000005',
    'c0000001-0000-0000-0000-000000000001',
    'Le kit de communication du Hackathon est en cours de finalisation ! Visuels LinkedIn, flyers PDF et page d''inscription en cours. On devrait être prêts à lancer la comm cette semaine.',
    '2026-05-02 09:30:00+00', '2026-05-02 09:30:00+00'
  ),
  (
    'a0000009-0000-0000-0000-000000000005',
    'a0000001-0000-0000-0000-000000000004',
    'c0000001-0000-0000-0000-000000000003',
    'Premier kick-off du Bootcamp Entrepreneuriat S1 ce matin avec 18 porteurs de projets ! Énergie incroyable dans la salle. Les participants viennent de 6 villes différentes. Beau départ pour cette nouvelle cohorte !',
    '2026-05-05 12:00:00+00', '2026-05-05 12:00:00+00'
  ),
  (
    'a0000009-0000-0000-0000-000000000006',
    'a0000001-0000-0000-0000-000000000008',
    NULL,
    'Petit rappel : si vous connaissez des porteurs de projets ou startups deep-tech intéressés par l''Incubation Batch 3, partagez l''info ! L''appel à candidatures ouvrira en juillet. Le réseau c''est notre force.',
    '2026-05-10 14:00:00+00', '2026-05-10 14:00:00+00'
  ),
  (
    'a0000009-0000-0000-0000-000000000007',
    'a0000001-0000-0000-0000-000000000007',
    'c0000001-0000-0000-0000-000000000003',
    'Rapport budgétaire S1 Bootcamp disponible : taux d''engagement budget à 42% à mi-parcours. Bonne maîtrise des dépenses ! Les honoraires des intervenants sont les principaux postes. Rapport complet partagé sur la plateforme.',
    '2026-05-14 16:00:00+00', '2026-05-14 16:00:00+00'
  ),
  (
    'a0000009-0000-0000-0000-000000000008',
    'a0000001-0000-0000-0000-000000000006',
    'c0000001-0000-0000-0000-000000000002',
    'Logistique Workshop Design Thinking OK ! Salle réservée, matériel commandé, traiteur confirmé. Plus qu''à accueillir les participants la semaine prochaine. Merci Sara et Nadia pour la coordination au top !',
    '2026-05-15 10:30:00+00', '2026-05-15 10:30:00+00'
  )
ON CONFLICT DO NOTHING;


-- ────────────────────────────────────────────────────────────
-- VÉRIFICATION (commentaires indicatifs)
-- ────────────────────────────────────────────────────────────
-- SELECT COUNT(*) FROM auth.users WHERE email LIKE '%@um6p.ma';         -- 8
-- SELECT COUNT(*) FROM public.profiles;                                  -- 8
-- SELECT COUNT(*) FROM public.programs;                                  -- 2
-- SELECT COUNT(*) FROM public.projects;                                  -- 4
-- SELECT COUNT(*) FROM public.project_members;                           -- 14
-- SELECT COUNT(*) FROM public.tasks;                                     -- 20
-- SELECT COUNT(*) FROM public.expenses;                                  -- 14
-- SELECT COUNT(*) FROM public.pops;                                      -- 8

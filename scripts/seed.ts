/**
 * Script de seed demo — Jet Pops / I&E Lab UM6P
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Pré-requis:
 *   NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY dans .env.local
 *   npx tsx ou ts-node installé (npm i -D tsx)
 */

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import * as path from 'path'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY requis dans .env.local')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

const PASSWORD = 'DemoPass2026!'

// ────────────────────────────────────────────────────────────
// UUIDs
// ────────────────────────────────────────────────────────────

const USERS = {
  yasmine: 'a0000001-0000-0000-0000-000000000001',
  karim:   'a0000001-0000-0000-0000-000000000002',
  nadia:   'a0000001-0000-0000-0000-000000000003',
  mehdi:   'a0000001-0000-0000-0000-000000000004',
  sara:    'a0000001-0000-0000-0000-000000000005',
  youssef: 'a0000001-0000-0000-0000-000000000006',
  imane:   'a0000001-0000-0000-0000-000000000007',
  omar:    'a0000001-0000-0000-0000-000000000008',
}

const PROGRAMS = {
  innovationHub:   'b0000001-0000-0000-0000-000000000001',
  startupFactory:  'b0000001-0000-0000-0000-000000000002',
}

const PROJECTS = {
  hackathon:  'c0000001-0000-0000-0000-000000000001',
  workshop:   'c0000001-0000-0000-0000-000000000002',
  bootcamp:   'c0000001-0000-0000-0000-000000000003',
  incubation: 'c0000001-0000-0000-0000-000000000004',
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function ok(label: string, error: unknown) {
  if (error) {
    console.error(`  ✗ ${label}:`, (error as any).message ?? error)
    return false
  }
  console.log(`  ✓ ${label}`)
  return true
}

async function upsertUser(id: string, email: string, fullName: string) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  })
  if (error && error.message?.includes('already been registered')) {
    ok(`auth.user ${email} (already exists)`, null)
    return
  }
  // If creation succeeded but with wrong id, we can't easily fix it here —
  // the SQL seed is the authoritative source for deterministic UUIDs.
  ok(`auth.user ${email}`, error)
}

// ────────────────────────────────────────────────────────────
// Seed functions
// ────────────────────────────────────────────────────────────

async function seedUsers() {
  console.log('\n[1/8] Auth users…')
  await upsertUser(USERS.yasmine, 'yasmine.benali@um6p.ma',  'Yasmine Benali')
  await upsertUser(USERS.karim,   'karim.alaoui@um6p.ma',   'Karim Alaoui')
  await upsertUser(USERS.nadia,   'nadia.elfassi@um6p.ma',  'Nadia El Fassi')
  await upsertUser(USERS.mehdi,   'mehdi.chraibi@um6p.ma',  'Mehdi Chraibi')
  await upsertUser(USERS.sara,    'sara.idrissi@um6p.ma',   'Sara Idrissi')
  await upsertUser(USERS.youssef, 'youssef.tazi@um6p.ma',   'Youssef Tazi')
  await upsertUser(USERS.imane,   'imane.bouhali@um6p.ma',  'Imane Bouhali')
  await upsertUser(USERS.omar,    'omar.benjelloun@um6p.ma', 'Omar Benjelloun')
}

async function seedProfiles() {
  console.log('\n[2/8] Profiles…')
  const rows = [
    {
      id: USERS.yasmine, full_name: 'Yasmine Benali', email: 'yasmine.benali@um6p.ma',
      role: 'admin',
      bio: 'Responsable de la plateforme Jet Pops, coordination des équipes I&E Lab.',
      skills: ['platform management','data analysis','reporting','coordination'],
      languages: ['Français','Arabe','Anglais'],
      onboarding_completed: true,
    },
    {
      id: USERS.karim, full_name: 'Karim Alaoui', email: 'karim.alaoui@um6p.ma',
      role: 'directeur',
      bio: 'Directeur du laboratoire I&E, 12 ans d\'expérience en innovation et développement de startups.',
      skills: ['strategic planning','entrepreneurship','incubation','fundraising','leadership'],
      languages: ['Français','Anglais','Arabe'],
      onboarding_completed: true,
    },
    {
      id: USERS.nadia, full_name: 'Nadia El Fassi', email: 'nadia.elfassi@um6p.ma',
      role: 'chef_projet',
      bio: 'Gestion de workshops et hackathons depuis 5 ans, spécialiste en coordination événementielle.',
      skills: ['project management','event coordination','logistics','communication','facilitation'],
      languages: ['Français','Arabe'],
      onboarding_completed: true,
    },
    {
      id: USERS.mehdi, full_name: 'Mehdi Chraibi', email: 'mehdi.chraibi@um6p.ma',
      role: 'chef_projet',
      bio: 'Accompagnement de startups early-stage, expert en méthodologies agiles et design thinking.',
      skills: ['incubation','startup coaching','design thinking','entrepreneurship','agile'],
      languages: ['Français','Anglais'],
      onboarding_completed: true,
    },
    {
      id: USERS.sara, full_name: 'Sara Idrissi', email: 'sara.idrissi@um6p.ma',
      role: 'membre',
      bio: 'Communication digitale et création de contenu pour l\'écosystème startup UM6P.',
      skills: ['communication','social media','design','content creation','branding'],
      languages: ['Français','Arabe','Anglais'],
      onboarding_completed: true,
    },
    {
      id: USERS.youssef, full_name: 'Youssef Tazi', email: 'youssef.tazi@um6p.ma',
      role: 'membre',
      bio: 'Logistique événementielle et gestion des fournisseurs pour les événements I&E Lab.',
      skills: ['logistics','event coordination','supplier management','budgeting','operations'],
      languages: ['Français','Arabe'],
      onboarding_completed: true,
    },
    {
      id: USERS.imane, full_name: 'Imane Bouhali', email: 'imane.bouhali@um6p.ma',
      role: 'membre',
      bio: 'Suivi budgétaire des projets et reporting financier auprès de la direction.',
      skills: ['finance','reporting','Excel','data analysis','budgeting','accounting'],
      languages: ['Français','Anglais'],
      onboarding_completed: true,
    },
    {
      id: USERS.omar, full_name: 'Omar Benjelloun', email: 'omar.benjelloun@um6p.ma',
      role: 'membre',
      bio: 'Animation de la communauté entrepreneuriale et coaching des porteurs de projets.',
      skills: ['entrepreneurship','coaching','event coordination','networking','community management'],
      languages: ['Français','Arabe','Anglais'],
      onboarding_completed: true,
    },
  ]
  const { error } = await supabase.from('profiles').upsert(rows, { onConflict: 'id' })
  ok('profiles (8)', error)
}

async function seedPrograms() {
  console.log('\n[3/8] Programs…')
  const { error } = await supabase.from('programs').upsert([
    {
      id: PROGRAMS.innovationHub,
      code: 'IH-2026',
      name: 'Innovation Hub 2026',
      description: 'Programme annuel de soutien à l\'innovation technologique et entrepreneuriale au sein de l\'écosystème UM6P.',
      color: '#3B82F6',
      status: 'active',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      created_by: USERS.karim,
    },
    {
      id: PROGRAMS.startupFactory,
      code: 'SF-UM6P',
      name: 'Startup Factory UM6P',
      description: 'Programme d\'incubation et d\'accélération de startups deep-tech issues de la recherche académique et industrielle.',
      color: '#8B5CF6',
      status: 'active',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      created_by: USERS.karim,
    },
  ], { onConflict: 'id' })
  ok('programs (2)', error)
}

async function seedProjects() {
  console.log('\n[4/8] Projects…')
  const { error } = await supabase.from('projects').upsert([
    {
      id: PROJECTS.hackathon,
      code: 'IH-HACK-26',
      program_id: PROGRAMS.innovationHub,
      title: 'Hackathon IA & Données 2026',
      description: 'Compétition de 48h réunissant des étudiants et jeunes professionnels pour développer des solutions innovantes basées sur l\'IA et les données ouvertes.',
      type: 'hackathon',
      status: 'active',
      start_date: '2026-04-01',
      end_date: '2026-06-30',
      budget: 85000,
      completion_pct: 45,
      chef_projet_id: USERS.nadia,
      is_structured: true,
      metadata: { confidentiality: 'public_internal', participant_option: 'form' },
      created_by: USERS.yasmine,
    },
    {
      id: PROJECTS.workshop,
      code: 'IH-DT-26',
      program_id: PROGRAMS.innovationHub,
      title: 'Workshop Design Thinking',
      description: 'Atelier intensif d\'une journée sur les méthodes de design thinking appliquées à l\'innovation. Ouvert aux porteurs de projets et équipes UM6P.',
      type: 'workshop',
      status: 'active',
      start_date: '2026-05-01',
      end_date: '2026-05-31',
      budget: 25000,
      completion_pct: 70,
      chef_projet_id: USERS.nadia,
      is_structured: true,
      metadata: { confidentiality: 'public_internal', participant_option: 'form' },
      created_by: USERS.yasmine,
    },
    {
      id: PROJECTS.bootcamp,
      code: 'SF-BOOT-26',
      program_id: PROGRAMS.startupFactory,
      title: 'Bootcamp Entrepreneuriat S1 2026',
      description: 'Programme intensif de 5 mois destiné aux porteurs de projets entrepreneuriaux. Sessions hebdomadaires animées par des coachs et entrepreneurs expérimentés.',
      type: 'bootcamp',
      status: 'active',
      start_date: '2026-03-01',
      end_date: '2026-07-31',
      budget: 45000,
      completion_pct: 30,
      chef_projet_id: USERS.mehdi,
      is_structured: true,
      metadata: { confidentiality: 'public_internal', participant_option: 'import' },
      created_by: USERS.yasmine,
    },
    {
      id: PROJECTS.incubation,
      code: 'SF-INC-26B3',
      program_id: PROGRAMS.startupFactory,
      title: 'Incubation Batch 3 — 2026',
      description: 'Troisième cohorte d\'incubation de la Startup Factory UM6P. Programme d\'accompagnement de 6 mois pour 8 à 12 startups sélectionnées.',
      type: 'incubation',
      status: 'draft',
      start_date: '2026-07-01',
      end_date: '2026-12-31',
      budget: 120000,
      completion_pct: 0,
      chef_projet_id: USERS.mehdi,
      is_structured: false,
      metadata: { confidentiality: 'restricted', participant_option: 'none' },
      created_by: USERS.yasmine,
    },
  ], { onConflict: 'id' })
  ok('projects (4)', error)
}

async function seedMembers() {
  console.log('\n[5/8] Project members…')
  const rows = [
    // Hackathon
    { id: 'd0000001-0000-0000-0000-000000000001', project_id: PROJECTS.hackathon,  profile_id: USERS.nadia,   role: 'responsible', joined_at: '2026-03-20T09:00:00Z' },
    { id: 'd0000001-0000-0000-0000-000000000002', project_id: PROJECTS.hackathon,  profile_id: USERS.sara,    role: 'membre',      joined_at: '2026-03-20T09:00:00Z' },
    { id: 'd0000001-0000-0000-0000-000000000003', project_id: PROJECTS.hackathon,  profile_id: USERS.youssef, role: 'membre',      joined_at: '2026-03-20T09:00:00Z' },
    { id: 'd0000001-0000-0000-0000-000000000004', project_id: PROJECTS.hackathon,  profile_id: USERS.omar,    role: 'membre',      joined_at: '2026-03-20T09:00:00Z' },
    // Workshop
    { id: 'd0000001-0000-0000-0000-000000000005', project_id: PROJECTS.workshop,   profile_id: USERS.nadia,   role: 'responsible', joined_at: '2026-04-15T10:00:00Z' },
    { id: 'd0000001-0000-0000-0000-000000000006', project_id: PROJECTS.workshop,   profile_id: USERS.sara,    role: 'membre',      joined_at: '2026-04-15T10:00:00Z' },
    { id: 'd0000001-0000-0000-0000-000000000007', project_id: PROJECTS.workshop,   profile_id: USERS.omar,    role: 'membre',      joined_at: '2026-04-15T10:00:00Z' },
    // Bootcamp
    { id: 'd0000001-0000-0000-0000-000000000008', project_id: PROJECTS.bootcamp,   profile_id: USERS.mehdi,   role: 'responsible', joined_at: '2026-02-20T11:00:00Z' },
    { id: 'd0000001-0000-0000-0000-000000000009', project_id: PROJECTS.bootcamp,   profile_id: USERS.youssef, role: 'membre',      joined_at: '2026-02-20T11:00:00Z' },
    { id: 'd0000001-0000-0000-0000-000000000010', project_id: PROJECTS.bootcamp,   profile_id: USERS.imane,   role: 'membre',      joined_at: '2026-02-20T11:00:00Z' },
    { id: 'd0000001-0000-0000-0000-000000000011', project_id: PROJECTS.bootcamp,   profile_id: USERS.omar,    role: 'membre',      joined_at: '2026-02-20T11:00:00Z' },
    // Incubation
    { id: 'd0000001-0000-0000-0000-000000000012', project_id: PROJECTS.incubation, profile_id: USERS.mehdi,   role: 'responsible', joined_at: '2026-05-10T14:00:00Z' },
    { id: 'd0000001-0000-0000-0000-000000000013', project_id: PROJECTS.incubation, profile_id: USERS.sara,    role: 'observateur', joined_at: '2026-05-10T14:00:00Z' },
    { id: 'd0000001-0000-0000-0000-000000000014', project_id: PROJECTS.incubation, profile_id: USERS.imane,   role: 'membre',      joined_at: '2026-05-10T14:00:00Z' },
  ]
  const { error } = await supabase.from('project_members').upsert(rows, { onConflict: 'id' })
  ok('project_members (14)', error)
}

async function seedTasks() {
  console.log('\n[6/8] Tasks…')
  const rows = [
    // ── Hackathon
    { id: 'e0000001-0000-0000-0000-000000000001', project_id: PROJECTS.hackathon, title: 'Définir la thématique et les défis du hackathon', status: 'done',        priority: 'high',   due_date: '2026-04-15', assigned_to: USERS.nadia,   sort_order: 1, created_by: USERS.nadia   },
    { id: 'e0000001-0000-0000-0000-000000000002', project_id: PROJECTS.hackathon, title: 'Contacter les sponsors et partenaires industriels', status: 'done',        priority: 'high',   due_date: '2026-04-20', assigned_to: USERS.karim,   sort_order: 2, created_by: USERS.nadia   },
    { id: 'e0000001-0000-0000-0000-000000000003', project_id: PROJECTS.hackathon, title: 'Préparer le kit de communication événementiel',    status: 'in_progress', priority: 'medium', due_date: '2026-05-30', assigned_to: USERS.sara,    sort_order: 3, created_by: USERS.nadia   },
    { id: 'e0000001-0000-0000-0000-000000000004', project_id: PROJECTS.hackathon, title: 'Organiser la logistique salle et matériel',        status: 'in_progress', priority: 'high',   due_date: '2026-06-01', assigned_to: USERS.youssef, sort_order: 4, created_by: USERS.nadia   },
    { id: 'e0000001-0000-0000-0000-000000000005', project_id: PROJECTS.hackathon, title: 'Recruter les mentors et constituer le jury',        status: 'review',      priority: 'urgent', due_date: '2026-05-25', assigned_to: USERS.nadia,   sort_order: 5, created_by: USERS.nadia   },
    { id: 'e0000001-0000-0000-0000-000000000006', project_id: PROJECTS.hackathon, title: 'Gérer les inscriptions et sélection des équipes',   status: 'todo',        priority: 'medium', due_date: '2026-06-10', assigned_to: USERS.omar,    sort_order: 6, created_by: USERS.nadia   },
    // ── Workshop
    { id: 'e0000001-0000-0000-0000-000000000007', project_id: PROJECTS.workshop,  title: 'Concevoir le programme et le déroulé de la journée',   status: 'done',        priority: 'high',   due_date: '2026-05-05', assigned_to: USERS.nadia,   sort_order: 1, created_by: USERS.nadia   },
    { id: 'e0000001-0000-0000-0000-000000000008', project_id: PROJECTS.workshop,  title: 'Préparer les supports visuels et outils pédagogiques', status: 'done',        priority: 'medium', due_date: '2026-05-08', assigned_to: USERS.sara,    sort_order: 2, created_by: USERS.nadia   },
    { id: 'e0000001-0000-0000-0000-000000000009', project_id: PROJECTS.workshop,  title: 'Confirmer les facilitateurs experts design thinking',   status: 'done',        priority: 'high',   due_date: '2026-05-10', assigned_to: USERS.nadia,   sort_order: 3, created_by: USERS.nadia   },
    { id: 'e0000001-0000-0000-0000-000000000010', project_id: PROJECTS.workshop,  title: 'Lancer la campagne de communication et inscriptions',   status: 'in_progress', priority: 'medium', due_date: '2026-05-20', assigned_to: USERS.sara,    sort_order: 4, created_by: USERS.nadia   },
    { id: 'e0000001-0000-0000-0000-000000000011', project_id: PROJECTS.workshop,  title: 'Préparer l\'espace créativité et la scénographie',      status: 'review',      priority: 'medium', due_date: '2026-05-25', assigned_to: USERS.youssef, sort_order: 5, created_by: USERS.nadia   },
    // ── Bootcamp
    { id: 'e0000001-0000-0000-0000-000000000012', project_id: PROJECTS.bootcamp,  title: 'Définir le curriculum pédagogique du bootcamp',              status: 'done',        priority: 'high',   due_date: '2026-03-15', assigned_to: USERS.mehdi,   sort_order: 1, created_by: USERS.mehdi   },
    { id: 'e0000001-0000-0000-0000-000000000013', project_id: PROJECTS.bootcamp,  title: 'Sélectionner et contractualiser les coachs et intervenants', status: 'in_progress', priority: 'high',   due_date: '2026-05-31', assigned_to: USERS.mehdi,   sort_order: 2, created_by: USERS.mehdi   },
    { id: 'e0000001-0000-0000-0000-000000000014', project_id: PROJECTS.bootcamp,  title: 'Établir le planning détaillé des sessions',                  status: 'in_progress', priority: 'medium', due_date: '2026-06-15', assigned_to: USERS.omar,    sort_order: 3, created_by: USERS.mehdi   },
    { id: 'e0000001-0000-0000-0000-000000000015', project_id: PROJECTS.bootcamp,  title: 'Préparer les espaces de formation et équipements',           status: 'todo',        priority: 'medium', due_date: '2026-06-20', assigned_to: USERS.youssef, sort_order: 4, created_by: USERS.mehdi   },
    { id: 'e0000001-0000-0000-0000-000000000016', project_id: PROJECTS.bootcamp,  title: 'Gérer le budget et les conventions financières',              status: 'todo',        priority: 'urgent', due_date: '2026-06-30', assigned_to: USERS.imane,   sort_order: 5, created_by: USERS.mehdi   },
    // ── Incubation
    { id: 'e0000001-0000-0000-0000-000000000017', project_id: PROJECTS.incubation, title: 'Définir les critères de sélection des startups',    status: 'todo', priority: 'high',   due_date: '2026-07-15', assigned_to: USERS.mehdi, sort_order: 1, created_by: USERS.mehdi },
    { id: 'e0000001-0000-0000-0000-000000000018', project_id: PROJECTS.incubation, title: 'Préparer et diffuser l\'appel à candidatures',       status: 'todo', priority: 'high',   due_date: '2026-07-20', assigned_to: USERS.sara,  sort_order: 2, created_by: USERS.mehdi },
    { id: 'e0000001-0000-0000-0000-000000000019', project_id: PROJECTS.incubation, title: 'Concevoir le programme d\'accompagnement 6 mois',    status: 'todo', priority: 'medium', due_date: '2026-07-31', assigned_to: USERS.mehdi, sort_order: 3, created_by: USERS.mehdi },
    { id: 'e0000001-0000-0000-0000-000000000020', project_id: PROJECTS.incubation, title: 'Identifier et solliciter les mentors industriels',    status: 'todo', priority: 'medium', due_date: '2026-08-15', assigned_to: USERS.karim, sort_order: 4, created_by: USERS.mehdi },
  ]
  const { error } = await supabase.from('tasks').upsert(rows, { onConflict: 'id' })
  ok('tasks (20)', error)
}

async function seedExpenses() {
  console.log('\n[7/8] Expenses…')
  const rows = [
    // ── Hackathon
    { id: 'f0000001-0000-0000-0000-000000000001', project_id: PROJECTS.hackathon, title: 'Location salle et équipements événementiels',          amount: 15000, category: 'equipment',     status: 'approved', expense_date: '2026-04-10', submitted_by: USERS.youssef, approved_by: USERS.karim, approved_at: '2026-04-12T10:00:00Z', notes: 'Location auditorium + sono, vidéoprojecteurs et estrades.' },
    { id: 'f0000001-0000-0000-0000-000000000002', project_id: PROJECTS.hackathon, title: 'Transport participants Casablanca–Benguerir',           amount: 8500,  category: 'transport',     status: 'approved', expense_date: '2026-04-20', submitted_by: USERS.youssef, approved_by: USERS.karim, approved_at: '2026-04-22T09:00:00Z', notes: 'Navettes depuis Casa-Voyageurs pour participants hors campus.' },
    { id: 'f0000001-0000-0000-0000-000000000003', project_id: PROJECTS.hackathon, title: 'Restauration équipe et participants (2 jours)',         amount: 12000, category: 'other',         status: 'pending',  expense_date: '2026-05-15', submitted_by: USERS.youssef, notes: 'Déjeuners, dîner, pauses-café pour 80 participants sur 2 jours.' },
    { id: 'f0000001-0000-0000-0000-000000000004', project_id: PROJECTS.hackathon, title: 'Kit participants (carnet, stylos, t-shirt, sac)',       amount: 9500,  category: 'equipment',     status: 'pending',  expense_date: '2026-05-16', submitted_by: USERS.sara,    notes: 'Goodies et kit de bienvenue pour 80 participants + staff.' },
    // ── Workshop
    { id: 'f0000001-0000-0000-0000-000000000005', project_id: PROJECTS.workshop,  title: 'Fournitures créativité (post-its, feutres, paperboards)', amount: 2800, category: 'equipment',     status: 'approved', expense_date: '2026-05-02', submitted_by: USERS.sara,    approved_by: USERS.karim, approved_at: '2026-05-04T09:00:00Z', notes: 'Post-its, marqueurs, paperboards A0, gabarits imprimés couleur.' },
    { id: 'f0000001-0000-0000-0000-000000000006', project_id: PROJECTS.workshop,  title: 'Pause-café et déjeuner participants workshop',            amount: 3500, category: 'other',         status: 'approved', expense_date: '2026-05-10', submitted_by: USERS.youssef, approved_by: USERS.karim, approved_at: '2026-05-11T14:00:00Z', notes: 'Buffet déjeuner et 2 pauses-café pour 25 participants + facilitateurs.' },
    { id: 'f0000001-0000-0000-0000-000000000007', project_id: PROJECTS.workshop,  title: 'Communication sponsorisée réseaux sociaux',               amount: 1800, category: 'other',         status: 'pending',  expense_date: '2026-05-12', submitted_by: USERS.sara,    notes: 'Boost LinkedIn et Instagram pour promouvoir le workshop.' },
    // ── Bootcamp
    { id: 'f0000001-0000-0000-0000-000000000008', project_id: PROJECTS.bootcamp,  title: 'Honoraires coachs et intervenants externes',             amount: 18000, category: 'other',         status: 'approved', expense_date: '2026-03-05', submitted_by: USERS.mehdi,   approved_by: USERS.karim, approved_at: '2026-03-07T10:00:00Z', notes: 'Rémunération de 4 coachs pour 3 sessions chacun.' },
    { id: 'f0000001-0000-0000-0000-000000000009', project_id: PROJECTS.bootcamp,  title: 'Hébergement participants venant de hors région',          amount: 12000, category: 'accommodation', status: 'pending',  expense_date: '2026-04-01', submitted_by: USERS.youssef, notes: 'Hébergement de 8 participants résidant hors Benguerir.' },
    { id: 'f0000001-0000-0000-0000-000000000010', project_id: PROJECTS.bootcamp,  title: 'Transport Rabat–Benguerir intervenants (2 déplacements)', amount: 4500, category: 'transport',     status: 'approved', expense_date: '2026-03-15', submitted_by: USERS.youssef, approved_by: USERS.karim, approved_at: '2026-03-16T11:00:00Z', notes: 'Frais kilométriques et péage pour 2 coachs résidant à Rabat.' },
    { id: 'f0000001-0000-0000-0000-000000000011', project_id: PROJECTS.bootcamp,  title: 'Matériel pédagogique et impression supports',             amount: 3200, category: 'equipment',     status: 'rejected', expense_date: '2026-04-10', submitted_by: USERS.imane,   approved_by: USERS.karim, approved_at: '2026-04-12T09:00:00Z', rejection_note: 'Budget matériel déjà utilisé — utiliser les ressources existantes du lab.', notes: 'Impression cahiers pédagogiques, reliures pour 20 participants.' },
    // ── Incubation
    { id: 'f0000001-0000-0000-0000-000000000012', project_id: PROJECTS.incubation, title: 'Abonnements outils SaaS (Notion, Figma, Slack)',        amount: 8500, category: 'other',         status: 'pending', expense_date: '2026-05-12', submitted_by: USERS.mehdi,  notes: 'Licences annuelles pour équipe et startups incubées (10 comptes).' },
    { id: 'f0000001-0000-0000-0000-000000000013', project_id: PROJECTS.incubation, title: 'Conception supports et identité visuelle programme',    amount: 5000, category: 'other',         status: 'pending', expense_date: '2026-05-13', submitted_by: USERS.sara,   notes: 'Logo Batch 3, charte graphique, brochure candidature et bannières web.' },
    { id: 'f0000001-0000-0000-0000-000000000014', project_id: PROJECTS.incubation, title: 'Déplacements mentors (sessions de kick-off)',           amount: 3000, category: 'transport',     status: 'pending', expense_date: '2026-05-14', submitted_by: USERS.imane,  notes: 'Remboursement frais transport pour 5 mentors lors de la réunion de lancement.' },
  ]
  const { error } = await supabase.from('expenses').upsert(rows, { onConflict: 'id' })
  ok('expenses (14)', error)
}

async function seedPops() {
  console.log('\n[8/8] Pops…')
  const rows = [
    { id: 'g0000001-0000-0000-0000-000000000001', author_id: USERS.yasmine, project_id: null,               content: 'Bienvenue sur Jet Pops, la plateforme de gestion de projets du I&E Lab ! La plateforme est maintenant opérationnelle pour toute l\'équipe. N\'hésitez pas à explorer vos projets et à partager vos avancées ici.', created_at: '2026-03-15T09:00:00Z' },
    { id: 'g0000001-0000-0000-0000-000000000002', author_id: USERS.karim,   project_id: PROJECTS.hackathon, content: 'Le Hackathon IA & Données 2026 est officiellement lancé ! Nous avons déjà confirmé 3 partenaires industriels majeurs comme sponsors. Merci à toute l\'équipe pour la préparation. Objectif : 80 participants sur 2 jours !', created_at: '2026-04-01T10:00:00Z' },
    { id: 'g0000001-0000-0000-0000-000000000003', author_id: USERS.nadia,   project_id: PROJECTS.workshop,  content: 'Workshop Design Thinking — 12 nouvelles inscriptions cette semaine ! On approche des 30 participants, exactement notre cible. Les facilitateurs sont confirmés, les supports sont prêts. Dernière ligne droite !', created_at: '2026-04-28T11:00:00Z' },
    { id: 'g0000001-0000-0000-0000-000000000004', author_id: USERS.sara,    project_id: PROJECTS.hackathon, content: 'Le kit de communication du Hackathon est en cours de finalisation ! Visuels LinkedIn, flyers PDF et page d\'inscription en cours. On devrait être prêts à lancer la comm cette semaine.', created_at: '2026-05-02T09:30:00Z' },
    { id: 'g0000001-0000-0000-0000-000000000005', author_id: USERS.mehdi,   project_id: PROJECTS.bootcamp,  content: 'Premier kick-off du Bootcamp Entrepreneuriat S1 ce matin avec 18 porteurs de projets ! Énergie incroyable dans la salle. Les participants viennent de 6 villes différentes. Beau départ pour cette nouvelle cohorte !', created_at: '2026-05-05T12:00:00Z' },
    { id: 'g0000001-0000-0000-0000-000000000006', author_id: USERS.omar,    project_id: null,               content: 'Petit rappel : si vous connaissez des porteurs de projets ou startups deep-tech intéressés par l\'Incubation Batch 3, partagez l\'info ! L\'appel à candidatures ouvrira en juillet. Le réseau c\'est notre force.', created_at: '2026-05-10T14:00:00Z' },
    { id: 'g0000001-0000-0000-0000-000000000007', author_id: USERS.imane,   project_id: PROJECTS.bootcamp,  content: 'Rapport budgétaire S1 Bootcamp disponible : taux d\'engagement à 42% à mi-parcours. Bonne maîtrise des dépenses ! Les honoraires des intervenants sont les principaux postes. Rapport complet partagé sur la plateforme.', created_at: '2026-05-14T16:00:00Z' },
    { id: 'g0000001-0000-0000-0000-000000000008', author_id: USERS.youssef, project_id: PROJECTS.workshop,  content: 'Logistique Workshop Design Thinking OK ! Salle réservée, matériel commandé, traiteur confirmé. Plus qu\'à accueillir les participants la semaine prochaine. Merci Sara et Nadia pour la coordination au top !', created_at: '2026-05-15T10:30:00Z' },
  ]
  const { error } = await supabase.from('pops').upsert(rows, { onConflict: 'id' })
  ok('pops (8)', error)
}

// ────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Seed Demo — Jet Pops / I&E Lab UM6P ===')
  console.log(`URL: ${SUPABASE_URL}\n`)

  await seedUsers()
  await seedProfiles()
  await seedPrograms()
  await seedProjects()
  await seedMembers()
  await seedTasks()
  await seedExpenses()
  await seedPops()

  console.log('\n✅ Seed terminé.')
  console.log('   Mot de passe universel : DemoPass2026!')
}

main().catch(err => { console.error(err); process.exit(1) })

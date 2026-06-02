// ============================================================
// SEED TEST TASKS — Jet Pops
// Insère 2 tâches de test en statut 'pending_acceptance'
// pour valider le workflow accept/refuse.
//
// Usage :
//   node supabase/run_seed.js
//
// Variables requises dans .env.local :
//   NEXT_PUBLIC_SUPABASE_URL
//   SUPABASE_SERVICE_ROLE_KEY
// ============================================================

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

// --- Charger .env.local manuellement (pas de dépendance externe) ---
const envPath = path.resolve(__dirname, '..', '.env.local');
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/i);
  if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Priorité au compte UM6P (utilisé en environnement de test navigateur).
// Le 2e email est conservé en fallback si le profil UM6P n'existe pas.
// Fallback final : 1er profil trouvé pour le display name "Abderrahmane Haddad".
const TARGET_EMAILS = ['abderrahmane.haddad@um6p.ma', 'haddad.abderrahmane0@gmail.com'];
const TARGET_FULL_NAME = 'Abderrahmane Haddad';

const TASKS = [
  {
    title: 'Préparer la logistique du workshop',
    description:
      'Coordonner la réservation de la salle, le matériel et les intervenants pour le prochain workshop I&E.',
    priority: 'high',
    due_offset_days: 5,
  },
  {
    title: "Créer le deck de présentation de l'événement",
    description:
      "Concevoir une présentation Canva/PowerPoint pour présenter l'événement aux participants et partenaires.",
    priority: 'medium',
    due_offset_days: 7,
  },
];

function dueDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

async function main() {
  // 1. Trouver l'utilisateur cible
  //    a) essaie chaque email cible dans l'ordre de préférence (UM6P d'abord)
  //    b) sinon, fallback sur le 1er profil pour le display name
  let profile = null;
  for (const email of TARGET_EMAILS) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('email', email)
      .maybeSingle();
    if (error) {
      console.error(`❌ Erreur lookup profiles (${email}) :`, error.message);
      process.exit(1);
    }
    if (data) {
      profile = data;
      break;
    }
  }

  if (!profile) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, full_name')
      .eq('full_name', TARGET_FULL_NAME)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('❌ Erreur lookup profiles (full_name) :', error.message);
      process.exit(1);
    }
    profile = data;
  }

  if (!profile) {
    console.error(
      `❌ Aucun profil trouvé pour ${TARGET_EMAILS.join(' / ')} ni pour full_name="${TARGET_FULL_NAME}"`,
    );
    process.exit(1);
  }
  console.log(`✅ Utilisateur trouvé : ${profile.full_name || profile.email} (${profile.id})`);

  // 2. Trouver un projet actif
  const { data: project, error: prjErr } = await supabase
    .from('projects')
    .select('id, title, status')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (prjErr) {
    console.error('❌ Erreur lookup projects :', prjErr.message);
    process.exit(1);
  }
  if (!project) {
    console.error("❌ Aucun projet actif trouvé (status='active', deleted_at IS NULL)");
    process.exit(1);
  }
  console.log(`✅ Projet cible : ${project.title} (${project.id})`);

  // 3. Détecter si les colonnes v1.4 existent (test insert avec colonne pending_acceptance)
  const probeTitle = '__probe__' + Date.now();
  const { error: probeErr } = await supabase
    .from('tasks')
    .insert({
      project_id: project.id,
      title: probeTitle,
      assigned_to: profile.id,
      assigned_by: profile.id,
      status: 'pending_acceptance',
      priority: 'low',
      created_by: profile.id,
      pending_acceptance: true,
    })
    .select('id')
    .single();

  let hasV14 = true;
  if (probeErr) {
    const msg = probeErr.message || '';
    if (/pending_acceptance|assigned_by|invalid input value for enum/i.test(msg)) {
      hasV14 = false;
      console.warn('⚠️  Colonnes v1.4 (pending_acceptance/assigned_by) ou statut "pending_acceptance" absent.');
      console.warn('    Détail :', msg);
      console.warn(
        '    → Exécute d\'abord les migrations dans Supabase SQL Editor :\n' +
          '       supabase/add_task_base_columns.sql\n' +
          '       supabase/add_task_acceptance.sql\n' +
          '    OU lance supabase/seed_test_tasks.sql qui les inclut.',
      );
      console.warn('    → Fallback : insertion avec status="todo" sans pending_acceptance.\n');
    } else {
      console.error('❌ Erreur probe inattendue :', msg);
      process.exit(1);
    }
  } else {
    // Nettoyer la tâche probe
    await supabase.from('tasks').delete().eq('title', probeTitle);
  }

  // 4. Insérer (ou retrouver) les 2 tâches
  const inserted = [];
  for (const t of TASKS) {
    const { data: existing } = await supabase
      .from('tasks')
      .select('id, title, status')
      .eq('title', t.title)
      .eq('project_id', project.id)
      .maybeSingle();

    if (existing) {
      // Si la migration v1.4 est maintenant appliquée et la tâche est restée en 'todo',
      // on la met à jour pour rejouer le workflow accept/refuse.
      if (hasV14 && existing.status === 'todo') {
        const { data: updated, error: uErr } = await supabase
          .from('tasks')
          .update({
            status: 'pending_acceptance',
            pending_acceptance: true,
            assigned_by: profile.id,
            accepted_at: null,
            refused_at: null,
            refused_reason: null,
            refused_by: null,
          })
          .eq('id', existing.id)
          .select('id, title, status')
          .single();
        if (uErr) {
          console.error(`❌ Update "${t.title}" → pending_acceptance : ${uErr.message}`);
          process.exit(1);
        }
        console.log(`↻  Tâche promue en pending_acceptance : "${updated.title}" → ${updated.id}`);
        inserted.push(updated);
      } else {
        console.log(`↺  Tâche déjà présente : "${t.title}" → ${existing.id} (status=${existing.status})`);
        inserted.push(existing);
      }
      continue;
    }

    const base = {
      project_id: project.id,
      title: t.title,
      description: t.description,
      assigned_to: profile.id,
      priority: t.priority,
      due_date: dueDate(t.due_offset_days),
      created_by: profile.id,
    };

    const payload = hasV14
      ? {
          ...base,
          assigned_by: profile.id,
          status: 'pending_acceptance',
          pending_acceptance: true,
        }
      : { ...base, status: 'todo' };

    const { data, error } = await supabase
      .from('tasks')
      .insert(payload)
      .select('id, title, status')
      .single();

    if (error) {
      console.error(`❌ Insert "${t.title}" : ${error.message}`);
      process.exit(1);
    }
    console.log(`✅ Tâche créée : "${data.title}" → ${data.id} (status=${data.status})`);
    inserted.push(data);
  }

  console.log('\n— Résumé —');
  for (const t of inserted) console.log(`  ${t.id}  ${t.status.padEnd(20)}  ${t.title}`);

  if (!hasV14) {
    console.log(
      '\n⚠️  Les tâches ont été créées avec status="todo" car les colonnes v1.4 manquent.\n' +
        '    Lance supabase/seed_test_tasks.sql dans Supabase SQL Editor, puis relance ce script.',
    );
  }
}

main().catch((err) => {
  console.error('❌ Erreur fatale :', err);
  process.exit(1);
});

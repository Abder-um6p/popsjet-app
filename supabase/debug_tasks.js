// ============================================================
// DEBUG TASKS — Jet Pops v1.4.2
// Audit complet du flux My Tasks pour comprendre pourquoi
// haddad.abderrahmane0@gmail.com ne voit pas ses tâches.
//
// Usage :
//   node supabase/debug_tasks.js
// ============================================================

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '..', '.env.local');
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/i);
  if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('❌ Variables manquantes dans .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TARGET_EMAIL = 'haddad.abderrahmane0@gmail.com';
const TASK_TITLES = [
  'Préparer la logistique du workshop',
  "Créer le deck de présentation de l'événement",
];

function section(title) {
  console.log('\n' + '═'.repeat(70));
  console.log('  ' + title);
  console.log('═'.repeat(70));
}

async function main() {
  // ─── 1. Profile lookup ─────────────────────────────────────────────────
  section('1. PROFILE & AUTH MAPPING');
  const { data: profile, error: pErr } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('email', TARGET_EMAIL)
    .maybeSingle();

  if (pErr) {
    console.error('❌ profiles error:', pErr.message);
    process.exit(1);
  }
  if (!profile) {
    console.error(`❌ Aucun profil pour ${TARGET_EMAIL}`);
    process.exit(1);
  }
  console.log('profile.id   :', profile.id);
  console.log('profile.email:', profile.email);
  console.log('profile.role :', profile.role);
  console.log('profile.name :', profile.full_name);

  // ─── 2. auth.users via admin API ───────────────────────────────────────
  const { data: authList, error: aErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (aErr) {
    console.error('❌ auth.admin.listUsers error:', aErr.message);
  } else {
    const u = authList.users.find((x) => x.email === TARGET_EMAIL);
    if (!u) {
      console.error('❌ Pas trouvé dans auth.users');
    } else {
      console.log('auth.uid     :', u.id);
      console.log('auth.email   :', u.email);
      const match = u.id === profile.id;
      console.log(match ? '✅ profile.id === auth.uid' : '❌ MISMATCH profile.id !== auth.uid');
    }
  }

  // ─── 3. Enum task_status ───────────────────────────────────────────────
  section('3. ENUM task_status');
  // Try via RPC; fallback via probing inserts
  let enumValues = null;
  try {
    const { data: enumRes, error: enumErr } = await supabase.rpc('debug_enum_values', {
      enum_name: 'task_status',
    });
    if (!enumErr && enumRes) enumValues = enumRes;
  } catch {}

  if (!enumValues) {
    // Probe by trying to fetch any task with each status using filter (cheap)
    const statuses = ['todo', 'in_progress', 'review', 'done', 'cancelled', 'blocked', 'pending_acceptance', 'refused'];
    const supported = {};
    for (const s of statuses) {
      const { error } = await supabase.from('tasks').select('id').eq('status', s).limit(1);
      supported[s] = error ? `❌ ${error.message}` : '✅';
    }
    console.log('Probe filter par status (un ❌ indique enum invalide) :');
    for (const [s, r] of Object.entries(supported)) console.log(`  ${s.padEnd(22)} ${r}`);
  } else {
    console.log('Enum values:', enumValues);
  }

  // ─── 4. Tasks assignées à profile.id ───────────────────────────────────
  section('4. TASKS WHERE assigned_to = profile.id');
  const { data: assigned, error: tErr } = await supabase
    .from('tasks')
    .select('id, title, status, priority, assigned_to, assigned_by, created_by, project_id, due_date, created_at')
    .eq('assigned_to', profile.id)
    .order('created_at', { ascending: false });

  if (tErr) {
    console.error('❌ tasks select error:', tErr.message);
  } else {
    console.log(`count = ${assigned.length}`);
    for (const t of assigned) {
      console.log(`  • [${t.status}] ${t.title}`);
      console.log(`    id=${t.id} assigned_by=${t.assigned_by} created_by=${t.created_by}`);
    }
  }

  // Try select with pending_acceptance column
  console.log('\n— Avec colonne pending_acceptance —');
  const { data: withPending, error: pErr2 } = await supabase
    .from('tasks')
    .select('id, title, status, pending_acceptance, accepted_at')
    .eq('assigned_to', profile.id);
  if (pErr2) {
    console.log('❌', pErr2.message);
    console.log('   → La colonne pending_acceptance n\'existe probablement pas.');
  } else {
    for (const t of withPending) {
      console.log(`  • [${t.status}] pending=${t.pending_acceptance} accepted_at=${t.accepted_at} — ${t.title}`);
    }
  }

  // ─── 5. Les 2 tâches du seed ──────────────────────────────────────────
  section('5. TÂCHES SEED (par titre)');
  for (const title of TASK_TITLES) {
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, status, assigned_to, assigned_by, created_by, project_id, priority, due_date, deleted_at')
      .eq('title', title);
    if (error) {
      console.log(`❌ "${title}":`, error.message);
      continue;
    }
    if (!data || data.length === 0) {
      console.log(`⚠️  "${title}" : aucune occurrence`);
      continue;
    }
    for (const t of data) {
      console.log(`  • ${t.title}`);
      console.log(`    id=${t.id}`);
      console.log(`    status=${t.status} assigned_to=${t.assigned_to} (match profile? ${t.assigned_to === profile.id})`);
      console.log(`    assigned_by=${t.assigned_by} created_by=${t.created_by} project_id=${t.project_id}`);
      console.log(`    deleted_at=${t.deleted_at || 'null'}`);
    }
  }

  // ─── 6. Tâches en pending_acceptance (toutes) ─────────────────────────
  section('6. TOUTES les tâches en pending_acceptance');
  const { data: pendings, error: pendErr } = await supabase
    .from('tasks')
    .select('id, title, status, assigned_to, assigned_by, pending_acceptance')
    .or('status.eq.pending_acceptance,pending_acceptance.eq.true');
  if (pendErr) {
    console.log('⚠️  Query combinée échoue :', pendErr.message);
    const { data: byStatus, error: bsErr } = await supabase
      .from('tasks')
      .select('id, title, status, assigned_to')
      .eq('status', 'pending_acceptance');
    if (bsErr) console.log('  status=pending_acceptance :', bsErr.message);
    else console.log(`  status=pending_acceptance count = ${byStatus.length}`);
  } else {
    console.log(`count = ${pendings.length}`);
    for (const t of pendings) {
      console.log(`  • [${t.status}] pending=${t.pending_acceptance} assigned_to=${t.assigned_to} — ${t.title}`);
    }
  }

  // ─── 7. Colonnes tasks (introspection schéma) ─────────────────────────
  section('7. COLONNES TABLE tasks (échantillon)');
  const { data: anyTask } = await supabase.from('tasks').select('*').limit(1);
  if (anyTask && anyTask[0]) {
    console.log('Colonnes présentes :', Object.keys(anyTask[0]).join(', '));
  }

  // ─── 8. Quel est le projet du seed ? ──────────────────────────────────
  section('8. PROJET CIBLE DU SEED');
  const { data: project } = await supabase
    .from('projects')
    .select('id, title, status, deleted_at')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (project) {
    console.log(`  ${project.title} (${project.id})`);
  } else {
    console.log('  ⚠️  Aucun projet actif (le seed ne pourrait pas insérer)');
  }

  console.log('\n' + '═'.repeat(70));
  console.log('  DEBUG TERMINÉ');
  console.log('═'.repeat(70));
}

main().catch((err) => {
  console.error('Erreur fatale:', err);
  process.exit(1);
});

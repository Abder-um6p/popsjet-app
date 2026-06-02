// ============================================================
// FIX TASK USER — Jet Pops
// Réaffecte les 2 tâches de test au bon profil (UM6P) pour que
// l'utilisateur connecté dans le navigateur les voie bien.
//
// Usage : node supabase/fix_task_user.js
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
  console.error('❌ NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY manquant dans .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const CORRECT_USER_ID = 'a105de0a-a52f-46d3-bfbe-a0b570a3ddf9';

async function main() {
  console.log(`🎯 Réaffectation des tâches au profil ${CORRECT_USER_ID}\n`);

  // 1. Trouver les tâches concernées AVANT la mise à jour
  const { data: before, error: bErr } = await supabase
    .from('tasks')
    .select('id, title, status, pending_acceptance, assigned_to, assigned_by, created_by')
    .or('title.ilike.%logistique%,title.ilike.%deck%,title.ilike.%présentation%');

  if (bErr) {
    console.error('❌ Erreur lookup tâches :', bErr.message);
    process.exit(1);
  }
  if (!before || before.length === 0) {
    console.error('❌ Aucune tâche trouvée (logistique/deck/présentation)');
    process.exit(1);
  }

  console.log(`— État AVANT (${before.length} tâches) —`);
  for (const t of before) {
    console.log(`  [${t.id}] "${t.title}"`);
    console.log(`     status=${t.status} pending=${t.pending_acceptance} assigned_to=${t.assigned_to}`);
  }
  console.log();

  // 2. Mettre à jour chaque tâche par id (évite les soucis de filtres ILIKE/OR sur update)
  const ids = before.map((t) => t.id);
  const { data: updated, error: uErr } = await supabase
    .from('tasks')
    .update({
      assigned_to: CORRECT_USER_ID,
      assigned_by: CORRECT_USER_ID,
      created_by: CORRECT_USER_ID,
    })
    .in('id', ids)
    .select('id, title, status, pending_acceptance, assigned_to, assigned_by, created_by');

  if (uErr) {
    console.error('❌ Erreur update :', uErr.message);
    process.exit(1);
  }

  // 3. Re-fetch via la condition assigned_to = CORRECT_USER_ID pour confirmer
  const { data: after, error: aErr } = await supabase
    .from('tasks')
    .select('id, title, status, pending_acceptance, assigned_to')
    .eq('assigned_to', CORRECT_USER_ID)
    .in('id', ids);

  if (aErr) {
    console.error('❌ Erreur re-fetch :', aErr.message);
    process.exit(1);
  }

  console.log(`— État APRÈS (re-fetch via assigned_to=${CORRECT_USER_ID}) —`);
  for (const t of after) {
    console.log(`  [${t.id}] "${t.title}"`);
    console.log(`     status=${t.status} pending=${t.pending_acceptance} assigned_to=${t.assigned_to}`);
  }

  const okCount = after.filter((t) => t.assigned_to === CORRECT_USER_ID).length;
  console.log(`\n✅ ${okCount}/${before.length} tâches désormais assignées à ${CORRECT_USER_ID}`);

  if (okCount !== before.length) {
    console.error('⚠️  Certaines tâches n\'ont pas été réaffectées.');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Erreur fatale :', err);
  process.exit(1);
});

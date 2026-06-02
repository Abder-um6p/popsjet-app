// ============================================================
// RESET TEST TASKS — Jet Pops
// Reset the 2 test tasks back to pending_acceptance state so
// the accept/refuse flow can be retested end-to-end.
//
// Usage:
//   node supabase/reset_test_tasks.js
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
const SERVICE_KEY  = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TASK_IDS = [
  '28affdea-e6ea-48c4-86bc-4f340679d958',
  '04033574-d34a-4dc7-bb45-00e518388fd5',
];

async function main() {
  console.log('Resetting test tasks to pending_acceptance...\n');

  const { data: updated, error: updErr } = await admin
    .from('tasks')
    .update({
      status: 'pending_acceptance',
      pending_acceptance: true,
      accepted_at: null,
      refused_at: null,
      refused_by: null,
      refused_reason: null,
    })
    .in('id', TASK_IDS)
    .select('id, title, status, pending_acceptance, accepted_at, refused_at, refused_by, refused_reason');

  if (updErr) {
    console.error('Update failed:', updErr.message);
    process.exit(1);
  }

  console.log(`Updated ${updated?.length ?? 0} task(s).\n`);

  // Re-fetch to confirm
  const { data: confirm, error: cErr } = await admin
    .from('tasks')
    .select('id, title, status, pending_acceptance, accepted_at, refused_at, refused_by, refused_reason')
    .in('id', TASK_IDS);

  if (cErr) {
    console.error('Re-fetch failed:', cErr.message);
    process.exit(1);
  }

  console.log('Current state:');
  for (const t of confirm ?? []) {
    console.log(`  • ${t.title}`);
    console.log(`    id=${t.id}`);
    console.log(`    status=${t.status} pending=${t.pending_acceptance}`);
    console.log(`    accepted_at=${t.accepted_at} refused_at=${t.refused_at} refused_by=${t.refused_by} reason=${t.refused_reason}`);
  }
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});

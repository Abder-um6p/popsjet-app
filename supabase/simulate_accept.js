// Simulate /api/tasks/[id]/accept end-to-end using the service role,
// to confirm the route's DB ops succeed with real data.
//
// Usage: node supabase/simulate_accept.js
//
// NOTE: This MUTATES the test task. Re-run reset_test_tasks.js afterwards
// to bring it back to pending_acceptance for browser-side testing.

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '..', '.env.local');
const env = {};
for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.+?)\s*$/i);
  if (m) env[m[1]] = m[2].replace(/^"(.*)"$/, '$1');
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const TASK_ID = '28affdea-e6ea-48c4-86bc-4f340679d958';

async function main() {
  // Step 1: fetch
  console.log('1. Fetching task...');
  const { data: task, error: fetchError } = await admin
    .from('tasks')
    .select('id, project_id, title, assigned_to, created_by, status')
    .eq('id', TASK_ID)
    .is('deleted_at', null)
    .single();
  if (fetchError || !task) { console.error('  FAIL:', fetchError?.message); return; }
  console.log('  OK — assigned_to =', task.assigned_to);
  const userId = task.assigned_to;

  // Step 2: v1.4 columns
  console.log('2. Fetching v1.4 columns...');
  const { data: acc } = await admin
    .from('tasks')
    .select('assigned_by, pending_acceptance')
    .eq('id', TASK_ID)
    .maybeSingle();
  console.log('  pending_acceptance =', acc?.pending_acceptance, ', assigned_by =', acc?.assigned_by);

  // Step 3: update
  const now = new Date().toISOString();
  console.log('3. Updating task to status=todo...');
  const { data: updated, error: e1 } = await admin
    .from('tasks')
    .update({ status: 'todo', pending_acceptance: false, accepted_at: now, updated_at: now })
    .eq('id', TASK_ID)
    .select()
    .single();
  if (e1) { console.error('  FAIL:', e1.message); return; }
  console.log('  OK — new status =', updated.status, ', accepted_at =', updated.accepted_at);

  // Step 4: activity log (this is what was throwing)
  console.log('4. Inserting task_activity_logs...');
  try {
    const { error: alErr } = await admin.from('task_activity_logs').insert({
      task_id: TASK_ID, user_id: userId, action: 'accepted',
      old_value: 'pending_acceptance', new_value: 'todo',
      note: 'Tâche acceptée (simulation)', created_at: now,
    });
    if (alErr) console.log('  (returned error, swallowed):', alErr.message);
    else console.log('  OK — log inserted');
  } catch (e) {
    console.log('  THREW (swallowed):', e.message);
  }

  // Step 5: profile fetch
  console.log('5. Fetching accepter profile...');
  const { data: prof } = await admin
    .from('profiles').select('full_name').eq('id', userId).single();
  console.log('  full_name =', prof?.full_name);

  // Step 6: notification (if assigned_by/created_by differs)
  const notifyIds = new Set();
  if (acc?.assigned_by && acc.assigned_by !== userId) notifyIds.add(acc.assigned_by);
  if (task.created_by && task.created_by !== userId) notifyIds.add(task.created_by);
  console.log('6. Inserting notifications for', notifyIds.size, 'recipients...');
  for (const rid of notifyIds) {
    try {
      const { error: nErr } = await admin.from('notifications').insert({
        user_id: rid, type: 'task_accepted',
        title: 'Tâche acceptée',
        message: `${prof?.full_name ?? 'Un membre'} a accepté la tâche "${task.title}" (simulation)`,
        data: { task_id: TASK_ID, project_id: task.project_id },
        is_read: false,
      });
      if (nErr) console.log('  (returned error, swallowed):', nErr.message);
      else console.log('  OK — notification for', rid);
    } catch (e) {
      console.log('  THREW (swallowed):', e.message);
    }
  }

  console.log('\n✅ Full simulated accept flow completed without unhandled exception.');
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });

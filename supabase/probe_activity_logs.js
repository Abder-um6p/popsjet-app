// Quick probe: does task_activity_logs table exist? what columns?
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

async function main() {
  console.log('— SELECT 1 from task_activity_logs —');
  const { data, error } = await admin.from('task_activity_logs').select('*').limit(1);
  if (error) {
    console.log('error.message :', error.message);
    console.log('error.code    :', error.code);
    console.log('error.details :', error.details);
    console.log('error.hint    :', error.hint);
  } else {
    console.log(`rows=${data?.length ?? 0}`);
    if (data && data[0]) console.log('columns:', Object.keys(data[0]).join(', '));
    else console.log('table exists but is empty — try insert probe');
  }

  // Attempt an insert with the same payload the accept route uses, to see real error.
  console.log('\n— INSERT probe (same payload as /accept) —');
  const { data: ins, error: insErr } = await admin
    .from('task_activity_logs')
    .insert({
      task_id: '28affdea-e6ea-48c4-86bc-4f340679d958',
      user_id: '00000000-0000-0000-0000-000000000000',
      action: 'accepted',
      old_value: 'pending_acceptance',
      new_value: 'todo',
      note: 'probe',
      created_at: new Date().toISOString(),
    })
    .select();
  if (insErr) {
    console.log('error.message :', insErr.message);
    console.log('error.code    :', insErr.code);
    console.log('error.details :', insErr.details);
    console.log('error.hint    :', insErr.hint);
  } else {
    console.log('insert ok:', ins);
  }
}

main().catch((e) => { console.error('Fatal:', e); process.exit(1); });

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
  const builder = admin.from('task_activity_logs').insert({
    task_id: '00000000-0000-0000-0000-000000000000',
    user_id: '00000000-0000-0000-0000-000000000000',
    action: 'probe',
    old_value: 'a', new_value: 'b', note: 'x',
    created_at: new Date().toISOString(),
  });
  console.log('typeof builder.catch =', typeof builder.catch);
  console.log('typeof builder.then  =', typeof builder.then);
  try {
    await builder.catch(() => {});
    console.log('builder.catch(...) worked');
  } catch (e) {
    console.log('builder.catch(...) THREW:', e.message);
  }
}

main();

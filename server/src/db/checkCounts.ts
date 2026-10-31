import dotenv from 'dotenv';
dotenv.config({ path: 'server/.env' });
import { getSupabaseAdminClient } from './supabaseClient.js';

async function check() {
  const sb = getSupabaseAdminClient();
  if (!sb) {
    console.error('Supabase admin client not initialized');
    process.exit(1);
  }
  const tables = [
    'news_sources',
    'canonical_stories',
    'articles',
    'story_articles',
    'story_timeline_events',
    'hourly_pulse_briefings',
    'briefing_stories',
    'perspective_analyses',
    'users',
    'saved_stories',
    'reading_history',
    'vocabulary_entries',
    'user_preferences',
  ];
  console.log('--- SUPABASE LIVE ROW COUNTS ---');
  for (const t of tables) {
    const { count, data, error } = await sb.from(t).select('*', { count: 'exact' }).limit(1);
    if (error) console.log(t.padEnd(20), 'ERROR:', error.message);
    else console.log(t.padEnd(20), ':', count, `(sample: ${data?.length || 0})`);
  }
  process.exit(0);
}

check().catch(e => {
  console.error(e);
  process.exit(1);
});

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

export interface RowCountComparison {
  tableName: string;
  cloudCount: number;
  status: 'VERIFIED' | 'EMPTY' | 'ERROR';
  error?: string;
}

export async function verifyCloudRowCounts(): Promise<RowCountComparison[]> {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error('Missing Supabase credentials in server/.env');
  }

  const client = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tablesToVerify = [
    'news_sources',
    'canonical_stories',
    'articles',
    'story_articles',
    'story_timeline_events',
    'hourly_pulse_briefings',
    'briefing_stories',
    'perspective_analyses',
  ];

  console.log(`\n======================================================`);
  console.log(`PULSE ACTUAL SUPABASE POSTGRESQL ROW COUNTS`);
  console.log(`Project: ${supabaseUrl}`);
  console.log(`======================================================\n`);

  const results: RowCountComparison[] = [];

  for (const table of tablesToVerify) {
    try {
      const { count, error } = await client
        .from(table)
        .select('*', { count: 'exact', head: true });

      if (error) throw error;

      const num = count ?? 0;
      results.push({
        tableName: table,
        cloudCount: num,
        status: num > 0 ? 'VERIFIED' : 'EMPTY',
      });

      console.log(`  ✓ ${table.padEnd(25)} : ${num.toString().padStart(6)} rows (${num > 0 ? 'VERIFIED' : 'EMPTY'})`);
    } catch (err: any) {
      results.push({
        tableName: table,
        cloudCount: 0,
        status: 'ERROR',
        error: err.message,
      });
      console.error(`  ✗ ${table.padEnd(25)} : ERROR - ${err.message}`);
    }
  }

  console.log(`\n======================================================\n`);
  return results;
}

if (process.argv[1] && process.argv[1].endsWith('verifyRowCounts.ts')) {
  verifyCloudRowCounts()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('[Row Count Verification Error]', err);
      process.exit(1);
    });
}

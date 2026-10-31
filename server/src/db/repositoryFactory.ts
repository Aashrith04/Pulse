import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { INewsRepository, StorageMode } from './types.js';
import { JsonFileRepository } from './jsonRepository.js';
import { SupabaseNewsRepository } from './supabaseRepository.js';
import { isSupabaseConfigured } from './supabaseClient.js';
import { db as jsonDb } from './database.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

let activeRepository: INewsRepository | null = null;

/**
 * Returns the configured storage mode based on PULSE_STORAGE_MODE environment variable.
 * Valid values: 'cloud' | 'local'.
 * Default: 'local' (ensures safe offline demo mode unless cloud is explicitly chosen).
 */
export function getStorageMode(): StorageMode {
  const mode = (process.env.PULSE_STORAGE_MODE || '').toLowerCase().trim();
  if (mode === 'cloud') {
    return 'cloud';
  }
  return 'local';
}

/**
 * Factory creating or returning the singleton repository instance.
 * Strict Error Handling: If cloud mode is configured but credentials are missing or
 * connection fails, it throws a descriptive error rather than silently falling back to local.
 */
export function createRepository(forceMode?: StorageMode): INewsRepository {
  const targetMode = forceMode || getStorageMode();

  if (targetMode === 'cloud') {
    const url = process.env.SUPABASE_URL?.trim();
    const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY)?.trim();
    const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY)?.trim();
    const hasCreds = Boolean(url && (serviceKey || anonKey));

    if (!hasCreds) {
      const errorMsg = 
        `[RepositoryFactory] FATAL: PULSE_STORAGE_MODE is set to "cloud", but Supabase credentials are missing or unconfigured. ` +
        `Runtime Diagnostic: SUPABASE_URL=${url ? 'PRESENT' : 'MISSING'}, ` +
        `SUPABASE_SERVICE_ROLE_KEY=${serviceKey ? 'PRESENT' : 'MISSING'}, ` +
        `SUPABASE_ANON_KEY=${anonKey ? 'PRESENT' : 'MISSING'}. ` +
        `Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in Render Dashboard -> pulse-backend -> Environment or server/.env.`;
      console.error(errorMsg);
      throw new Error(errorMsg);
    }

    try {
      console.log('[RepositoryFactory] Initializing Supabase Cloud Repository...');
      return new SupabaseNewsRepository();
    } catch (err: any) {
      console.error('[RepositoryFactory] Failed to initialize Supabase Cloud Repository:', err.message);
      // Strictly do not silently switch to local storage when cloud mode is demanded
      throw err;
    }
  }

  // Local storage mode (pulse.db.json)
  return new JsonFileRepository(jsonDb);
}

/**
 * Singleton repository getter
 */
export function getRepository(): INewsRepository {
  if (!activeRepository) {
    activeRepository = createRepository();
  }
  return activeRepository;
}

/**
 * Reset active repository (useful for testing or dynamic switching)
 */
export function resetRepository(mode?: StorageMode): INewsRepository {
  activeRepository = createRepository(mode);
  return activeRepository;
}

// Export default singleton
export const repository: INewsRepository = getRepository();

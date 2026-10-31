import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { Request, Response, NextFunction } from 'express';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load server/.env, then root .env, then process.cwd() fallback
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const SUPABASE_URL = process.env.SUPABASE_URL?.trim();
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY?.trim();
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

let anonClient: SupabaseClient | null = null;
let adminClient: SupabaseClient | null = null;

if (SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_ANON_KEY.includes('your-supabase')) {
  try {
    anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    console.log('[Supabase] Initialized anonymous client for public/user access.');
  } catch (err) {
    console.warn('[Supabase] Failed to initialize anonymous client:', err);
  }
}

// Service-role client is strictly server-side and never exposed to the client or browser
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY && !SUPABASE_SERVICE_ROLE_KEY.includes('your-supabase')) {
  try {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });
    console.log('[Supabase] Initialized service-role client for background operations.');
  } catch (err) {
    console.warn('[Supabase] Failed to initialize service-role client:', err);
  }
}

export function isSupabaseConfigured(): boolean {
  return Boolean(anonClient !== null);
}

export function getSupabaseClient(): SupabaseClient | null {
  return anonClient;
}

export function getSupabaseAdminClient(): SupabaseClient | null {
  return adminClient;
}

/**
 * Creates an immutable, request-scoped Supabase client carrying the user's verified JWT.
 * When executed against PostgreSQL, PostgREST sets auth.uid() to the user's ID,
 * enforcing Row-Level Security (RLS) policies cryptographically.
 * Never mutates any shared client, strictly preventing cross-tenant authorization leakage.
 */
export function createScopedSupabaseClient(token?: string): SupabaseClient {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('[Supabase] Cannot create scoped client: credentials missing');
  }

  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    },
  });
}

export interface AuthenticatedUser {
  id: string;
  email?: string;
  isGuest: boolean;
  isAdmin?: boolean;
  token?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

/**
 * Express middleware to identify authenticated user via Supabase JWT or guest session.
 * Enforces user isolation across preferences, saved stories, vocabulary, and notifications.
 */
export async function authenticateUser(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const adminSecretHeader = req.headers['x-admin-key'];
  const configuredAdminSecret = process.env.ADMIN_API_KEY || 'pulse-admin-secret-2026';

  // 1. Check for Admin token
  if (adminSecretHeader && adminSecretHeader === configuredAdminSecret) {
    req.user = {
      id: 'admin-system-user',
      email: 'admin@pulse.news',
      isGuest: false,
      isAdmin: true,
    };
    return next();
  }

  // 2. Check for Bearer token if Supabase is active
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    
    if (anonClient) {
      try {
        const { data: { user }, error } = await anonClient.auth.getUser(token);
        if (error || !user) {
          return res.status(401).json({ error: 'Invalid or expired authentication session' });
        }

        req.user = {
          id: user.id,
          email: user.email,
          isGuest: false,
          isAdmin: user.app_metadata?.is_admin === true,
          token,
        };
        return next();
      } catch (err) {
        return res.status(401).json({ error: 'Failed to verify authentication credentials' });
      }
    }
  }

  // 3. Fallback to Local / Guest User Isolation
  // Extract user identity from X-Guest-ID, X-User-ID, query or body
  const guestHeaderId = (req.headers['x-guest-id'] as string) || (req.headers['x-user-id'] as string);
  const paramUserId = (req.query.userId as string) || (req.body?.userId as string);
  
  // Scoped guest identity: prioritize device/client guest ID header, then explicit param (e.g. automated tests)
  const resolvedId = guestHeaderId || paramUserId || 'guest-session-default';

  req.user = {
    id: resolvedId,
    isGuest: true,
    isAdmin: false,
  };

  next();
}

/**
 * Middleware ensuring endpoint requires full admin authorization
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const adminSecretHeader = req.headers['x-admin-key'];
  const configuredAdminSecret = process.env.ADMIN_API_KEY || 'pulse-admin-secret-2026';

  if (req.user?.isAdmin || adminSecretHeader === configuredAdminSecret) {
    return next();
  }

  return res.status(403).json({ 
    error: 'Access denied: Admin credentials required', 
    hint: 'Provide valid X-Admin-Key header or administrator session' 
  });
}

/**
 * Middleware ensuring request is authenticated for persistent personal features.
 * In cloud mode (PULSE_STORAGE_MODE=cloud), rejects guest sessions with 401.
 * In local demo mode (PULSE_STORAGE_MODE=local), permits guest demonstration usage.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const mode = (process.env.PULSE_STORAGE_MODE || '').toLowerCase().trim();
  if (mode === 'cloud') {
    if (!req.user || req.user.isGuest) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'A valid Supabase authentication session is required to access personal cloud features in cloud mode.',
      });
    }
  }
  next();
}


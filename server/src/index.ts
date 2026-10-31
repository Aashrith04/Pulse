import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import rateLimit from 'express-rate-limit';
import apiRouter from './routes/api.js';
import { taskScheduler } from './ingestion/scheduler.js';
import { authenticateUser } from './db/supabaseClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load server/.env, then root .env, then process.cwd() fallback
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'server/.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3001;
const HOST = '0.0.0.0';

// General API rate limiter (120 requests per minute)
const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 180,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Rate limit exceeded: Please wait a moment before sending more requests.' },
});

// Allowed origins for CORS (supports comma-separated list in CLIENT_URL)
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((s) => s.trim().replace(/\/$/, ''))
  : ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:3000'];

// HTTP Security Headers
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

// Production-hardened CORS
app.use(cors({
  origin: (origin, callback) => {
    // Permit server-to-server, curl, mobile native or non-browser requests
    if (!origin) return callback(null, true);
    if (process.env.NODE_ENV !== 'production' || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    return callback(new Error(`CORS blocked for untrusted origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use(generalLimiter);
app.use(authenticateUser);

// Logging middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.originalUrl.startsWith('/api')) {
      console.log(`[API] ${req.method} ${req.originalUrl} ${res.statusCode} (${duration}ms)`);
    }
  });
  next();
});

// API Routes
app.use('/api', apiRouter);

// Root fallback
app.get('/', (req, res) => {
  res.json({
    name: 'Pulse API',
    tagline: 'The world, understood.',
    version: '1.0.0',
    documentation: '/api/health',
  });
});

// Start server only when not running in test mode
let server: any = null;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, HOST, () => {
    console.log(`\n=================================================`);
    console.log(`  PULSE — THE WORLD, UNDERSTOOD.`);
    console.log(`  Server listening on http://${HOST}:${PORT}`);
    console.log(`  Health API: http://${HOST}:${PORT}/api/health`);
    console.log(`=================================================\n`);

    // Start background scheduler if enabled
    if (process.env.ENABLE_BACKGROUND_SCHEDULER !== 'false') {
      taskScheduler.start();
    }
  });
}

// Graceful shutdown
const shutdown = () => {
  console.log('\n[Server] Gracefully shutting down...');
  taskScheduler.stop();
  server.close(() => {
    console.log('[Server] Process exited.');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;

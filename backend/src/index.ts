import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { connectDB } from './config/database';
import { getRedisClient, closeRedis, ensureLocalRedisRunning } from './config/redis';
import { runMigrations } from './migrations/run';
import { startEmailWorker, stopEmailWorker } from './workers/emailWorker';
import { getEmailQueue } from './queues/emailQueue';
import emailRoutes from './routes/email.routes';
import { errorHandler } from './middleware/errorHandler';
import { setupBullBoard } from './config/bullBoard';
import { initElasticsearch } from './config/elasticsearch';
import { syncAllEmailsToElasticsearch } from './services/elasticsearch.service';
import { reconcileScheduledEmails } from './services/email.service';

dotenv.config();

const app = express();
app.set('trust proxy', 1); // Enable proxy support for Render load balancers
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── Security Middleware ──────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: false, // Allows Bull Board dashboard assets and preview embeds
}));

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// ─── Rate limiting ────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10000, // Generous limit for high dashboard throughput
  skip: (req) => req.path.startsWith('/queue'), // Never block live queue polling
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many requests, please try again later.' },
});

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(morgan('dev'));
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use('/api', apiLimiter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  let redisStatus = 'offline';
  try {
    const client = getRedisClient();
    redisStatus = client.status;
  } catch {
    redisStatus = 'error';
  }

  res.json({
    status: 'ok',
    service: 'Outbox Email Scheduler',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
    redis: {
      status: redisStatus,
      isExternal: !!process.env.REDIS_URL,
    },
    database: {
      configured: !!process.env.DATABASE_URL,
    },
  });
});

// ─── BullMQ Live Dashboard ────────────────────────────────────────────────────
// Exposes the live BullMQ dashboard for real-time queue visibility at /admin/queues
app.use('/admin/queues', setupBullBoard());

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api', emailRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

// ─── Error handler ────────────────────────────────────────────────────────────
app.use(errorHandler);

// ─── Start HTTP server immediately on 0.0.0.0 so Render detects port binding in <10ms ───
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀  Outbox backend running on 0.0.0.0:${PORT}`);
  console.log(`📋  Health:             http://0.0.0.0:${PORT}/health`);
  console.log(`📊  BullMQ Dashboard:   http://0.0.0.0:${PORT}/admin/queues`);
  console.log(`📬  API:                http://0.0.0.0:${PORT}/api/emails`);
  console.log(`🔍  Elasticsearch API:  http://0.0.0.0:${PORT}/api/emails/search?q=...\n`);
});

// ─── Bootstrap background dependencies asynchronously ────────────────────────
async function bootstrap(): Promise<void> {
  try {
    // 0. Ensure local Redis daemon is running
    ensureLocalRedisRunning();

    // 1. Connect to PostgreSQL
    await connectDB();

    // 2. Run DB migrations (idempotent — safe to run on every startup)
    await runMigrations();

    // 3. Initialise Redis
    getRedisClient();

    // 4. Initialise BullMQ queue
    getEmailQueue();

    // 5. Connect and initialize Elasticsearch index
    const esReady = await initElasticsearch();
    if (esReady) {
      await syncAllEmailsToElasticsearch();
    }

    // 6. Start the worker with concurrency & throttling
    startEmailWorker();

    // 7. Reconcile any pending scheduled emails (survives restarts & crashes)
    await reconcileScheduledEmails();
  } catch (err) {
    console.error('❌  Background bootstrap error:', err);
  }
}

// ─── Graceful shutdown ────────────────────────────────────────────────────────
const shutdown = async (signal: string) => {
  console.log(`\n⚡  Received ${signal} — shutting down gracefully…`);
  server.close(async () => {
    await stopEmailWorker();
    await closeRedis();
    console.log('👋  Shutdown complete');
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

bootstrap();


import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { connectDB } from './config/database';
import { getRedisClient, closeRedis } from './config/redis';
import { runMigrations } from './migrations/run';
import { startEmailWorker, stopEmailWorker } from './workers/emailWorker';
import { getEmailQueue } from './queues/emailQueue';
import emailRoutes from './routes/email.routes';
import { errorHandler } from './middleware/errorHandler';
import { setupBullBoard } from './config/bullBoard';
import { initElasticsearch } from './config/elasticsearch';
import { syncAllEmailsToElasticsearch } from './services/elasticsearch.service';

dotenv.config();

const app = express();
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
  max: 300,
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
  res.json({
    status: 'ok',
    service: 'Outbox Email Scheduler',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: Math.round(process.uptime()),
    environment: process.env.NODE_ENV || 'development',
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

// ─── Bootstrap ────────────────────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  try {
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

    // 7. Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`\n🚀  Outbox backend running on http://localhost:${PORT}`);
      console.log(`📋  Health:             http://localhost:${PORT}/health`);
      console.log(`📊  BullMQ Dashboard:   http://localhost:${PORT}/admin/queues`);
      console.log(`📬  API:                http://localhost:${PORT}/api/emails`);
      console.log(`🔍  Elasticsearch API:  http://localhost:${PORT}/api/emails/search?q=...\n`);
    });

    // ─── Graceful shutdown ────────────────────────────────────────────────────
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

  } catch (err) {
    console.error('❌  Bootstrap failed:', err);
    process.exit(1);
  }
}

bootstrap();

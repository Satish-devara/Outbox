import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';

import { connectDB } from './config/database';
import { getRedisClient, closeRedis } from './config/redis';
import { runMigrations } from './migrations/run';
import { startEmailWorker, stopEmailWorker } from './workers/emailWorker';
import { getEmailQueue } from './queues/emailQueue';
import emailRoutes from './routes/email.routes';
import { errorHandler } from './middleware/errorHandler';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3001', 10);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'Outbox Email Scheduler',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/api', emailRoutes);

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

    // 4. Initialise BullMQ queue (creates queue if not exists)
    getEmailQueue();

    // 5. Start the worker — picks up any persisted delayed jobs from Redis
    startEmailWorker();

    // 6. Start HTTP server
    const server = app.listen(PORT, () => {
      console.log(`\n🚀  Outbox backend running on http://localhost:${PORT}`);
      console.log(`📋  Health: http://localhost:${PORT}/health`);
      console.log(`📬  API:    http://localhost:${PORT}/api/emails\n`);
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

import { Redis, RedisOptions } from 'ioredis';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Ensures that if no external Redis is configured, or if pointing to localhost,
 * the container's local redis-server is active and listening.
 */
export function ensureLocalRedisRunning(): void {
  const isLocal =
    !process.env.REDIS_URL ||
    process.env.REDIS_URL.includes('localhost') ||
    process.env.REDIS_URL.includes('127.0.0.1');

  if (!isLocal) return;

  try {
    execSync('redis-cli ping', { stdio: 'ignore', timeout: 1000 });
    console.log('✅  Local Redis server is active');
    return;
  } catch {
    try {
      execSync('which redis-server', { stdio: 'ignore' });
      console.log('🚀  Starting local redis-server daemon…');
      execSync('redis-server --daemonize yes --protected-mode no --save "" --appendonly no', {
        stdio: 'ignore',
        timeout: 5000,
      });
      execSync('sleep 0.5');
      console.log('✅  Local redis-server started successfully');
    } catch {
      // redis-server might not be on PATH (e.g. host dev environment running docker-compose)
    }
  }
}

/**
 * Creates an isolated, dedicated IORedis client.
 * BullMQ requires separate Redis connection instances for Workers and Queues
 * because Workers execute blocking commands (BRPOPLPUSH/BLPOP) that take exclusive
 * hold of the socket, which would freeze Queue queries if shared.
 */
export function createRedisClient(): Redis {
  let client: Redis;

  if (process.env.REDIS_URL) {
    const isTls = process.env.REDIS_URL.startsWith('rediss://') || process.env.REDIS_TLS === 'true';
    client = new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: null, // Required by BullMQ
      connectTimeout: 10000,
      enableReadyCheck: false,
      tls: isTls ? { rejectUnauthorized: false } : undefined,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
    });
  } else {
    const options: RedisOptions = {
      host: process.env.REDIS_HOST || '127.0.0.1',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD || undefined,
      maxRetriesPerRequest: null, // Required by BullMQ
      connectTimeout: 10000,
      enableReadyCheck: false,
      tls: process.env.REDIS_TLS === 'true' ? { rejectUnauthorized: false } : undefined,
      retryStrategy: (times: number) => Math.min(times * 100, 3000),
    };
    client = new Redis(options);
  }

  client.on('error', (err) => console.error('❌  Redis error:', err.message));
  return client;
}

let sharedClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (!sharedClient) {
    sharedClient = createRedisClient();
    sharedClient.on('connect', () => console.log('✅  Connected to Redis'));
  }
  return sharedClient;
}

export async function closeRedis(): Promise<void> {
  if (sharedClient) {
    await sharedClient.quit();
    sharedClient = null;
  }
}

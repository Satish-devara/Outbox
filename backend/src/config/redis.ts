import { Redis, RedisOptions } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

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
      host: process.env.REDIS_HOST || 'localhost',
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

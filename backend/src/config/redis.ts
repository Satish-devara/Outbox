import { Redis, RedisOptions } from 'ioredis';
import dotenv from 'dotenv';

dotenv.config();

let redisClient: Redis;

export function getRedisClient(): Redis {
  if (!redisClient) {
    if (process.env.REDIS_URL) {
      redisClient = new Redis(process.env.REDIS_URL, {
        maxRetriesPerRequest: null, // Required by BullMQ
        connectTimeout: 5000,
        retryStrategy: (times: number) => Math.min(times * 100, 3000),
        tls: process.env.REDIS_URL.startsWith('rediss://') ? {} : undefined,
      });
    } else {
      const options: RedisOptions = {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD || undefined,
        maxRetriesPerRequest: null, // Required by BullMQ
        connectTimeout: 5000,
        retryStrategy: (times: number) => Math.min(times * 100, 3000),
      };
      if (process.env.REDIS_TLS === 'true') {
        options.tls = {};
      }
      redisClient = new Redis(options);
    }

    redisClient.on('connect', () => console.log('✅  Connected to Redis'));
    redisClient.on('error', (err) => console.error('❌  Redis error:', err.message));
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
  }
}

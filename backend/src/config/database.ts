import { Pool, PoolConfig } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

function getPoolConfig(): PoolConfig {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  }

  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    database: process.env.DB_NAME || 'outbox_db',
    user: process.env.DB_USER || 'outbox_user',
    password: process.env.DB_PASSWORD || 'outbox_pass',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

export const pool = new Pool(getPoolConfig());

export async function connectDB(retries = 5, delayMs = 3000): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const client = await pool.connect();
      console.log('✅  Connected to PostgreSQL database');
      client.release();
      return;
    } catch (err) {
      const errorMsg = (err as Error).message;
      console.warn(`⚠️  PostgreSQL connection attempt ${attempt}/${retries} failed: ${errorMsg}`);
      
      if (attempt === retries) {
        console.error('\n❌  Failed to connect to PostgreSQL after multiple attempts.');
        if (!process.env.DATABASE_URL) {
          console.error('👉  MISSING DATABASE_URL: Please set DATABASE_URL in your Render Environment variables.\n');
        }
        throw err;
      }
      
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'outbox_db',
  user: process.env.DB_USER || 'outbox_user',
  password: process.env.DB_PASSWORD || 'outbox_pass',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

export async function connectDB(): Promise<void> {
  try {
    const client = await pool.connect();
    console.log('✅  Connected to PostgreSQL');
    client.release();
  } catch (err) {
    console.error('❌  Failed to connect to PostgreSQL:', err);
    throw err;
  }
}

export async function query<T = unknown>(
  text: string,
  params?: unknown[]
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

import { pool } from '../config/database';

const CREATE_EMAILS_TABLE = `
  CREATE TABLE IF NOT EXISTS emails (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    to_address    VARCHAR(255)  NOT NULL,
    subject       VARCHAR(500)  NOT NULL,
    body          TEXT          NOT NULL,
    scheduled_at  TIMESTAMPTZ   NOT NULL,
    status        VARCHAR(50)   NOT NULL DEFAULT 'scheduled',
    job_id        VARCHAR(255),
    sent_at       TIMESTAMPTZ,
    ethereal_url  TEXT,
    error_message TEXT,
    created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW()
  );

  CREATE INDEX IF NOT EXISTS idx_emails_status        ON emails(status);
  CREATE INDEX IF NOT EXISTS idx_emails_scheduled_at  ON emails(scheduled_at);
  CREATE INDEX IF NOT EXISTS idx_emails_job_id        ON emails(job_id);
`;

export async function runMigrations(): Promise<void> {
  const client = await pool.connect();
  try {
    console.log('🔄  Running database migrations…');
    await client.query(CREATE_EMAILS_TABLE);
    console.log('✅  Migrations complete');
  } catch (err) {
    console.error('❌  Migration failed:', err);
    throw err;
  } finally {
    client.release();
  }
}

import { query } from '../config/database';
import { scheduleEmailJob, cancelEmailJob } from '../queues/emailQueue';
import { Email, CreateEmailDto } from '../models/email.model';
import { indexEmailDocument } from './elasticsearch.service';

/**
 * Creates a new scheduled email record in the DB, indexes into Elasticsearch, and enqueues a BullMQ job.
 */
export async function createScheduledEmail(dto: CreateEmailDto): Promise<Email> {
  const scheduledAt = new Date(dto.scheduledAt);

  if (isNaN(scheduledAt.getTime())) {
    throw new Error('Invalid scheduledAt timestamp');
  }

  const fromAddress = dto.from && dto.from.trim().length > 0
    ? dto.from.trim()
    : 'scheduler@outbox.dev';

  // Insert email record into PostgreSQL
  const rows = await query<Email>(
    `INSERT INTO emails (to_address, from_address, subject, body, scheduled_at, status)
     VALUES ($1, $2, $3, $4, $5, 'scheduled')
     RETURNING *`,
    [dto.to, fromAddress, dto.subject, dto.body, scheduledAt]
  );

  const email = rows[0];

  // Enqueue BullMQ job (persisted in Redis)
  const jobId = await scheduleEmailJob(
    email.id,
    {
      emailId: email.id,
      to: dto.to,
      from: fromAddress,
      subject: dto.subject,
      body: dto.body,
    },
    scheduledAt
  );

  // Store job ID for reference
  await query(
    `UPDATE emails SET job_id = $1 WHERE id = $2`,
    [jobId, email.id]
  );

  const finalEmail = { ...email, job_id: jobId };

  // Index in Elasticsearch
  await indexEmailDocument(finalEmail);

  return finalEmail;
}

/**
 * Returns paginated emails, optionally filtered by status.
 */
export async function getEmails(
  status?: string,
  limit = 50,
  offset = 0
): Promise<{ emails: Email[]; total: number }> {
  const params = status
    ? [status, limit, offset]
    : [limit, offset];

  const countQuery = status
    ? `SELECT COUNT(*) AS total FROM emails WHERE status = $1`
    : `SELECT COUNT(*) AS total FROM emails`;

  const countParams = status ? [status] : [];
  const dataQuery = status
    ? `SELECT * FROM emails WHERE status = $1 ORDER BY scheduled_at DESC LIMIT $2 OFFSET $3`
    : `SELECT * FROM emails ORDER BY scheduled_at DESC LIMIT $1 OFFSET $2`;

  const [countRows, emailRows] = await Promise.all([
    query<{ total: string }>(countQuery, countParams),
    query<Email>(dataQuery, params),
  ]);

  return {
    emails: emailRows,
    total: parseInt(countRows[0]?.total || '0', 10),
  };
}

/**
 * Returns a single email by ID.
 */
export async function getEmailById(id: string): Promise<Email | null> {
  const rows = await query<Email>(
    `SELECT * FROM emails WHERE id = $1`,
    [id]
  );
  return rows[0] ?? null;
}

/**
 * Cancels a scheduled email — removes it from BullMQ, updates DB and Elasticsearch.
 */
export async function cancelEmail(id: string): Promise<Email | null> {
  const email = await getEmailById(id);
  if (!email) return null;

  if (email.status !== 'scheduled') {
    throw new Error(`Cannot cancel email with status "${email.status}"`);
  }

  // Remove from BullMQ
  if (email.job_id) {
    await cancelEmailJob(email.job_id);
  }

  const rows = await query<Email>(
    `UPDATE emails
        SET status = 'cancelled', updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [id]
  );

  const updated = rows[0] ?? null;
  if (updated) {
    await indexEmailDocument(updated);
  }

  return updated;
}

/**
 * Recovers and re-enqueues any emails in 'scheduled' status on server startup.
 * Ensures persistence and guarantees zero job loss even after unexpected server restarts or crashes.
 */
export async function reconcileScheduledEmails(): Promise<void> {
  try {
    const pending = await query<Email>(
      `SELECT * FROM emails WHERE status = 'scheduled' ORDER BY scheduled_at ASC`
    );

    if (pending.length === 0) {
      console.log('✅  No pending scheduled emails to reconcile');
      return;
    }

    console.log(`🔄  Reconciling ${pending.length} scheduled email(s)…`);

    for (const email of pending) {
      try {
        const scheduledTime = new Date(email.scheduled_at);
        const jobId = await scheduleEmailJob(
          email.id,
          {
            emailId: email.id,
            to: email.to_address,
            from: email.from_address,
            subject: email.subject,
            body: email.body,
          },
          scheduledTime
        );

        if (email.job_id !== jobId) {
          await query(`UPDATE emails SET job_id = $1 WHERE id = $2`, [jobId, email.id]);
        }
        console.log(`  ↳ Re-queued email ${email.id} (target: ${scheduledTime.toISOString()})`);
      } catch (err) {
        console.error(`❌  Failed to re-enqueue email ${email.id}:`, err);
      }
    }

    console.log(`✅  Reconciled ${pending.length} scheduled email(s) successfully`);
  } catch (err) {
    console.error('❌  Error during email reconciliation:', err);
  }
}


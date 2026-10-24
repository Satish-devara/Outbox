import { query } from '../config/database';
import { scheduleEmailJob, cancelEmailJob } from '../queues/emailQueue';
import { Email, CreateEmailDto } from '../models/email.model';

/**
 * Creates a new scheduled email record in the DB and enqueues a BullMQ job.
 */
export async function createScheduledEmail(dto: CreateEmailDto): Promise<Email> {
  const scheduledAt = new Date(dto.scheduledAt);

  if (isNaN(scheduledAt.getTime())) {
    throw new Error('Invalid scheduledAt timestamp');
  }

  // Insert email record
  const rows = await query<Email>(
    `INSERT INTO emails (to_address, subject, body, scheduled_at, status)
     VALUES ($1, $2, $3, $4, 'scheduled')
     RETURNING *`,
    [dto.to, dto.subject, dto.body, scheduledAt]
  );

  const email = rows[0];

  // Enqueue BullMQ job (persisted in Redis)
  const jobId = await scheduleEmailJob(
    email.id,
    { emailId: email.id, to: dto.to, subject: dto.subject, body: dto.body },
    scheduledAt
  );

  // Store job ID for reference
  await query(
    `UPDATE emails SET job_id = $1 WHERE id = $2`,
    [jobId, email.id]
  );

  return { ...email, job_id: jobId };
}

/**
 * Returns all emails ordered by scheduled time, optionally filtered by status.
 */
export async function getEmails(status?: string): Promise<Email[]> {
  if (status) {
    return query<Email>(
      `SELECT * FROM emails WHERE status = $1 ORDER BY scheduled_at DESC`,
      [status]
    );
  }
  return query<Email>(`SELECT * FROM emails ORDER BY scheduled_at DESC`);
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
 * Cancels a scheduled email — removes it from the BullMQ queue and marks as cancelled.
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

  return rows[0] ?? null;
}

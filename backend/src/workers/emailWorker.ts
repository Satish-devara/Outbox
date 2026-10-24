import { Worker, Job } from 'bullmq';
import { getRedisClient } from '../config/redis';
import { QUEUE_NAME } from '../queues/emailQueue';
import { sendEmail } from '../services/smtp.service';
import { query } from '../config/database';
import { EmailJobData } from '../models/email.model';

let worker: Worker<EmailJobData> | null = null;

/**
 * Processes each email job:
 * 1. Sends the email via Ethereal fake SMTP
 * 2. Updates the DB record with status = 'sent' and the Ethereal preview URL
 *
 * On failure, BullMQ retries with exponential back-off (configured in queue).
 * After max attempts, the job is moved to the failed set (still visible in Redis).
 */
async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailId, to, subject, body } = job.data;

  console.log(`⚙️   Processing job ${job.id} → email ${emailId}`);

  try {
    // Send via Ethereal SMTP
    const { messageId, previewUrl } = await sendEmail(to, subject, body);

    // Update DB record
    await query(
      `UPDATE emails
          SET status = 'sent',
              sent_at = NOW(),
              ethereal_url = $1,
              updated_at = NOW()
        WHERE id = $2`,
      [previewUrl, emailId]
    );

    console.log(`✅  Email ${emailId} sent — preview: ${previewUrl}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`❌  Failed to send email ${emailId}:`, errorMessage);

    // Mark as failed in DB if we've exhausted all retries
    if (job.attemptsMade >= (job.opts.attempts ?? 1) - 1) {
      await query(
        `UPDATE emails
            SET status = 'failed',
                error_message = $1,
                updated_at = NOW()
          WHERE id = $2`,
        [errorMessage, emailId]
      );
    }

    throw err; // Re-throw so BullMQ can retry
  }
}

/**
 * Starts the BullMQ worker that listens on the email-scheduler queue.
 * The worker survives server restarts because BullMQ persists jobs in Redis.
 * On startup the worker will automatically pick up any delayed/waiting jobs.
 */
export function startEmailWorker(): void {
  if (worker) return;

  worker = new Worker<EmailJobData>(QUEUE_NAME, processEmailJob, {
    connection: getRedisClient(),
    concurrency: 5, // Process up to 5 emails simultaneously
  });

  worker.on('completed', (job) => {
    console.log(`🎉  Job ${job.id} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`💀  Job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log(`✅  Email worker started (concurrency: 5) — listening on "${QUEUE_NAME}"`);
}

export async function stopEmailWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('Worker stopped');
  }
}

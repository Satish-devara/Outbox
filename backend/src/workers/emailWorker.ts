import { Worker, Job } from 'bullmq';
import { createRedisClient } from '../config/redis';
import { QUEUE_NAME } from '../queues/emailQueue';
import { sendEmail } from '../services/smtp.service';
import { query } from '../config/database';
import { Email, EmailJobData } from '../models/email.model';
import { indexEmailDocument } from '../services/elasticsearch.service';

let worker: Worker<EmailJobData> | null = null;

// Configurable concurrency level (defaults to 5 parallel jobs)
export const WORKER_CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

// Configurable provider throttling: minimum delay between individual email sends (ms)
export const MIN_SEND_DELAY_MS = parseInt(process.env.MIN_SEND_DELAY_MS || '1000', 10);

/**
 * Processes each email job:
 * 1. Simulates provider throttling (minimum delay between email sends)
 * 2. Sends the email via Ethereal fake SMTP (with custom sender support)
 * 3. Updates the PostgreSQL DB record with status = 'sent' and Ethereal preview URL
 * 4. Indexes the updated email state into Elasticsearch for instant search
 *
 * On failure, BullMQ retries with exponential back-off (configured in queue).
 * After max attempts, the job is moved to failed state in DB and Elasticsearch.
 */
async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { emailId, to, from, subject, body } = job.data;

  console.log(`⚙️   [Worker Concurrency Active] Processing job ${job.id} → email ${emailId}`);

  // Provider throttling: minimum delay between email sends
  if (MIN_SEND_DELAY_MS > 0) {
    console.log(`⏱️   Applying provider throttle delay (${MIN_SEND_DELAY_MS}ms) for email ${emailId}…`);
    await new Promise((resolve) => setTimeout(resolve, MIN_SEND_DELAY_MS));
  }

  try {
    // Send via Ethereal SMTP with multiple sender support
    const { messageId, previewUrl } = await sendEmail(to, subject, body, from);

    // Update DB record
    const rows = await query<Email>(
      `UPDATE emails
          SET status = 'sent',
              sent_at = NOW(),
              ethereal_url = $1,
              updated_at = NOW()
        WHERE id = $2
        RETURNING *`,
      [previewUrl, emailId]
    );

    const updated = rows[0];
    if (updated) {
      // Sync update to Elasticsearch
      await indexEmailDocument(updated);
    }

    console.log(`✅  Email ${emailId} successfully sent from ${from || 'default'} to ${to} — preview: ${previewUrl}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`❌  Failed to send email ${emailId}:`, errorMessage);

    // Mark as failed in DB if we've exhausted all retries
    if (job.attemptsMade >= (job.opts.attempts ?? 1) - 1) {
      const rows = await query<Email>(
        `UPDATE emails
            SET status = 'failed',
                error_message = $1,
                updated_at = NOW()
          WHERE id = $2
          RETURNING *`,
        [errorMessage, emailId]
      );
      const updated = rows[0];
      if (updated) {
        await indexEmailDocument(updated);
      }
    }

    throw err; // Re-throw so BullMQ can trigger exponential backoff retry
  }
}

/**
 * Starts the BullMQ worker that listens on the email-scheduler queue.
 * Configured with configurable concurrency and Redis persistence.
 */
export function startEmailWorker(): void {
  if (worker) return;

  worker = new Worker<EmailJobData>(QUEUE_NAME, processEmailJob, {
    connection: createRedisClient(),
    concurrency: WORKER_CONCURRENCY,
    limiter: {
      max: 10,
      duration: 5000, // Maximum 10 jobs per 5 seconds queue-wide
    },
  });

  worker.on('completed', (job) => {
    console.log(`🎉  Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`💀  Job ${job?.id} failed after ${job?.attemptsMade} attempts:`, err.message);
  });

  worker.on('error', (err) => {
    console.error('Worker error:', err);
  });

  console.log(`✅  Email worker started [concurrency: ${WORKER_CONCURRENCY}, throttle: ${MIN_SEND_DELAY_MS}ms] — queue: "${QUEUE_NAME}"`);
}

export async function stopEmailWorker(): Promise<void> {
  if (worker) {
    await worker.close();
    worker = null;
    console.log('Worker stopped');
  }
}

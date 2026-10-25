import { Queue } from 'bullmq';
import { createRedisClient } from '../config/redis';
import { EmailJobData } from '../models/email.model';

export const QUEUE_NAME = 'email-scheduler';

let emailQueue: Queue<EmailJobData> | null = null;

/**
 * Returns a singleton BullMQ Queue instance.
 * BullMQ persists jobs in Redis so they survive server restarts.
 */
export function getEmailQueue(): Queue<EmailJobData> {
  if (!emailQueue) {
    emailQueue = new Queue<EmailJobData>(QUEUE_NAME, {
      connection: createRedisClient(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
        removeOnComplete: {
          age: 7 * 24 * 3600, // keep completed jobs for 7 days
          count: 1000,
        },
        removeOnFail: {
          age: 30 * 24 * 3600, // keep failed jobs for 30 days
        },
      },
    });

    console.log(`✅  BullMQ queue "${QUEUE_NAME}" initialized`);
  }
  return emailQueue;
}

/**
 * Schedules an email job with a delay based on the target send time.
 * Returns the BullMQ Job ID.
 */
export async function scheduleEmailJob(
  emailId: string,
  data: EmailJobData,
  scheduledAt: Date
): Promise<string> {
  const queue = getEmailQueue();
  const now = Date.now();
  const delay = Math.max(0, scheduledAt.getTime() - now);

  // If a previous job with this ID already exists, remove it so fresh options take effect
  try {
    const existing = await queue.getJob(emailId);
    if (existing) {
      await existing.remove();
      console.log(`🧹  Removed existing BullMQ job ${emailId} for clean re-queue`);
    }
  } catch {
    // Non-fatal if job not found
  }

  const job = await queue.add(`send-email-${emailId}`, data, {
    delay,
    jobId: emailId, // Use emailId as jobId for idempotency
  });

  console.log(
    `📅  Job ${job.id} queued — delay: ${Math.round(delay / 1000)}s (fires at ${scheduledAt.toISOString()})`
  );

  return job.id!;
}

/**
 * Cancels a scheduled email job by removing it from the queue.
 */
export async function cancelEmailJob(jobId: string): Promise<boolean> {
  const queue = getEmailQueue();
  const job = await queue.getJob(jobId);
  if (!job) return false;

  await job.remove();
  console.log(`🗑   Job ${jobId} removed from queue`);
  return true;
}

/**
 * Returns queue stats for monitoring with timeout fallback.
 */
export async function getQueueStats() {
  const queue = getEmailQueue();

  try {
    const statsPromise = Promise.all([
      queue.getWaitingCount(),
      queue.getDelayedCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
    ]);

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Queue stats query timed out')), 2500)
    );

    const [waiting, delayed, active, completed, failed] = await Promise.race([
      statsPromise,
      timeoutPromise,
    ]);

    return { waiting, delayed, active, completed, failed };
  } catch (err) {
    console.warn('⚠️  Could not fetch live queue counts:', (err as Error).message);
    return { waiting: 0, delayed: 0, active: 0, completed: 0, failed: 0 };
  }
}

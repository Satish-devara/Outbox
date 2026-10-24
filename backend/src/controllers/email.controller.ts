import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createScheduledEmail,
  getEmails,
  getEmailById,
  cancelEmail,
} from '../services/email.service';
import { getQueueStats } from '../queues/emailQueue';

// ─── Validation schemas ───────────────────────────────────────────────────────

const scheduleEmailSchema = z.object({
  to: z.string().email('Invalid recipient email address'),
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required'),
  scheduledAt: z.string().refine((v) => !isNaN(Date.parse(v)), {
    message: 'scheduledAt must be a valid ISO 8601 date string',
  }),
});

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /api/emails
 * Schedule a new email
 */
export async function scheduleEmail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const parsed = scheduleEmailSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const scheduledAt = new Date(parsed.data.scheduledAt);
    if (scheduledAt <= new Date()) {
      res.status(400).json({ error: 'scheduledAt must be a future date/time' });
      return;
    }

    const email = await createScheduledEmail(parsed.data);
    res.status(201).json({ success: true, data: email });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/emails
 * List all emails (optionally filtered by ?status=scheduled|sent|failed|cancelled)
 */
export async function listEmails(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { status } = req.query;
    const validStatuses = ['scheduled', 'sent', 'failed', 'cancelled'];
    const statusFilter =
      typeof status === 'string' && validStatuses.includes(status)
        ? status
        : undefined;

    const emails = await getEmails(statusFilter);
    res.json({ success: true, data: emails, count: emails.length });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/emails/:id
 * Get a single email by ID
 */
export async function getEmail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const email = await getEmailById(req.params.id);
    if (!email) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }
    res.json({ success: true, data: email });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/emails/:id
 * Cancel a scheduled email
 */
export async function deleteEmail(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const email = await cancelEmail(req.params.id);
    if (!email) {
      res.status(404).json({ error: 'Email not found' });
      return;
    }
    res.json({ success: true, data: email, message: 'Email cancelled successfully' });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('Cannot cancel')) {
      res.status(409).json({ error: err.message });
      return;
    }
    next(err);
  }
}

/**
 * GET /api/queue/stats
 * Queue health + stats
 */
export async function queueStats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const stats = await getQueueStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

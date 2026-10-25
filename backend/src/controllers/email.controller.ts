import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
  createScheduledEmail,
  getEmails,
  getEmailById,
  cancelEmail,
} from '../services/email.service';
import { searchEmailsIndex } from '../services/elasticsearch.service';
import { getQueueStats } from '../queues/emailQueue';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUUID(id: string): boolean {
  return UUID_REGEX.test(id);
}

// ─── Validation schemas ───────────────────────────────────────────────────────

const scheduleEmailSchema = z.object({
  to: z.string().email('Invalid recipient email address'),
  from: z.string().min(3).max(255).optional(), // Multiple senders support
  subject: z.string().min(1, 'Subject is required').max(500),
  body: z.string().min(1, 'Body is required').max(100_000),
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
        success: false,
        error: 'Validation failed',
        details: parsed.error.flatten().fieldErrors,
      });
      return;
    }

    const scheduledAt = new Date(parsed.data.scheduledAt);
    if (scheduledAt <= new Date()) {
      res.status(400).json({
        success: false,
        error: 'scheduledAt must be a future date/time',
      });
      return;
    }

    const email = await createScheduledEmail(parsed.data);
    res.status(201).json({ success: true, data: email });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/emails/search
 * Full-text search emails across subject, body, to_address, and from_address via Elasticsearch
 */
export async function searchEmails(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const q = String(req.query.q || '');
    const status = req.query.status ? String(req.query.status) : undefined;
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit || '50'), 10)));

    const result = await searchEmailsIndex(q, status, limit);

    res.json({
      success: true,
      data: result.emails,
      meta: {
        total: result.total,
        query: q,
        status,
        limit,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/emails
 * List all emails (optionally filtered by ?status=scheduled|sent|failed|cancelled)
 * Supports ?page=1&limit=20 pagination
 */
export async function listEmails(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { status, page, limit } = req.query;
    const validStatuses = ['scheduled', 'sent', 'failed', 'cancelled'];
    const statusFilter =
      typeof status === 'string' && validStatuses.includes(status)
        ? status
        : undefined;

    const pageNum = Math.max(1, parseInt(String(page || '1'), 10));
    const limitNum = Math.min(100, Math.max(1, parseInt(String(limit || '50'), 10)));
    const offset = (pageNum - 1) * limitNum;

    const { emails, total } = await getEmails(statusFilter, limitNum, offset);

    res.json({
      success: true,
      data: emails,
      meta: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum),
      },
    });
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
    if (!isValidUUID(req.params.id)) {
      res.status(400).json({ success: false, error: 'Invalid email ID format' });
      return;
    }

    const email = await getEmailById(req.params.id);
    if (!email) {
      res.status(404).json({ success: false, error: 'Email not found' });
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
    if (!isValidUUID(req.params.id)) {
      res.status(400).json({ success: false, error: 'Invalid email ID format' });
      return;
    }

    const email = await cancelEmail(req.params.id);
    if (!email) {
      res.status(404).json({ success: false, error: 'Email not found' });
      return;
    }
    res.json({
      success: true,
      data: email,
      message: 'Email cancelled successfully',
    });
  } catch (err: unknown) {
    if (err instanceof Error && err.message.startsWith('Cannot cancel')) {
      res.status(409).json({ success: false, error: err.message });
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

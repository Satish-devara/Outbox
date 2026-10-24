import { Router } from 'express';
import {
  scheduleEmail,
  listEmails,
  getEmail,
  deleteEmail,
  queueStats,
} from '../controllers/email.controller';

const router = Router();

// Email CRUD
router.post('/emails', scheduleEmail);
router.get('/emails', listEmails);
router.get('/emails/:id', getEmail);
router.delete('/emails/:id', deleteEmail);

// Queue monitoring
router.get('/queue/stats', queueStats);

export default router;

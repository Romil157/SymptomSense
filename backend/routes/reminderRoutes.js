import { Router } from 'express';
import { triggerReminders } from '../controllers/reminderController.js';
import { authenticateRequest } from '../middlewares/authenticate.js';
import { aiLimiter } from '../middlewares/rateLimiters.js';
import { validate } from '../middlewares/validate.js';
import { reminderTriggerSchema } from '../schemas/medicationSchemas.js';

const router = Router();

router.post('/reminders/trigger', authenticateRequest, aiLimiter, validate(reminderTriggerSchema), triggerReminders);

export default router;

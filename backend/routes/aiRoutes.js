import { Router } from 'express';
import { createAiInsight } from '../controllers/aiInsightsController.js';
import { createMedicationEducation } from '../controllers/medicationEducationController.js';
import { authenticateRequest } from '../middlewares/authenticate.js';
import { aiLimiter } from '../middlewares/rateLimiters.js';
import { validate } from '../middlewares/validate.js';
import { aiInsightsSchema, medicationEducationSchema } from '../schemas/analysisSchemas.js';

const router = Router();

router.post('/ai-insights', authenticateRequest, aiLimiter, validate(aiInsightsSchema), createAiInsight);
router.post(
  '/medication-education',
  authenticateRequest,
  aiLimiter,
  validate(medicationEducationSchema),
  createMedicationEducation
);

export default router;

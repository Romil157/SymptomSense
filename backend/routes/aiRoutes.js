import { Router } from 'express';
import { createAiInsight } from '../controllers/aiInsightsController.js';
import { authenticateRequest } from '../middlewares/authenticate.js';
import { aiLimiter } from '../middlewares/rateLimiters.js';
import { validate } from '../middlewares/validate.js';
import { aiInsightsSchema } from '../schemas/analysisSchemas.js';

const router = Router();

router.post('/ai-insights', authenticateRequest, aiLimiter, validate(aiInsightsSchema), createAiInsight);

export default router;

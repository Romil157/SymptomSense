import { Router } from 'express';
import { analyzeSymptoms } from '../controllers/analysisController.js';
import { authenticateRequest } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { analyzeSymptomsSchema } from '../schemas/analysisSchemas.js';

const router = Router();

router.post('/analyze-symptoms', authenticateRequest, validate(analyzeSymptomsSchema), analyzeSymptoms);

export default router;

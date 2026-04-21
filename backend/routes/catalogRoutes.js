import { Router } from 'express';
import { listSymptoms } from '../controllers/catalogController.js';
import { authenticateRequest } from '../middlewares/authenticate.js';

const router = Router();

router.get('/symptoms', authenticateRequest, listSymptoms);

export default router;

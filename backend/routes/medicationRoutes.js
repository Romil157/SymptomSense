import { Router } from 'express';
import { createMedication, deleteMedication, listMedications } from '../controllers/medicationController.js';
import { authenticateRequest } from '../middlewares/authenticate.js';
import { validate } from '../middlewares/validate.js';
import { medicationIdParamSchema, medicationScheduleSchema } from '../schemas/medicationSchemas.js';

const router = Router();

router.get('/medications', authenticateRequest, listMedications);
router.post('/medications', authenticateRequest, validate(medicationScheduleSchema), createMedication);
router.delete('/medications/:medicationId', authenticateRequest, validate(medicationIdParamSchema, 'params'), deleteMedication);

export default router;

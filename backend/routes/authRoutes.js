import { Router } from 'express';
import { login } from '../controllers/authController.js';
import { authLimiter } from '../middlewares/rateLimiters.js';
import { validate } from '../middlewares/validate.js';
import { loginSchema } from '../schemas/authSchemas.js';

const router = Router();

router.post('/login', authLimiter, validate(loginSchema), login);

export default router;

import { Router } from 'express';
import aiRoutes from './aiRoutes.js';
import analysisRoutes from './analysisRoutes.js';
import authRoutes from './authRoutes.js';
import catalogRoutes from './catalogRoutes.js';
import healthRoutes from './healthRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/catalog', catalogRoutes);
router.use('/', analysisRoutes);
router.use('/', aiRoutes);

export default router;

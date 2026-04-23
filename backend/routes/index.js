import { Router } from 'express';
import aiRoutes from './aiRoutes.js';
import analysisRoutes from './analysisRoutes.js';
import authRoutes from './authRoutes.js';
import catalogRoutes from './catalogRoutes.js';
import healthRoutes from './healthRoutes.js';
import medicationRoutes from './medicationRoutes.js';
import reminderRoutes from './reminderRoutes.js';

const router = Router();

router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/catalog', catalogRoutes);
router.use('/', analysisRoutes);
router.use('/', aiRoutes);
router.use('/', medicationRoutes);
router.use('/', reminderRoutes);

export default router;

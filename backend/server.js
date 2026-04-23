import { createApp } from './app.js';
import { config, validateRuntimeConfig } from './config/env.js';
import { logger } from './config/logger.js';
import { warmDatasetCache } from './services/dataset/datasetService.js';
import { startReminderScheduler, stopReminderScheduler } from './services/reminders/reminderScheduler.js';

async function startServer() {
  validateRuntimeConfig();
  await warmDatasetCache();

  const app = createApp();
  const server = app.listen(config.port, () => {
    logger.info('SymptomSense backend is listening.', {
      port: config.port,
      environment: config.env,
    });
  });
  startReminderScheduler();

  const shutdown = (signal) => {
    logger.info('Shutting down SymptomSense backend.', { signal });
    stopReminderScheduler();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

startServer().catch((error) => {
  logger.error('Failed to start SymptomSense backend.', { error });
  process.exit(1);
});

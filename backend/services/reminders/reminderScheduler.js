import { config } from '../../config/env.js';
import { logger } from '../../config/logger.js';
import { runReminderCheck } from './reminderEngine.js';

let reminderIntervalHandle = null;

async function executeReminderTick() {
  try {
    await runReminderCheck();
  } catch (error) {
    logger.error('Medication reminder scheduler tick failed.', { error });
  }
}

export function startReminderScheduler() {
  if (reminderIntervalHandle) {
    return reminderIntervalHandle;
  }

  reminderIntervalHandle = setInterval(executeReminderTick, config.reminderCheckIntervalMs);
  reminderIntervalHandle.unref?.();

  executeReminderTick();
  logger.info('Medication reminder scheduler started.', {
    intervalMs: config.reminderCheckIntervalMs,
    dueWindowMinutes: config.reminderDueWindowMinutes,
  });

  return reminderIntervalHandle;
}

export function stopReminderScheduler() {
  if (!reminderIntervalHandle) {
    return;
  }

  clearInterval(reminderIntervalHandle);
  reminderIntervalHandle = null;
  logger.info('Medication reminder scheduler stopped.');
}

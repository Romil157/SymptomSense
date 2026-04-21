import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../../config/env.js';
import { logger } from '../../config/logger.js';

export async function writeAuditLog(entry) {
  const record = {
    timestamp: new Date().toISOString(),
    ...entry,
  };

  try {
    await fs.mkdir(path.dirname(config.auditLogFile), { recursive: true });
    await fs.appendFile(config.auditLogFile, `${JSON.stringify(record)}\n`, 'utf8');
  } catch (error) {
    logger.error('Failed to write audit log record.', {
      message: error.message,
      auditLogFile: config.auditLogFile,
    });
  }
}

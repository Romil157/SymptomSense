import path from 'node:path';
import 'dotenv/config';

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function resolvePath(value, fallbackRelativePath) {
  const target = value || fallbackRelativePath;
  return path.isAbsolute(target) ? target : path.join(process.cwd(), target);
}

function parseOrigins(value) {
  return String(value || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const config = Object.freeze({
  env: process.env.NODE_ENV || 'development',
  isProduction: (process.env.NODE_ENV || 'development') === 'production',
  port: parseNumber(process.env.PORT, 4000),
  clientOrigins: parseOrigins(
    process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:4173,http://localhost:3000'
  ),
  jwtSecret:
    process.env.JWT_SECRET || 'change-this-to-a-long-random-secret-with-at-least-32-characters',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  authEmail: process.env.AUTH_EMAIL || 'clinician@symptomsense.local',
  authPassword: process.env.AUTH_PASSWORD || 'StrongPassword123!',
  aiProvider: (process.env.AI_PROVIDER || 'fallback').toLowerCase(),
  nvidiaApiKey: process.env.NVIDIA_API_KEY || '',
  nvidiaModel: process.env.NVIDIA_MODEL || 'google/gemma-4-31b-it',
  anthropicApiKey: process.env.ANTHROPIC_API_KEY || '',
  anthropicModel: process.env.ANTHROPIC_MODEL || 'claude-3-5-sonnet-latest',
  apiRateLimitWindowMs: parseNumber(process.env.API_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000),
  apiRateLimitMax: parseNumber(process.env.API_RATE_LIMIT_MAX, 120),
  authRateLimitMax: parseNumber(process.env.AUTH_RATE_LIMIT_MAX, 10),
  aiRateLimitMax: parseNumber(process.env.AI_RATE_LIMIT_MAX, 25),
  analysisCacheTtlMs: parseNumber(process.env.ANALYSIS_CACHE_TTL_MS, 5 * 60 * 1000),
  aiCacheTtlMs: parseNumber(process.env.AI_CACHE_TTL_MS, 30 * 60 * 1000),
  aiRequestTimeoutMs: parseNumber(process.env.AI_REQUEST_TIMEOUT_MS, 30 * 1000),
  auditLogFile: resolvePath(process.env.AUDIT_LOG_FILE, path.join('backend', 'logs', 'audit.log')),
  medicationStoreFile: resolvePath(
    process.env.MEDICATION_STORE_FILE,
    path.join('backend', 'data', 'medications.runtime.json')
  ),
  reminderCheckIntervalMs: parseNumber(process.env.REMINDER_CHECK_INTERVAL_MS, 60 * 1000),
  reminderDueWindowMinutes: parseNumber(process.env.REMINDER_DUE_WINDOW_MINUTES, 30),
  datasetPath: resolvePath(process.env.DATASET_PATH, path.join('public', 'cleaned_dataset.csv')),
  mlModelPath: resolvePath(process.env.ML_MODEL_PATH, path.join('backend', 'ml-model', 'model.json')),
});

export function validateRuntimeConfig() {
  if (config.isProduction && config.jwtSecret.includes('change-this')) {
    throw new Error('JWT_SECRET must be set to a non-default value in production.');
  }

  if (config.isProduction && config.authPassword === 'StrongPassword123!') {
    throw new Error('AUTH_PASSWORD must be changed before running in production.');
  }

  if (config.reminderCheckIntervalMs < 1_000) {
    throw new Error('REMINDER_CHECK_INTERVAL_MS must be at least 1000 milliseconds.');
  }

  if (config.reminderDueWindowMinutes < 1 || config.reminderDueWindowMinutes > 240) {
    throw new Error('REMINDER_DUE_WINDOW_MINUTES must be between 1 and 240.');
  }
}

import { defineConfig } from '@playwright/test';

const appEnv = {
  ...process.env,
  NODE_ENV: 'test',
  PORT: '4000',
  CLIENT_ORIGIN: 'http://127.0.0.1:4173',
  JWT_SECRET: 'symptomsense-test-secret-key',
  AUTH_EMAIL: 'clinician@symptomsense.local',
  AUTH_PASSWORD: 'StrongPassword123!',
  AI_PROVIDER: 'fallback',
  MEDICATION_STORE_FILE: 'backend/data/playwright-medications.runtime.json',
  REMINDER_CHECK_INTERVAL_MS: '60000',
  REMINDER_DUE_WINDOW_MINUTES: '30',
};

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
  },
  webServer: [
    {
      command: 'node backend/server.js',
      url: 'http://127.0.0.1:4000/api/health',
      reuseExistingServer: !process.env.CI,
      env: appEnv,
    },
    {
      command: 'node ./node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4173',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: !process.env.CI,
      env: {
        ...process.env,
        VITE_API_BASE_URL: '/api',
      },
    },
  ],
});

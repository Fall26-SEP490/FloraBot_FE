import { defineConfig } from '@playwright/test';

// Opt-in only: connects the running FE to the configured deployed BE. No mocked routes.
export default defineConfig({
  testDir: './tests/deployed',
  workers: 1,
  retries: 0,
  timeout: 90_000,
  outputDir: './test-results/deployed',
  use: {
    baseURL: process.env.LIVE_WEB_ORIGIN || 'http://localhost:8088',
    channel: 'chrome',
    viewport: { width: 390, height: 900 },
    trace: 'off',
    video: 'off',
  },
});

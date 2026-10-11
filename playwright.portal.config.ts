import { defineConfig } from '@playwright/test';

const testPort = process.env.TEST_PORT || process.env.PORT || '3010';
const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL || `http://127.0.0.1:${testPort}`;
const reuseExistingServer =
  process.env.REUSE_EXISTING_SERVER !== undefined
    ? process.env.REUSE_EXISTING_SERVER === 'true'
    : !process.env.CI && testPort === '3010';

export default defineConfig({
  testDir: './tests/portal',
  outputDir: './test-results/portal',
  use: { baseURL, trace: 'retain-on-failure' },
  webServer: {
    command:
      testPort === '3010'
        ? 'pnpm --filter @florabot/web start'
        : `pnpm --filter @florabot/web exec next start --hostname 127.0.0.1 --port ${testPort}`,
    url: baseURL,
    reuseExistingServer,
    env: {
      ...(process.env.API_PROXY_TARGET ? { API_PROXY_TARGET: process.env.API_PROXY_TARGET } : {}),
    },
  },
});

import { defineConfig } from '@playwright/test';
const origin = 'http://127.0.0.1:9473';
export default defineConfig({
  testDir: './tests/browser',
  testMatch: ['landing-live-api.spec.ts', 'landing.spec.ts', 'landing-keyboard.spec.ts'],
  outputDir: './test-results/landing-api',
  workers: 1,
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3034',
    channel: 'chrome',
    trace: 'off',
    screenshot: 'only-on-failure',
  },
  reporter: [['list']],
  webServer: [
    {
      command: 'node tests/fixtures/landing-api-server.mjs',
      url: `${origin}/health`,
      reuseExistingServer: false,
    },
    {
      command: 'pnpm --filter @florabot/web exec next start --hostname 127.0.0.1 --port 3034',
      url: 'http://127.0.0.1:3034',
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: origin },
    },
  ],
});

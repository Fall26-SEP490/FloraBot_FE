import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/portal',
  outputDir: './test-results/portal',
  use: { baseURL: 'http://127.0.0.1:5173', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm --filter @florabot/portal dev',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
});

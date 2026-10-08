import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/portal',
  outputDir: './test-results/portal',
  use: { baseURL: 'http://127.0.0.1:3010', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm --filter @florabot/web start',
    url: 'http://127.0.0.1:3010',
    reuseExistingServer: !process.env.CI,
  },
});

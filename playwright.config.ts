import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:3010', trace: 'retain-on-failure' },
  webServer: {
    command: 'pnpm --filter @florabot/web start',
    url: 'http://127.0.0.1:3010',
    reuseExistingServer: !process.env.CI,
  },
  reporter: [['list'], ['html', { open: 'never' }]],
});

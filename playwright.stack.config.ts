import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/stack',
  use: { baseURL: 'http://localhost:8088', trace: 'off', video: 'off' },
  reporter: 'list',
});

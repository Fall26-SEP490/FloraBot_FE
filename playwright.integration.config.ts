import { defineConfig } from '@playwright/test';
import { randomBytes } from 'node:crypto';
const signingKey = randomBytes(32).toString('hex');

export default defineConfig({
  testDir: './tests/integration',
  outputDir: './test-results/integration',
  workers: 1,
  timeout: 90_000,
  // Credentials and auth cookies must not be captured in browser trace artifacts.
  use: { baseURL: 'http://127.0.0.1:5183', trace: 'off', screenshot: 'off', video: 'off' },
  webServer: [
    {
      command:
        'dotnet run --project ../BE/src/FloraBot.Api --no-launch-profile --urls http://127.0.0.1:5081',
      url: 'http://127.0.0.1:5081/health',
      reuseExistingServer: false,
      timeout: 90_000,
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        DATABASE_URL:
          'Host=localhost;Port=55436;Database=florabot_browser_tests;Username=florabot;Password=local-florabot-only',
        VALKEY_URL: 'localhost:56379',
        JOBS_ENABLED: 'false',
        JWT_SIGNING_KEY: signingKey,
        ALLOWED_ORIGINS: 'http://127.0.0.1:4331,http://127.0.0.1:5183',
        PAYOS_CLIENT_ID: '',
        PAYOS_API_KEY: '',
        PAYOS_CHECKSUM_KEY: '',
        DEV_OTP: 'true',
      },
    },
    {
      command:
        'dotnet run --project ../BE/src/FloraBot.Gateway --no-launch-profile --urls http://127.0.0.1:5082',
      url: 'http://127.0.0.1:5082/health',
      reuseExistingServer: false,
      env: {
        API_UPSTREAM_URL: 'http://127.0.0.1:5081',
        JWT_SIGNING_KEY: signingKey,
        TRUSTED_PROXY_IPS: '',
        ASPNETCORE_ENVIRONMENT: 'Development',
      },
    },
    {
      command: 'pnpm --filter @florabot/portal exec vite --host 127.0.0.1 --port 5183 --strictPort',
      url: 'http://127.0.0.1:5183',
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: 'http://127.0.0.1:5082' },
    },
    {
      command: 'pnpm --filter @florabot/kiosk exec vite --host 127.0.0.1 --port 5184 --strictPort',
      url: 'http://127.0.0.1:5184',
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: 'http://127.0.0.1:5082' },
    },
    {
      command: 'pnpm --filter @florabot/landing exec astro dev --host 127.0.0.1 --port 4331',
      url: 'http://127.0.0.1:4331',
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: 'http://127.0.0.1:5082', PUBLIC_API_URL: '/api' },
    },
  ],
});

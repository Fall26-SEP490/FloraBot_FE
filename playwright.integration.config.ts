import { defineConfig } from '@playwright/test';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const signingKey = randomBytes(32).toString('hex');
const beRoot = process.env.FLORABOT_BE_ROOT
  ? resolve(process.env.FLORABOT_BE_ROOT)
  : resolve('../BE');
const kiosRoot = process.env.FLORABOT_KIOS_ROOT
  ? resolve(process.env.FLORABOT_KIOS_ROOT)
  : resolve('../Kios');
const gatewayPort = process.env.FLORABOT_GATEWAY_PORT || process.env.GATEWAY_PORT || '5084';
const gatewayUrl = `http://127.0.0.1:${gatewayPort}`;

export default defineConfig({
  testDir: './tests/integration',
  outputDir: './test-results/integration',
  workers: 1,
  timeout: 180_000,
  // Credentials and auth cookies must not be captured in browser trace artifacts.
  use: { baseURL: 'http://127.0.0.1:5183', trace: 'off', screenshot: 'off', video: 'off' },
  webServer: [
    {
      command: `dotnet run --project "${resolve(beRoot, 'tests/FloraBot.BrowserHost')}" --no-launch-profile`,
      url: 'http://127.0.0.1:5081/health',
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        ASPNETCORE_ENVIRONMENT: 'Development',
        DATABASE_URL:
          'Host=localhost;Port=55436;Database=florabot_browser_tests;Username=florabot;Password=local-florabot-only',
        VALKEY_URL: 'localhost:56379',
        JOBS_ENABLED: 'false',
        MQTT_ENABLED: 'false',
        EMAIL_PROVIDER: 'Disabled',
        JWT_SIGNING_KEY: signingKey,
        ALLOWED_ORIGINS: 'http://127.0.0.1:5183,http://127.0.0.1:5184',
        PAYOS_CLIENT_ID: '',
        PAYOS_API_KEY: '',
        PAYOS_CHECKSUM_KEY: '',
        DEV_OTP: 'true',
      },
    },
    {
      command: `dotnet run --project "${resolve(beRoot, 'src/FloraBot.Gateway')}" --no-launch-profile --urls ${gatewayUrl}`,
      url: `${gatewayUrl}/health`,
      reuseExistingServer: false,
      env: {
        API_UPSTREAM_URL: 'http://127.0.0.1:5081',
        JWT_SIGNING_KEY: signingKey,
        TRUSTED_PROXY_IPS: '',
        ASPNETCORE_ENVIRONMENT: 'Development',
      },
    },
    {
      command:
        'pnpm --filter @florabot/web exec next dev --webpack --hostname 127.0.0.1 --port 5183',
      url: 'http://127.0.0.1:5183',
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: gatewayUrl },
    },
    {
      command: `pnpm --dir "${kiosRoot}" --filter @florabot/kiosk exec vite --host 127.0.0.1 --port 5184 --strictPort`,
      url: 'http://127.0.0.1:5184',
      reuseExistingServer: false,
      env: { API_PROXY_TARGET: gatewayUrl },
    },
  ],
});

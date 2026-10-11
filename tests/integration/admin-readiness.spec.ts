import { expect, test } from '@playwright/test';
import { randomBytes, randomUUID, randomInt } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { getBackendRoot, loginAdminWithPacing } from './helpers';

test('Admin signs in, loads all workspaces and approves a shop through real API and database', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const backend = getBackendRoot();
  const id = randomUUID();
  const email = `admin-${id}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  const setup = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'florabot',
      '-d',
      'florabot_browser_tests',
      '-v',
      'ON_ERROR_STOP=1',
      '-q',
    ],
    {
      cwd: backend,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
      input: `INSERT INTO identity.users(id,email,password_hash,full_name,role) VALUES('${id}','${email}','!unprovisioned','Admin readiness fixture','ADMIN');`,
    },
  );
  expect(setup.status).toBe(0);
  const provision = spawnSync(
    'dotnet',
    [
      'run',
      '--project',
      'src/FloraBot.Api',
      '--no-build',
      '--no-launch-profile',
      '--',
      'provision-user',
      id,
      email,
    ],
    {
      cwd: backend,
      encoding: 'utf8',
      input: password + '\n',
      windowsHide: true,
      timeout: 30_000,
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
        DATABASE_URL:
          'Host=localhost;Port=55436;Database=florabot_browser_tests;Username=florabot;Password=local-florabot-only',
      },
    },
  );
  expect(provision.status).toBe(0);
  const errors: string[] = [];
  const reads = new Map<string, number>();
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/admin/') && response.request().method() === 'GET')
      reads.set(url.pathname, response.status());
  });
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await loginAdminWithPacing(page, email, password);
  for (const [section, selector] of [
    ['shops', '.admin-sellers'],
    ['slots', '.admin-slots'],
    ['incidents', '.admin-incidents'],
    ['complaints', '.admin-complaints'],
    ['refunds', '.admin-refunds'],
    ['withdrawals', '.admin-withdrawals'],
    ['reconciliation', '.admin-reconciliation'],
  ]) {
    await page.goto(`/admin/${section}`);
    await expect(page.locator(selector).locator('h2')).toBeVisible();
    if (section !== 'reconciliation') {
      const endpoint = section === 'shops' ? 'sellers' : section;
      await expect.poll(() => reads.get(`/api/admin/${endpoint}`)).toBe(200);
    }
  }
  for (const endpoint of ['sellers', 'slots', 'incidents', 'complaints', 'refunds', 'withdrawals'])
    await expect.poll(() => reads.get(`/api/admin/${endpoint}`)).toBe(200);
  const shopName = `Admin readiness ${id}`;
  const registered = await page.request.post('/api/sellers', {
    headers: { Origin: 'http://127.0.0.1:5183' },
    data: {
      shopName,
      phone: `09${randomInt(10_000_000, 100_000_000)}`,
      area: 'Test',
      packageId: '20000000-0000-0000-0000-00000000000a',
    },
  });
  expect(registered.status()).toBe(201);
  await page.goto('/admin/shops');
  const shops = page.locator('.admin-sellers');
  await shops.getByLabel('Tìm tên shop hoặc số điện thoại').fill(shopName);
  const shop = shops.locator('li').filter({ hasText: shopName });
  await shop.locator('summary').click();
  await shop
    .getByLabel(`Gói thuê cho ${shopName}`)
    .selectOption('20000000-0000-0000-0000-00000000000a');
  await shop.getByRole('button', { name: 'Duyệt hồ sơ shop' }).click();
  await expect(shops.getByRole('status')).toContainText(`Đã duyệt ${shopName}`);
  expect(errors).toEqual([]);
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/admin\/login$/);
});

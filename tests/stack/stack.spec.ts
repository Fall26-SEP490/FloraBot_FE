import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Public receipt route is served through Caddy and rejects an unknown capability', async ({
  page,
}) => {
  await page.goto('/receipt#order=30000000-0000-0000-0000-000000000001&token=ABCD2345');
  await expect(page).toHaveURL('/receipt');
  await expect(page.getByRole('heading', { name: 'Biên nhận của bạn', exact: true })).toBeVisible();
  const response = page.waitForResponse((result) => result.url().endsWith('/api/receipts/lookup'));
  await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
  const rejected = await response;
  expect(rejected.status()).toBe(404);
  expect(rejected.headers()['cache-control']).toBe('no-store');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Không tìm thấy biên nhận');
});

test('advisor fallback is available through the actual gateway and database', async ({
  request,
}) => {
  const kiosk = '40000000-0000-0000-0000-000000000001';
  const headers = { 'X-Kiosk-Key': 'demo-key-q1' };
  const response = await request.post(`/api/kiosks/${kiosk}/flows/ai_suggest`, {
    headers,
    data: {
      p_session: crypto.randomUUID(),
      p_recipient: 'MOTHER',
      p_age: '41_60',
      p_occasion: 'BIRTHDAY',
      p_tone: 'WARM',
      p_budget: 300000,
    },
  });
  expect(response.status()).toBe(200);
  const { result } = await response.json();
  const survey = await request.get(`/api/kiosks/${kiosk}/surveys/${result}`, { headers });
  expect(survey.status()).toBe(200);
  expect(survey.headers()['cache-control']).toBe('no-store');
  const body = await survey.json();
  expect(body.id).toBe(result);
  expect(['FALLBACK', 'LLM']).toContain(body.source);
  expect(Array.isArray(body.suggestions)).toBe(true);
  expect((await request.get(`/api/kiosks/${kiosk}/surveys/${result}`)).status()).toBe(401);
});

test('Caddy serves landing, portal and authenticated API routes on one origin', async ({
  page,
  request,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page).toHaveTitle(/^FloraBot/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
  await expect(page.locator('#hero-title')).toBeVisible();
  await page.getByRole('link', { name: 'Cổng quản lý shop' }).click();
  await expect(page).toHaveURL('/dang-nhap');
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  expect(await page.locator('script[src^="/_next/static/"]').count()).toBeGreaterThan(0);
  await page.getByRole('link', { name: 'Đăng ký thành viên', exact: true }).click();
  await expect(page).toHaveURL('/dang-ky');
  await page.goto('/login');
  await expect(page).toHaveURL('/dang-nhap');
  await page.getByRole('link', { name: 'Đăng nhập dành cho nhân viên FloraBot' }).click();
  await expect(page).toHaveURL('/admin/login');
  await page.goto('/admin');
  await expect(page).toHaveURL('/admin/login');
  const packages = await request.get('/api/packages');
  expect(packages.status()).toBe(200);
  expect(Array.isArray(await packages.json())).toBe(true);
  expect((await request.get('/api/auth/me')).status()).toBe(401);
  expect(errors).toEqual([]);
});

test('kiosk PWA works under its own path and never controls the portal', async ({
  page,
  context,
  request,
}) => {
  const manifest = await (await request.get('/kiosk/manifest.webmanifest')).json();
  expect(manifest.scope).toBe('/kiosk/');
  expect(manifest.start_url).toBe('/kiosk/');
  await page.goto('/kiosk');
  await expect(page).toHaveURL('/kiosk/');
  await page.getByLabel('Mã kiosk').fill('40000000-0000-0000-0000-000000000001');
  await page.getByLabel('Khóa thiết bị').fill('demo-key-q1');
  await page.getByRole('button', { name: 'Kết nối tủ', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Hoa đang đợi bạn' })).toBeVisible();
  await page.getByText('Cần một chút gợi ý để chọn hoa?', { exact: true }).click();
  await page.getByRole('button', { name: 'Tìm hoa phù hợp', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Một chút cảm hứng cho món quà' })).toBeFocused();
  await expect(
    page.getByText('Hoa chỉ được giữ khi bạn chuyển sang thanh toán.', { exact: false }),
  ).toBeVisible();
  await expect(page.locator('.welcome img')).toHaveAttribute('src', '/kiosk/flowers.avif');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload();
  await expect
    .poll(() => page.evaluate(() => navigator.serviceWorker.controller?.scriptURL))
    .toBe('http://localhost:8088/kiosk/sw.js');
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hoa đang đợi bạn' })).toBeVisible();
  await expect(page.getByRole('alert').filter({ hasText: 'Tủ đang mất kết nối' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Giữ hoa và thanh toán' })).toBeDisabled();
  await context.setOffline(false);
  await page.goto('/login');
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => navigator.serviceWorker.controller)).toBeNull();
});

test('production portal and kiosk setup remain accessible on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const route of ['/login', '/kiosk/']) {
    await page.goto(route);
    await expect(page.locator('h1')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
});

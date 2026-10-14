import { expect, test } from '@playwright/test';

test('A workspace route starts at its heading after login from a scrolled page', async ({
  page,
}) => {
  let signedIn = false;
  const identity = { id: 'scroll-admin', role: 'ADMIN', name: 'Quản trị kiểm thử', sellerId: null };
  await page.route('**/api/**', (route) => route.fulfill({ json: { items: [], hasMore: false } }));
  await page.route('**/api/admin/managers', (route) => route.fulfill({ json: [] }));
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
  await page.route('**/api/auth/me', (route) =>
    route.fulfill(signedIn ? { json: identity } : { status: 401, json: {} }),
  );
  await page.route('**/api/auth/admin/login', (route) => {
    signedIn = true;
    return route.fulfill({ json: identity });
  });
  await page.goto('/admin/login');
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByLabel('Email', { exact: true }).fill('scroll@florabot.test');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('DemoTest12345!');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Quản trị kiểm thử');
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
  await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole('link', { name: 'Quản lý vận hành', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/managers$/);
  await expect.poll(() => page.evaluate(() => scrollY)).toBe(0);
});

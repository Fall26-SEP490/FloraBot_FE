import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/admin/withdrawals?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
});

test.beforeEach(async ({ page }) => {
  await page.route('**/api/admin/incidents?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
});
test.beforeEach(async ({ page }) => {
  await page.route('**/wallet', (route) =>
    route.fulfill({
      json: {
        balance: null,
        entries: [],
        bankConfigured: false,
        minimumWithdrawal: 50000,
        withdrawals: [],
        hasMoreEntries: false,
        hasMoreWithdrawals: false,
      },
    }),
  );
  await page.route('**/slots', (route) => route.fulfill({ json: [] }));
  await page.route('**/admin/sellers?*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/packages', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/admin/slots', (route) => route.fulfill({ json: [] }));
  await page.route('**/products', (route) => route.fulfill({ json: [] }));
  await page.route('**/subscriptions', (route) =>
    route.fulfill({ json: { package: null, subscriptions: [] } }),
  );
});
const seller = {
  id: '10000000-0000-0000-0000-000000000003',
  name: 'Tiệm Hoa Nhỏ',
  role: 'SELLER',
  sellerId: '20000000-0000-0000-0000-000000000001',
  sellerStatus: 'PAST_DUE',
  packageExpiresAt: '2026-10-01',
};

test('Anonymous guard, login validation, seller banner and logout', async ({ page }) => {
  let signedIn = false;
  await page.route('**/api/auth/**', async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith('/login')) {
      expect(route.request().postDataJSON()).toEqual({
        email: 'shop@example.com',
        password: 'test-password',
      });
      signedIn = true;
    }
    if (url.pathname.endsWith('/logout')) {
      signedIn = false;
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill(signedIn ? { json: seller } : { status: 401 });
  });
  await page.goto('/seller');
  await expect(page).toHaveURL(/\/login$/);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
  await expect(page.getByText('Nhập địa chỉ email hợp lệ.')).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill('shop@example.com');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/seller$/);
  await expect(page.getByLabel('Trạng thái gói')).toContainText('Gói hết hạn ngày 1/10/2026');
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/seller$/);
  await expect(page.getByRole('heading', { name: 'Chào Tiệm Hoa Nhỏ,' })).toBeVisible();
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto('/seller');
  await expect(page).toHaveURL(/\/login$/);
});

test('Admin redirected to its own workspace', async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { ...seller, role: 'ADMIN', sellerId: null, sellerStatus: null } }),
  );
  await page.goto('/seller');
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByText('Quản trị vận hành')).toBeVisible();
  await expect(page.getByLabel('Trạng thái gói')).toHaveCount(0);
});

test('Refresh is attempted and invalid sessions return to login', async ({ page }) => {
  let refreshes = 0;
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401 }));
  await page.route('**/api/auth/refresh', (route) => {
    refreshes++;
    return route.fulfill({ status: 401 });
  });
  await page.goto('/seller');
  await expect(page).toHaveURL(/\/login$/);
  expect(refreshes).toBe(1);
});

for (const width of [390, 1440]) {
  test(`Portal accessible login and seller workspace ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/login');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Bỏ qua tới nội dung' })).toBeFocused();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `.impeccable/review/portal-login-${width}.png`, fullPage: true });
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: seller }));
    await page.goto('/seller');
    await expect(page.getByLabel('Trạng thái gói')).toContainText('Gói hết hạn ngày 1/10/2026');
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `.impeccable/review/portal-seller-${width}.png`,
      fullPage: true,
    });
  });
}

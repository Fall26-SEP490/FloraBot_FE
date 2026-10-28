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
  await page.route('**/api/**/wallet', (route) =>
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
  await page.route('**/api/**/slots', (route) => route.fulfill({ json: [] }));
  await page.route('**/admin/sellers?*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/packages', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/admin/slots', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/**/products', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/**/subscriptions', (route) =>
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
  test.setTimeout(45_000);
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
  await expect(page).toHaveURL(/\/dang-nhap$/);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeFocused();
  await expect(page.getByText('Nhập email.', { exact: true })).toBeVisible();
  await page.getByLabel('Email', { exact: true }).fill('shop@example.com');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/seller$/);
  await expect(page.getByLabel('Trạng thái gói')).toContainText('Gói hết hạn ngày 1/10/2026');
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/seller$/);
  await expect(page.getByRole('heading', { name: 'Tổng quan cửa hàng' })).toBeVisible();
  await expect(page.getByText('Chào Tiệm Hoa Nhỏ,')).toBeVisible();
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/\/dang-nhap$/);
  await page.goto('/seller');
  await expect(page).toHaveURL(/\/dang-nhap$/);
});

test('Marketing header logout clears the session and performs a clean navigation', async ({
  page,
}) => {
  let signedIn = true;
  let logoutCalls = 0;

  await page.route('**/api/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/config') {
      await route.fulfill({
        json: {
          googleClientId: null,
          googleEnabled: false,
          registrationEmailEnabled: false,
        },
      });
      return;
    }
    if (path === '/api/auth/logout') {
      logoutCalls++;
      signedIn = false;
      await route.fulfill({ status: 204 });
      return;
    }
    if (path === '/api/auth/refresh') {
      await route.fulfill({ status: 401 });
      return;
    }
    await route.fulfill(signedIn ? { json: seller } : { status: 401 });
  });

  await page.goto('/huong-dan-dat-hoa');
  await expect(
    page.getByRole('button', { name: 'Mở menu người dùng của Tiệm Hoa Nhỏ' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Mở menu người dùng của Tiệm Hoa Nhỏ' }).click();
  await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();

  await expect(page).toHaveURL(/\/dang-nhap$/);
  expect(logoutCalls).toBe(1);

  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Đăng nhập', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toHaveCount(0);
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

test('Technician uses operations login and never enters administrator workspace', async ({
  page,
}) => {
  let signedIn = false;
  const privilegedRequests: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/admin/'))
      privilegedRequests.push(request.url());
  });
  await page.route('**/api/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/admin/login') {
      expect(route.request().postDataJSON()).toEqual({
        email: 'tech@example.com',
        password: 'test-password',
      });
      signedIn = true;
    }
    if (path === '/api/auth/logout') {
      signedIn = false;
      await route.fulfill({ status: 204 });
      return;
    }
    await route.fulfill(
      signedIn
        ? { json: { ...seller, name: 'Kỹ thuật viên', role: 'TECHNICIAN', sellerId: null } }
        : { status: 401 },
    );
  });
  await page.route('**/api/staff/**', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.goto('/technician');
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel('Email', { exact: true }).fill('tech@example.com');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('test-password');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/technician$/);
  await expect(page.getByRole('heading', { name: 'Chào Kỹ thuật viên' })).toBeVisible();
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/technician$/);
  await expect(page.getByRole('heading', { name: 'Chào Kỹ thuật viên' })).toBeVisible();
  expect(privilegedRequests).toEqual([]);
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('Operations manager can sign out from the operations workspace', async ({ page }) => {
  let signedIn = true;
  let logoutCalls = 0;
  const manager = {
    ...seller,
    name: 'Quản lý vận hành',
    role: 'OPERATIONS_MANAGER',
    sellerId: null,
    sellerStatus: null,
  };

  await page.route('**/api/auth/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/logout') {
      logoutCalls++;
      signedIn = false;
      await route.fulfill({ status: 204 });
      return;
    }
    if (path === '/api/auth/refresh') {
      await route.fulfill({ status: 401 });
      return;
    }
    await route.fulfill(signedIn ? { json: manager } : { status: 401 });
  });

  await page.goto('/operations');
  await expect(page.getByRole('heading', { name: 'Tổng quan vận hành' })).toBeVisible();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();

  await expect(page).toHaveURL(/\/admin\/login$/);
  expect(logoutCalls).toBe(1);
  await page.goto('/operations');
  await expect(page).toHaveURL(/\/admin\/login$/);
});

test('Refresh is attempted and invalid sessions return to login', async ({ page }) => {
  let refreshes = 0;
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401 }));
  await page.route('**/api/auth/refresh', (route) => {
    refreshes++;
    return route.fulfill({ status: 401 });
  });
  await page.goto('/seller');
  await expect(page).toHaveURL(/\/dang-nhap$/);
  expect(refreshes).toBe(1);
});

for (const width of [390, 1440]) {
  test(`Portal accessible login and seller workspace ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/login');
    await expect(page.getByRole('link', { name: 'Bỏ qua tới nội dung' })).toBeAttached();
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
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

import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const managerSession = {
  id: '10000000-0000-0000-0000-000000000010',
  name: 'Nguyễn Quản Lý',
  role: 'OPERATIONS_MANAGER',
  sellerId: null,
  sellerStatus: null,
  packageExpiresAt: null,
};

const technicianSession = {
  id: '10000000-0000-0000-0000-000000000011',
  name: 'Trần Kỹ Thuật',
  role: 'TECHNICIAN',
  sellerId: null,
  sellerStatus: null,
  packageExpiresAt: null,
};

const sellerStaffSession = {
  id: '10000000-0000-0000-0000-000000000012',
  name: 'Lê Nhân Viên Shop',
  role: 'SELLER_STAFF',
  sellerId: '20000000-0000-0000-0000-000000000001',
  sellerStatus: 'ACTIVE',
  packageExpiresAt: null,
};

const unknownSession = {
  id: '10000000-0000-0000-0000-000000000099',
  name: 'Khách Lạ',
  role: 'UNKNOWN_ROLE',
  sellerId: null,
  sellerStatus: null,
  packageExpiresAt: null,
};

test.describe('FloraBot Identity Foundation - Workspace and Roles', () => {
  test('Anonymous /workspace displays regular and platform login options', async ({ page }) => {
    await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401 }));
    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/workspace$/);
    await expect(page.getByRole('heading', { name: 'Không gian làm việc FloraBot' })).toBeVisible();

    const memberLoginLink = page.getByRole('link', {
      name: 'Đăng nhập tài khoản shop & thành viên',
    });
    const platformLoginLink = page.getByRole('link', { name: 'Đăng nhập vận hành' });
    await expect(memberLoginLink).toBeVisible();
    await expect(platformLoginLink).toBeVisible();

    await memberLoginLink.click();
    await expect(page).toHaveURL(/\/dang-nhap$/);
  });

  test('Non-401 error displays honest failure with retry button that recovers on 200', async ({
    page,
  }) => {
    let attempts = 0;
    await page.route('**/api/auth/me', (route) => {
      attempts++;
      if (attempts === 1) {
        return route.fulfill({ status: 500, json: { detail: 'Máy chủ đang bảo trì.' } });
      }
      return route.fulfill({ json: managerSession });
    });

    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/workspace$/);
    await expect(page.getByRole('heading', { name: 'Chưa tải được phiên làm việc' })).toBeVisible();
    await expect(page.locator('.workspace-unavailable-notice[role="alert"]')).toContainText(
      'Máy chủ đang bảo trì.',
    );

    const retryButton = page.getByRole('button', { name: 'Thử lại' });
    await expect(retryButton).toBeVisible();
    await retryButton.click();

    await expect(page.getByRole('heading', { name: 'Chào Nguyễn Quản Lý' })).toBeVisible();
    await expect(page.getByText('Quản lý vận hành').first()).toBeVisible();
  });

  test('Platform login routes OPERATIONS_MANAGER to /workspace and supports logout', async ({
    page,
  }) => {
    let signedIn = false;
    await page.route('**/api/auth/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/admin/login') {
        expect(route.request().postDataJSON()).toEqual({
          email: 'ops@example.com',
          password: 'test-password',
        });
        signedIn = true;
        await route.fulfill({ json: managerSession });
        return;
      }
      if (path === '/api/auth/logout') {
        signedIn = false;
        await route.fulfill({ status: 204 });
        return;
      }
      if (path === '/api/auth/me') {
        await route.fulfill(signedIn ? { json: managerSession } : { status: 401 });
        return;
      }
      await route.fallback();
    });

    await page.goto('/admin/login');
    await page.getByLabel('Email', { exact: true }).fill('ops@example.com');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    await expect(page).toHaveURL(/\/workspace$/);
    await expect(page.getByRole('heading', { name: 'Chào Nguyễn Quản Lý' })).toBeVisible();
    await expect(page.getByText('Quản lý vận hành').first()).toBeVisible();
    await expect(
      page.getByText(
        'Các tính năng tác nghiệp cho vai trò này hiện chưa khả dụng trên tài khoản của bạn.',
      ),
    ).toBeVisible();

    await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('Platform login routes TECHNICIAN to /workspace with no legacy staff tasks', async ({
    page,
  }) => {
    let signedIn = false;
    await page.route('**/api/auth/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/admin/login') {
        signedIn = true;
        await route.fulfill({ json: technicianSession });
        return;
      }
      if (path === '/api/auth/logout') {
        signedIn = false;
        await route.fulfill({ status: 204 });
        return;
      }
      if (path === '/api/auth/me') {
        await route.fulfill(signedIn ? { json: technicianSession } : { status: 401 });
        return;
      }
      await route.fallback();
    });

    await page.goto('/admin/login');
    await page.getByLabel('Email', { exact: true }).fill('tech@example.com');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    await expect(page).toHaveURL(/\/workspace$/);
    await expect(page.getByRole('heading', { name: 'Chào Trần Kỹ Thuật' })).toBeVisible();
    await expect(page.getByText('Kỹ thuật viên').first()).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Từ nhận việc đến hoàn thành' })).toHaveCount(0);
  });

  test('Store login routes SELLER_STAFF to /workspace with seller status and logout to store login', async ({
    page,
  }) => {
    let signedIn = false;
    await page.route('**/api/auth/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/login') {
        signedIn = true;
        await route.fulfill({ json: sellerStaffSession });
        return;
      }
      if (path === '/api/auth/logout') {
        signedIn = false;
        await route.fulfill({ status: 204 });
        return;
      }
      if (path === '/api/auth/me') {
        await route.fulfill(signedIn ? { json: sellerStaffSession } : { status: 401 });
        return;
      }
      await route.fallback();
    });

    await page.goto('/dang-nhap');
    await page.getByLabel('Email', { exact: true }).fill('staff@shop.example');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    await expect(page).toHaveURL(/\/workspace$/);
    await expect(page.getByRole('heading', { name: 'Chào Lê Nhân Viên Shop' })).toBeVisible();
    await expect(page.getByText('Nhân viên shop').first()).toBeVisible();
    await expect(page.getByText('20000000-0000-0000-0000-000000000001')).toBeVisible();

    await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
    await expect(page).toHaveURL(/\/dang-nhap$/);
  });

  test('Blocked owner, admin, staff and customer routes redirect to /workspace with ZERO finance calls', async ({
    page,
  }) => {
    const forbiddenRequests: string[] = [];
    page.on('request', (req) => {
      const url = new URL(req.url());
      if (
        url.pathname.startsWith('/api/') &&
        (url.pathname.includes('/wallet') ||
          url.pathname.includes('/subscriptions') ||
          url.pathname.includes('/products') ||
          url.pathname.includes('/packages') ||
          url.pathname.startsWith('/api/admin/') ||
          url.pathname.startsWith('/api/sellers/'))
      ) {
        forbiddenRequests.push(url.pathname);
      }
    });

    await page.route('**/api/auth/me', (route) => route.fulfill({ json: sellerStaffSession }));

    // Test direct owner route
    await page.goto('/seller');
    await expect(page).toHaveURL(/\/workspace$/);

    // Test direct owner wallet
    await page.goto('/seller/wallet');
    await expect(page).toHaveURL(/\/workspace$/);

    // Test direct admin route
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/workspace$/);

    // Test direct staff route
    await page.goto('/staff');
    await expect(page).toHaveURL(/\/workspace$/);

    // Test direct member route
    await page.goto('/tai-khoan');
    await expect(page).toHaveURL(/\/workspace$/);

    expect(forbiddenRequests).toEqual([]);
  });

  test('Unknown role renders default-deny view without redirect loop', async ({ page }) => {
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: unknownSession }));

    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/workspace$/);
    await expect(page.getByRole('heading', { name: 'Quyền truy cập chưa được cấp' })).toBeVisible();
    await expect(
      page.getByText(
        'Tài khoản chưa được kích hoạt phân quyền hợp lệ trong hệ thống. Vui lòng liên hệ quản trị viên để được cấp quyền.',
      ),
    ).toBeVisible();
    await expect(page.getByText('UNKNOWN_ROLE').first()).toBeVisible();

    // Direct access to /admin also lands safely on /workspace deny view
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/workspace$/);
    await expect(page.getByRole('heading', { name: 'Quyền truy cập chưa được cấp' })).toBeVisible();
  });

  test('Existing full portal roles visiting /workspace redirect to their respective portals', async ({
    page,
  }) => {
    // Admin
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ json: { ...managerSession, role: 'ADMIN' } }),
    );
    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/admin$/);

    // Staff
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ json: { ...managerSession, role: 'STAFF' } }),
    );
    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/staff$/);

    // Seller
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: { ...sellerStaffSession, role: 'SELLER' },
      }),
    );
    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/seller$/);

    // Customer
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ json: { ...managerSession, role: 'CUSTOMER' } }),
    );
    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/tai-khoan$/);
  });

  for (const width of [390, 1440]) {
    test(`Workspace accessible responsive view at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 950 });
      await page.route('**/api/auth/me', (route) => route.fulfill({ json: managerSession }));
      await page.goto('/workspace');

      await expect(page.getByRole('link', { name: 'Bỏ qua tới nội dung' })).toBeAttached();
      await expect(page.getByRole('heading', { name: 'Chào Nguyễn Quản Lý' })).toBeVisible();

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
    });
  }
});

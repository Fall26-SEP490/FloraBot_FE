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

    await expect(page).toHaveURL(/\/operations$/);
    await expect(page.getByRole('heading', { name: 'Tổng quan vận hành' })).toBeVisible();
    await expect(page.getByText('Quản lý vận hành').first()).toBeVisible();
  });

  test('Platform login routes OPERATIONS_MANAGER to /operations and supports logout', async ({
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

    await page.route('**/api/operations/**', (route) => {
      const p = new URL(route.request().url()).pathname;
      if (['/staff', '/technicians', '/eligible-kiosks'].some((suffix) => p.endsWith(suffix)))
        return route.fulfill({ json: [] });
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    });

    await page.goto('/admin/login');
    await page.getByLabel('Email', { exact: true }).fill('ops@example.com');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    await expect(page).toHaveURL(/\/operations$/);
    await expect(page.getByRole('heading', { name: 'Tổng quan vận hành' })).toBeVisible();
    await expect(page.getByText('Quản lý vận hành').first()).toBeVisible();

    // Verify manager has NO financial navigation
    const nav = page.getByRole('navigation', { name: 'Điều hướng quản lý' });
    await expect(nav.getByRole('link', { name: 'Ví' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Hoàn tiền' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Rút tiền' })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: 'Đối soát' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('Platform login routes TECHNICIAN to /technician with no legacy staff tasks', async ({
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

    await page.route('**/api/staff/**', (route) =>
      route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
    );

    await page.goto('/admin/login');
    await page.getByLabel('Email', { exact: true }).fill('tech@example.com');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    await expect(page).toHaveURL(/\/technician$/);
    await expect(page.getByRole('heading', { name: 'Chào Trần Kỹ Thuật' })).toBeVisible();
    await expect(page.getByText('Kỹ thuật viên').first()).toBeVisible();
    // Technician never has stock forms or legacy staff guide
    await expect(page.getByText('Nạp hoa và xem kết quả')).toHaveCount(0);

    await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
    await expect(page).toHaveURL(/\/admin\/login$/);
  });

  test('Store login routes SELLER_STAFF to /staff with seller status and logout to store login', async ({
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

    await page.route('**/api/staff/**', (route) =>
      route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
    );

    await page.goto('/dang-nhap');
    await page.getByLabel('Email', { exact: true }).fill('staff@shop.example');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('test-password');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    await expect(page).toHaveURL(/\/staff$/);
    await expect(page.getByRole('heading', { name: 'Chào Lê Nhân Viên Shop' })).toBeVisible();
    await expect(page.getByText('Nhân viên shop').first()).toBeVisible();
    // Seller staff never has technical incident resolution
    await expect(page.getByText('Ghi nhận đã sửa sự cố')).toHaveCount(0);

    await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
    await expect(page).toHaveURL(/\/dang-nhap$/);
  });

  test('Blocked owner, admin, staff and customer routes redirect to correct portal with ZERO finance calls', async ({
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
    await page.route('**/api/staff/**', (route) =>
      route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
    );

    // Test direct owner route redirected to /staff
    await page.goto('/seller');
    await expect(page).toHaveURL(/\/staff$/);

    // Test direct owner wallet redirected to /staff
    await page.goto('/seller/wallet');
    await expect(page).toHaveURL(/\/staff$/);

    // Test direct admin route redirected to /staff
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/staff$/);

    // Test direct operations route redirected to /staff
    await page.goto('/operations');
    await expect(page).toHaveURL(/\/staff$/);

    // Test direct technician route redirected to /staff
    await page.goto('/technician');
    await expect(page).toHaveURL(/\/staff$/);

    // Test direct member route redirected to /staff
    await page.goto('/tai-khoan');
    await expect(page).toHaveURL(/\/staff$/);

    expect(forbiddenRequests).toEqual([]);
  });

  test('Retired STAFF must not enter workspace and avoids redirect loops', async ({ page }) => {
    let loggedOut = false;
    await page.route('**/api/auth/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/logout') {
        loggedOut = true;
        return route.fulfill({ status: 204 });
      }
      if (path === '/api/auth/me') {
        return route.fulfill(
          loggedOut
            ? { status: 401 }
            : { json: { ...managerSession, role: 'STAFF', name: 'Nguyễn Cựu Nhân Viên' } },
        );
      }
      return route.fallback();
    });

    // Visiting /workspace directly does not redirect; renders retired state
    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/workspace$/);
    await expect(
      page.getByRole('heading', { name: 'Tài khoản nhân viên cũ đã ngừng hoạt động' }),
    ).toBeVisible();
    await expect(
      page.getByText('Tài khoản nhân viên FloraBot trước đây đã ngừng hoạt động.'),
    ).toBeVisible();

    const logoutBtn = page.getByRole('button', { name: 'Đăng xuất' }).first();
    await expect(logoutBtn).toBeVisible();

    // Visiting /staff redirects to /workspace without loop
    await page.goto('/staff');
    await expect(page).toHaveURL(/\/workspace$/);
    await expect(
      page.getByRole('heading', { name: 'Tài khoản nhân viên cũ đã ngừng hoạt động' }),
    ).toBeVisible();

    // Visiting /admin redirects to /workspace without loop
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/workspace$/);

    // Clicking logout safely logs out to platform login
    await logoutBtn.click();
    await expect(page).toHaveURL(/\/admin\/login$/);
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

  test('Active authenticated roles visiting /workspace redirect to their respective portals', async ({
    page,
  }) => {
    // Admin
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ json: { ...managerSession, role: 'ADMIN' } }),
    );
    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/admin$/);

    // Operations Manager
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ json: { ...managerSession, role: 'OPERATIONS_MANAGER' } }),
    );
    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/operations$/);

    // Technician
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ json: { ...technicianSession, role: 'TECHNICIAN' } }),
    );
    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/technician$/);

    // Seller
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: { ...sellerStaffSession, role: 'SELLER' },
      }),
    );
    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/seller$/);

    // Seller Staff
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: { ...sellerStaffSession, role: 'SELLER_STAFF' },
      }),
    );
    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/staff$/);

    // Customer
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ json: { ...managerSession, role: 'CUSTOMER' } }),
    );
    await page.goto('/workspace');
    await expect(page).toHaveURL(/\/tai-khoan$/);
  });

  test('Role and scope switches do not replay or reveal old tasks or persisted retry keys', async ({
    page,
  }) => {
    // 1. Seed sessionStorage with legacy un-scoped retry keys and old tenant keys
    await page.addInitScript(() => {
      sessionStorage.setItem(
        'florabot-task-assignment:mgr-1',
        JSON.stringify({
          id: 'old-task-id',
          assigneeId: 'old-staff',
          kind: 'INCIDENT',
          kioskId: 'kiosk-old',
          sellerId: null,
          incidentId: 'inc-old',
          instructions: 'Chỉ thị cũ từ phiên trước',
        }),
      );
      sessionStorage.setItem(
        'florabot-task-assignment:SELLER:seller-1:seller:shop-1',
        JSON.stringify({
          id: 'shop1-task-id',
          assigneeId: 'staff-shop1',
          kind: 'DELIVERY',
          kioskId: 'kiosk-1',
          sellerId: 'shop-1',
          incidentId: null,
          instructions: 'Giao hoa cho shop 1',
        }),
      );
    });

    // 2. Visit Operations Manager: old un-scoped key is ignored
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: managerSession }));
    await page.route('**/api/operations/**', (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p.endsWith('/staff'))
        return route.fulfill({ json: [{ id: 'tech-1', name: 'Kỹ thuật viên' }] });
      if (p.endsWith('/incidents'))
        return route.fulfill({
          json: {
            items: [{ id: 'inc-1', kioskId: 'kiosk-1', reason: 'Kẹt cửa', location: null }],
            page: 1,
            hasMore: false,
          },
        });
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    });

    await page.goto('/operations/tasks');
    await expect(page.getByRole('heading', { name: 'Điều phối công việc kỹ thuật' })).toBeVisible();
    await page.getByText('Phân công công việc mới', { exact: true }).click();
    // Verify old un-scoped retry attempt was NOT restored:
    await expect(page.getByText('Chỉ thị cũ từ phiên trước')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Kiểm tra lại yêu cầu' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Giao công việc' })).toBeVisible();

    // 3. Switch scope to Seller Shop 2: does NOT reveal or replay Shop 1's pending assignment
    const shop2Session = {
      id: 'seller-owner-2',
      name: 'Chủ Shop 2',
      role: 'SELLER',
      sellerId: 'shop-2',
      sellerStatus: 'ACTIVE',
      packageExpiresAt: '2030-01-01',
    };
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: shop2Session }));
    await page.route('**/api/sellers/shop-2/**', (route) => {
      const p = new URL(route.request().url()).pathname;
      if (p.endsWith('/staff'))
        return route.fulfill({ json: [{ id: 'staff-2', name: 'Nhân viên 2' }] });
      if (p.endsWith('/staff-delivery-scopes'))
        return route.fulfill({
          json: [
            {
              sellerId: 'shop-2',
              shopName: 'Shop 2',
              kioskId: 'k2',
              kioskName: 'Tủ 2',
              address: 'ĐC 2',
            },
          ],
        });
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    });

    await page.goto('/seller/tasks');
    await expect(page.getByRole('heading', { name: 'Phân công giao hoa' })).toBeVisible();
    await page.getByText('Phân công công việc mới', { exact: true }).click();
    // Shop 1's persisted assignment is NOT replayed in Shop 2
    await expect(page.getByText('Giao hoa cho shop 1')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Kiểm tra lại yêu cầu' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Giao công việc' })).toBeVisible();

    // 4. Missing / absent role fails closed:
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ json: { id: 'no-role-user', name: 'Không Có Quyền', role: '' } }),
    );
    await page.goto('/workspace');
    await expect(page.getByRole('heading', { name: 'Quyền truy cập chưa được cấp' })).toBeVisible();
  });

  for (const width of [390, 1440]) {
    test(`Operations accessible responsive view at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 950 });
      await page.route('**/api/auth/me', (route) => route.fulfill({ json: managerSession }));
      await page.route('**/api/operations/**', (route) => {
        const p = new URL(route.request().url()).pathname;
        if (['/staff', '/technicians', '/eligible-kiosks'].some((suffix) => p.endsWith(suffix)))
          return route.fulfill({ json: [] });
        return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
      });
      await page.goto('/operations');

      await expect(page.getByRole('link', { name: 'Bỏ qua tới nội dung' })).toBeAttached();
      await expect(page.getByRole('heading', { name: 'Tổng quan vận hành' })).toBeVisible();

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

    test(`Retired STAFF workspace accessible responsive view at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 950 });
      await page.route('**/api/auth/me', (route) =>
        route.fulfill({ json: { ...managerSession, role: 'STAFF' } }),
      );
      await page.goto('/workspace');

      await expect(page.getByRole('link', { name: 'Bỏ qua tới nội dung' })).toBeAttached();
      await expect(
        page.getByRole('heading', { name: 'Tài khoản nhân viên cũ đã ngừng hoạt động' }),
      ).toBeVisible();

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

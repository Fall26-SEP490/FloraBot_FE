import { expect, test } from '@playwright/test';

const adminSession = {
  id: 'admin-test',
  name: 'Quản trị viên',
  role: 'ADMIN',
  sellerId: null,
  sellerStatus: null,
  packageExpiresAt: null,
};

const sellerSession = {
  id: 'seller-test',
  name: 'Chủ shop Hoa Sài Gòn',
  role: 'SELLER',
  sellerId: '20000000-0000-0000-0000-000000000001',
  sellerStatus: 'ACTIVE',
  packageExpiresAt: '2030-01-01',
};

const managerSession = {
  id: 'manager-test',
  name: 'Nguyễn Quản Lý',
  role: 'OPERATIONS_MANAGER',
  sellerId: null,
  sellerStatus: null,
  packageExpiresAt: null,
};

const techSession = {
  id: 'tech-test',
  name: 'Trần Kỹ Thuật',
  role: 'TECHNICIAN',
  sellerId: null,
  sellerStatus: null,
  packageExpiresAt: null,
};

const staffSession = {
  id: 'staff-test',
  name: 'Lê Nhân Viên Shop',
  role: 'SELLER_STAFF',
  sellerId: '20000000-0000-0000-0000-000000000001',
  sellerStatus: 'ACTIVE',
  packageExpiresAt: null,
};

const customerSession = {
  id: 'customer-test',
  name: 'Khách Hàng Thân Thiết',
  role: 'CUSTOMER',
  sellerId: null,
  sellerStatus: null,
  packageExpiresAt: null,
};

test.describe('Capture workspace UI repair inspection screenshots', () => {
  test('Capture Admin overview at 934px tablet and 1440px desktop', async ({ page }) => {
    await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: adminSession }));
    await page.route('**/api/admin/managers', (route) =>
      route.fulfill({
        json: [
          {
            id: 'm1',
            email: 'ql1@florabot.vn',
            fullName: 'Nguyễn Văn Quản Lý',
            phone: '0901234567',
            status: 'ACTIVE',
            role: 'OPERATIONS_MANAGER',
            createdAt: '2026-10-10T00:00:00Z',
          },
          {
            id: 'm2',
            email: 'ql2@florabot.vn',
            fullName: 'Phạm Thị Giám Sát',
            phone: '0909876543',
            status: 'LOCKED',
            role: 'OPERATIONS_MANAGER',
            createdAt: '2026-10-11T00:00:00Z',
          },
        ],
      }),
    );
    await page.route('**/api/**', (route) => {
      if (new URL(route.request().url()).pathname === '/api/auth/me') return route.fallback();
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    });

    // 934px tablet viewport (coordinator observation baseline)
    await page.setViewportSize({ width: 934, height: 850 });
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: 'artifacts/screenshots/admin-overview-934px.png',
      fullPage: true,
    });

    // 1440px desktop
    await page.setViewportSize({ width: 1440, height: 900 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: 'artifacts/screenshots/admin-overview-1440px.png',
      fullPage: true,
    });
  });

  test('Capture Seller overview at 1440px and 390px', async ({ page }) => {
    await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: sellerSession }));
    await page.route('**/api/sellers/*/staff/accounts', (route) =>
      route.fulfill({
        json: [
          {
            id: 's1',
            email: 'nv1@hoasaigon.vn',
            fullName: 'Lê Hoàng Yến',
            phone: '0911223344',
            status: 'ACTIVE',
            role: 'SELLER_STAFF',
            createdAt: '2026-10-10T00:00:00Z',
          },
        ],
      }),
    );
    await page.route('**/api/sellers/*/products', (route) =>
      route.fulfill({
        json: [
          {
            id: 'p1',
            name: 'Bó Hoa Lụa Pastel',
            price: 350000,
            status: 'ACTIVE',
            shelfLifeHours: 720,
          },
        ],
      }),
    );
    await page.route('**/api/sellers/*/wallet', (route) =>
      route.fulfill({
        json: {
          balance: { availableBalance: 1250000, pendingBalance: 400000 },
          bankConfigured: true,
          entries: [],
          withdrawals: [],
        },
      }),
    );
    await page.route('**/api/**', (route) => {
      if (new URL(route.request().url()).pathname === '/api/auth/me') return route.fallback();
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    });

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/seller');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.workspace-portal-root.platform-workspace')).toHaveAttribute(
      'data-platform-role',
      'seller',
    );
    await expect(page.getByText('Vận hành cửa hàng')).toBeVisible();
    expect(
      await page.locator('.workspace-sidebar').evaluate((element) => {
        return window.getComputedStyle(element).backgroundColor;
      }),
    ).toBe('rgb(23, 62, 51)');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: 'artifacts/screenshots/seller-overview-1440px.png',
      fullPage: true,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: 'artifacts/screenshots/seller-overview-390px.png',
      fullPage: true,
    });
  });

  test('Capture Staff workspace at 390px', async ({ page }) => {
    await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: staffSession }));
    await page.route('**/api/staff/tasks**', (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: 'task-1',
              kind: 'DELIVERY',
              status: 'ASSIGNED',
              version: 1,
              assigneeName: 'Lê Nhân Viên Shop',
              assigneeId: 'staff-test',
              kioskName: 'Tủ Kiosk Đại Học FPT',
              address: 'Lô E2a-7, Đường D1, TP. Thủ Đức',
              shopName: 'Hoa Sài Gòn',
              instructions: 'Nạp 4 bó hoa hồng lụa vào ngăn A01-A04',
              report: null,
            },
          ],
          page: 1,
          hasMore: false,
        },
      }),
    );

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/staff');
    await page.waitForLoadState('networkidle');
    await expect(page.locator('.workspace-portal-root.platform-workspace')).toHaveAttribute(
      'data-platform-role',
      'staff',
    );
    await expect(page.getByRole('heading', { level: 1, name: 'Công việc giao hoa' })).toBeVisible();
    await expect(page.getByText('Công việc tại shop')).toBeAttached();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: 'artifacts/screenshots/seller-staff-390px.png',
      fullPage: true,
    });
  });

  test('Capture Operations Manager and Technician workspaces', async ({ page }) => {
    await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: managerSession }));
    await page.route('**/api/operations/staff-tasks**', (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: 'task-inc-1',
              kind: 'INCIDENT',
              status: 'ASSIGNED',
              version: 1,
              assigneeName: 'Trần Kỹ Thuật',
              assigneeId: 'tech-test',
              kioskName: 'Tủ Vincom Thủ Đức',
              address: '216 Võ Văn Ngân, Thủ Đức',
              shopName: null,
              instructions: 'Kiểm tra lỗi cảm biến nhiệt độ ngăn A02',
              report: null,
            },
          ],
          page: 1,
          hasMore: false,
        },
      }),
    );
    await page.route('**/api/operations/staff', (route) =>
      route.fulfill({ json: [{ id: 'tech-test', name: 'Trần Kỹ Thuật' }] }),
    );
    await page.route('**/api/**', (route) =>
      route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
    );

    // Operations Manager at 1440px
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/operations');
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: 'artifacts/screenshots/operations-manager-1440px.png',
      fullPage: true,
    });

    // Technician at 390px
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: techSession }));
    await page.route('**/api/staff/tasks**', (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: 'tech-task-1',
              kind: 'INCIDENT',
              status: 'IN_PROGRESS',
              version: 1,
              assigneeName: 'Trần Kỹ Thuật',
              assigneeId: 'tech-test',
              kioskName: 'Tủ Vincom Thủ Đức',
              address: '216 Võ Văn Ngân, Thủ Đức',
              shopName: null,
              instructions: 'Kiểm tra lỗi cảm biến nhiệt độ ngăn A02',
              report: null,
            },
          ],
          page: 1,
          hasMore: false,
        },
      }),
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/technician');
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: 'artifacts/screenshots/technician-390px.png',
      fullPage: true,
    });
  });

  test('Capture Personal Profile and Member Account at 390px, 1024px, and 1440px with style asserts', async ({
    page,
  }) => {
    await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
    await page.route('**/api/**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/auth/me') return route.fulfill({ json: customerSession });
      if (url.pathname === '/api/member/profile')
        return route.fulfill({
          json: {
            id: 'customer-test',
            fullName: 'Khách Hàng Thân Thiết',
            email: 'khachhang@florabot.test',
            loyaltyPoints: 120,
          },
        });
      if (url.pathname === '/api/account/profile')
        return route.fulfill({
          json: {
            userId: 'customer-test',
            fullName: 'Khách Hàng Thân Thiết',
            phone: '0901234567',
            address: '123 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM',
            loginEmail: 'khachhang@florabot.test',
            contactEmail: 'lienhe@florabot.test',
            contactEmailVerified: true,
            contactEmailIsDefault: false,
            bank: {
              hasAccount: true,
              bankName: 'Vietcombank',
              accountHolder: 'KHACH HANG THAN THIET',
              accountLast4: '8888',
            },
          },
        });
      if (url.pathname.includes('/member/history') || url.pathname.endsWith('/preorders')) {
        return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
      }
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    });

    // ==========================================
    // 1. Personal Profile (/ho-so) Viewports & Asserts
    // ==========================================
    // Profile at 1440px
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/ho-so');
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: 'artifacts/screenshots/personal-profile-1440px.png',
      fullPage: true,
    });

    // Profile at 1024px: assert compact h1 <= 36px and no overflow
    await page.setViewportSize({ width: 1024, height: 768 });
    const profileH1Size1024 = await page.getByRole('heading', { level: 1 }).evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    });
    expect(profileH1Size1024).toBeLessThanOrEqual(36);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: 'artifacts/screenshots/personal-profile-1024px.png',
      fullPage: true,
    });

    // Profile at 390px: assert compact h1 <= 28px and no overflow
    await page.setViewportSize({ width: 390, height: 844 });
    const profileH1Size390 = await page.getByRole('heading', { level: 1 }).evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    });
    expect(profileH1Size390).toBeLessThanOrEqual(28);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: 'artifacts/screenshots/personal-profile-390px.png',
      fullPage: true,
    });

    // Verify quick navigation anchors in profile
    const profileNav = page.locator('.profile-quick-nav');
    await expect(profileNav).toBeVisible();
    await expect(profileNav.getByRole('link', { name: 'Tài khoản', exact: true })).toBeVisible();
    await expect(profileNav.getByRole('link', { name: 'Thông tin cá nhân' })).toBeVisible();

    // ==========================================
    // 2. Member Account (/tai-khoan) Viewports & Asserts
    // ==========================================
    // Member account at 1440px
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/tai-khoan');
    await page.waitForLoadState('networkidle');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: 'artifacts/screenshots/member-account-1440px.png',
      fullPage: true,
    });

    // Member account at 1024px: assert compact h1 <= 36px (avoiding 51.2px) and no overflow
    await page.setViewportSize({ width: 1024, height: 768 });
    const memberH1Size1024 = await page.getByRole('heading', { level: 1 }).evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    });
    expect(memberH1Size1024).toBeLessThanOrEqual(36);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: 'artifacts/screenshots/member-account-1024px.png',
      fullPage: true,
    });

    // Member account at 390px: assert compact h1 <= 28px and no overflow
    await page.setViewportSize({ width: 390, height: 844 });
    const memberH1Size390 = await page.getByRole('heading', { level: 1 }).evaluate((el) => {
      return parseFloat(window.getComputedStyle(el).fontSize);
    });
    expect(memberH1Size390).toBeLessThanOrEqual(28);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: 'artifacts/screenshots/member-account-390px.png',
      fullPage: true,
    });

    // Verify tabs expose their corresponding panels in the purchase-focused layout.
    const memberNav = page.locator('.member-tabs');
    await expect(memberNav.getByRole('link', { name: 'Hồ sơ cá nhân' })).toHaveCount(0);
    await expect(memberNav.getByRole('link', { name: 'Bảo mật' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Chỉnh sửa hồ sơ' })).toHaveCount(0);
    await expect(memberNav.getByRole('link', { name: 'Shop của bạn' })).toHaveCount(0);
    await expect(memberNav.getByRole('link', { name: 'Đơn đặt trước' })).toBeVisible();
    await expect(memberNav.getByRole('link', { name: 'Lịch sử mua' })).toBeVisible();
  });
});

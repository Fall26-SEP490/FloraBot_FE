import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const viewports = [320, 390, 1440] as const;

test.describe('Portal UI Polish Verification - Viewports and A11y', () => {
  for (const width of viewports) {
    test(`Admin Overview at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
      await page.route('**/api/auth/me', (route) =>
        route.fulfill({
          json: {
            id: 'admin-1',
            name: 'Quản Trị Viên',
            role: 'ADMIN',
            sellerId: null,
            sellerStatus: null,
            packageExpiresAt: null,
          },
        }),
      );
      await page.route('**/api/admin/incidents?*', (route) =>
        route.fulfill({
          json: {
            items: [
              {
                id: 'inc-1',
                reason: 'Lỗi cảm biến cửa ô A01',
                location: { kioskName: 'Kiosk FPT Thủ Đức' },
                status: 'OPEN',
              },
            ],
            hasMore: true,
          },
        }),
      );
      await page.route('**/api/admin/staff-tasks?*', (route) =>
        route.fulfill({
          json: {
            items: [
              {
                id: 'task-1',
                kind: 'INCIDENT',
                kioskName: 'Kiosk FPT Thủ Đức',
                assigneeName: 'Nguyễn Kỹ Thuật',
                status: 'SUBMITTED',
              },
            ],
            hasMore: true,
          },
        }),
      );
      await page.route('**/api/admin/preorders?*', (route) =>
        route.fulfill({ json: { items: [], hasMore: false } }),
      );

      await page.goto('/admin');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Quản Trị Viên');

      // Admin Overview button must say task tracking (not assignment)
      const trackingButton = page.getByRole('link', { name: 'Theo dõi công việc' });
      await expect(trackingButton).toBeVisible();

      // Counts state first-page limits
      await expect(page.locator('.dashboard-focus-chips')).toContainText('Sự cố trong trang đầu');
      await expect(page.locator('.dashboard-focus-chips')).toContainText('Báo cáo trong trang đầu');

      // A11y and reflow
      const a11y = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(a11y.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );

      await page.screenshot({
        path: `artifacts/review-admin-overview-${width}.png`,
        fullPage: true,
      });
    });

    test(`Admin Shops at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
      await page.route('**/api/auth/me', (route) =>
        route.fulfill({
          json: {
            id: 'admin-1',
            name: 'Quản Trị Viên',
            role: 'ADMIN',
            sellerId: null,
            sellerStatus: null,
            packageExpiresAt: null,
          },
        }),
      );
      await page.route('**/api/admin/sellers*', (route) =>
        route.fulfill({
          json: [
            {
              id: 'shop-1',
              shopName: 'Tiệm Hoa Mùa Xuân',
              phone: '0901234567',
              address: 'Quận 1, TP.HCM',
              status: 'PENDING',
              packageId: null,
              packageExpiresAt: null,
            },
          ],
        }),
      );
      await page.route('**/api/packages', (route) =>
        route.fulfill({
          json: [{ id: 'pkg-1', name: 'Gói Cơ Bản', monthlyFee: 500000, maxSlots: 5 }],
        }),
      );

      await page.goto('/admin/shops');
      await expect(page.getByRole('heading', { name: 'Hồ sơ các shop hoa' })).toBeVisible();
      await expect(page.getByText('Tiệm Hoa Mùa Xuân', { exact: true })).toBeVisible();

      const a11y = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(a11y.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );

      await page.screenshot({
        path: `artifacts/review-admin-shops-${width}.png`,
        fullPage: true,
      });
    });

    test(`Seller Overview at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
      await page.route('**/api/auth/me', (route) =>
        route.fulfill({
          json: {
            id: 'seller-1',
            name: 'Chủ Shop Hoa',
            role: 'SELLER',
            sellerId: 'shop-1',
            sellerStatus: 'ACTIVE',
            packageExpiresAt: '2026-12-31',
          },
        }),
      );
      await page.route('**/api/sellers/shop-1/products', (route) =>
        route.fulfill({
          json: [
            {
              id: 'prod-1',
              name: 'Bó Hoa Lụa Cẩm Tú Cầu',
              price: 450000,
              status: 'ACTIVE',
              inventoryKind: 'ARTIFICIAL',
            },
          ],
        }),
      );
      await page.route('**/api/sellers/shop-1/wallet', (route) =>
        route.fulfill({
          json: {
            balance: { availableBalance: 2500000, pendingBalance: 500000 },
            bankConfigured: true,
            entries: [],
            withdrawals: [],
          },
        }),
      );
      await page.route('**/api/sellers/shop-1/preorders?*', (route) =>
        route.fulfill({ json: { items: [], hasMore: false } }),
      );

      await page.goto('/seller');
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tổng quan cửa hàng');
      await expect(page.getByText('Chào Chủ Shop Hoa')).toBeVisible();

      // Seller entitlement must be labeled as sellerStatus, not subscription status
      await expect(page.getByText('Trạng thái shop:')).toBeVisible();

      // DashboardOverview relies on the shared operations layout stylesheet.
      // Keep this assertion so route-level code splitting cannot silently drop that CSS again.
      await expect(page.locator('.operations-welcome')).toHaveCSS('display', 'flex');
      await expect(page.locator('.operations-metrics')).toHaveCSS('display', 'grid');

      const a11y = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(a11y.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );

      await page.screenshot({
        path: `artifacts/review-seller-overview-${width}.png`,
        fullPage: true,
      });
    });

    test(`Seller Products at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
      await page.route('**/api/auth/me', (route) =>
        route.fulfill({
          json: {
            id: 'seller-1',
            name: 'Chủ Shop Hoa',
            role: 'SELLER',
            sellerId: 'shop-1',
            sellerStatus: 'ACTIVE',
            packageExpiresAt: '2026-12-31',
          },
        }),
      );
      await page.route('**/api/me/products', (route) =>
        route.fulfill({
          json: [
            {
              id: 'prod-1',
              name: 'Bó Hoa Lụa Cẩm Tú Cầu',
              description: 'Bó hoa giả cao cấp trang trí phòng khách.',
              price: 450000,
              tags: ['hoa lụa', 'quà tặng'],
              status: 'ACTIVE',
              inventoryKind: 'ARTIFICIAL',
              lengthCm: 30,
              widthCm: 20,
              heightCm: 45,
            },
          ],
        }),
      );
      await page.route('**/api/sellers/shop-1/kiosks', (route) => route.fulfill({ json: [] }));
      await page.route('**/api/me/products/prod-1/photos?*', (route) =>
        route.fulfill({ json: { items: [], hasMore: false } }),
      );
      await page.route('**/api/sellers/shop-1/chats?*', (route) =>
        route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
      );
      await page.route('**/api/sellers/shop-1/wallet', (route) =>
        route.fulfill({ json: { balance: null } }),
      );
      await page.route('**/api/sellers/shop-1/subscriptions', (route) =>
        route.fulfill({ json: { package: null, subscriptions: [] } }),
      );
      await page.route('**/api/sellers/shop-1/slots', (route) => route.fulfill({ json: [] }));

      await page.goto('/seller/products');
      await expect(page.getByRole('heading', { name: 'Những bó hoa của shop' })).toBeVisible();

      // Open product details
      await page.locator('.product-list summary').click();
      await expect(
        page.getByText('Bó hoa giả cao cấp — không áp dụng thời hạn tươi.'),
      ).toBeVisible();
      await expect(page.getByText('Kích thước: 30 × 20 × 45 cm (Dài × Rộng × Cao)')).toBeVisible();

      const a11y = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(a11y.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );

      await page.screenshot({
        path: `artifacts/review-seller-products-${width}.png`,
        fullPage: true,
      });
    });

    test(`Admin Tasks Oversight (Role 1) at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
      await page.route('**/api/auth/me', (route) =>
        route.fulfill({
          json: {
            id: 'admin-1',
            name: 'Quản Trị Viên',
            role: 'ADMIN',
            sellerId: null,
            sellerStatus: null,
            packageExpiresAt: null,
          },
        }),
      );
      await page.route('**/api/admin/staff-tasks?*', (route) =>
        route.fulfill({
          json: {
            items: [
              {
                id: 'task-1',
                kind: 'INCIDENT',
                kioskName: 'Kiosk FPT',
                assigneeName: 'Nguyễn Kỹ Thuật',
                status: 'IN_PROGRESS',
                version: 1,
                instructions: 'Kiểm tra chốt khoá ô A02',
                address: 'Khu CNC, Q9',
                shopName: null,
                report: null,
              },
            ],
            page: 1,
            hasMore: false,
          },
        }),
      );

      await page.goto('/admin/tasks');
      await expect(page.getByRole('heading', { name: 'Theo dõi công việc' })).toBeVisible();
      // Admin is read-only oversight: cannot assign new tasks
      await expect(page.getByText('Phân công công việc mới')).toHaveCount(0);

      const a11y = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(a11y.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );

      await page.screenshot({
        path: `artifacts/review-tasks-admin-${width}.png`,
        fullPage: true,
      });
    });

    test(`Operations Manager Tasks (Role 2) at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
      await page.route('**/api/auth/me', (route) =>
        route.fulfill({
          json: {
            id: 'ops-1',
            name: 'Nguyễn Quản Lý',
            role: 'OPERATIONS_MANAGER',
            sellerId: null,
            sellerStatus: null,
            packageExpiresAt: null,
          },
        }),
      );
      await page.route('**/api/operations/staff-tasks?*', (route) =>
        route.fulfill({
          json: {
            items: [
              {
                id: 'task-2',
                kind: 'INCIDENT',
                kioskName: 'Kiosk FPT',
                assigneeName: 'Trần Kỹ Thuật',
                status: 'SUBMITTED',
                version: 1,
                instructions: 'Xử lý kẹt cửa ô B01',
                address: 'Quận 9',
                shopName: null,
                report: 'Đã căn chỉnh chốt cửa và bôi trơn bản lề.',
              },
            ],
            page: 1,
            hasMore: false,
          },
        }),
      );
      await page.route('**/api/operations/staff', (route) =>
        route.fulfill({ json: [{ id: 'tech-1', name: 'Trần Kỹ Thuật' }] }),
      );
      await page.route('**/api/operations/incidents?*', (route) =>
        route.fulfill({ json: { items: [], hasMore: false } }),
      );

      await page.goto('/operations/tasks');
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        'Điều phối công việc kỹ thuật',
      );
      await expect(page.getByText('Quản lý vận hành').first()).toBeVisible();

      const a11y = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(a11y.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );

      await page.screenshot({
        path: `artifacts/review-tasks-operations-${width}.png`,
        fullPage: true,
      });
    });

    test(`Technician Tasks (Role 3) at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
      await page.route('**/api/auth/me', (route) =>
        route.fulfill({
          json: {
            id: 'tech-1',
            name: 'Trần Kỹ Thuật',
            role: 'TECHNICIAN',
            sellerId: null,
            sellerStatus: null,
            packageExpiresAt: null,
          },
        }),
      );
      await page.route('**/api/staff/tasks?*', (route) =>
        route.fulfill({
          json: {
            items: [
              {
                id: 'task-3',
                kind: 'INCIDENT',
                kioskName: 'Kiosk FPT',
                assigneeName: 'Trần Kỹ Thuật',
                status: 'ASSIGNED',
                version: 1,
                instructions: 'Kiểm tra lỗi cảm biến nhiệt độ',
                address: 'Quận 9',
                shopName: null,
                report: null,
              },
            ],
            page: 1,
            hasMore: false,
          },
        }),
      );

      await page.goto('/technician');
      await expect(page.getByRole('heading', { level: 1 })).toContainText('Trần Kỹ Thuật');
      await expect(page.getByText('Kỹ thuật viên').first()).toBeVisible();

      const a11y = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(a11y.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );

      await page.screenshot({
        path: `artifacts/review-tasks-technician-${width}.png`,
        fullPage: true,
      });
    });

    test(`Seller Tasks (Role 4) at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
      await page.route('**/api/auth/me', (route) =>
        route.fulfill({
          json: {
            id: 'seller-1',
            name: 'Chủ Shop Hoa',
            role: 'SELLER',
            sellerId: 'shop-1',
            sellerStatus: 'ACTIVE',
            packageExpiresAt: '2026-12-31',
          },
        }),
      );
      await page.route('**/api/sellers/shop-1/staff-tasks?*', (route) =>
        route.fulfill({
          json: {
            items: [
              {
                id: 'task-4',
                kind: 'DELIVERY',
                kioskName: 'Kiosk Landmark 81',
                assigneeName: 'Lê Giao Hoa',
                status: 'ASSIGNED',
                version: 1,
                instructions: 'Nạp hoa lụa vào các ô đã đặt',
                address: 'Bình Thạnh',
                shopName: 'Tiệm Hoa Mùa Xuân',
                report: null,
              },
            ],
            page: 1,
            hasMore: false,
          },
        }),
      );
      await page.route('**/api/sellers/shop-1/staff', (route) =>
        route.fulfill({ json: [{ id: 'staff-1', name: 'Lê Giao Hoa' }] }),
      );
      await page.route('**/api/sellers/shop-1/staff-delivery-scopes', (route) =>
        route.fulfill({
          json: [
            {
              sellerId: 'shop-1',
              shopName: 'Tiệm Hoa Mùa Xuân',
              kioskId: 'k-1',
              kioskName: 'Kiosk Landmark 81',
              address: 'Bình Thạnh',
            },
          ],
        }),
      );

      await page.goto('/seller/tasks');
      await expect(page.getByRole('heading', { name: 'Phân công giao hoa' })).toBeVisible();

      const a11y = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(a11y.violations).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );

      await page.screenshot({
        path: `artifacts/review-tasks-seller-${width}.png`,
        fullPage: true,
      });
    });
  }
});

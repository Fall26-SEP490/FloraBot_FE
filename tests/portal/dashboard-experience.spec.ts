import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const role of ['ADMIN', 'SELLER', 'SELLER_STAFF'] as const) {
  for (const width of [390, 1440]) {
    test(`${role} dashboard has scoped data and accessible navigation ${width}`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 1000 });
      const requests: string[] = [];
      await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
      await page.route('**/api/**', (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/auth/me')
          return route.fulfill({
            json: {
              id: 'person',
              name: 'Ngọc Anh',
              role,
              sellerId: role === 'SELLER' || role === 'SELLER_STAFF' ? 'my-shop' : null,
              sellerStatus: 'ACTIVE',
              packageExpiresAt: '2030-01-01',
            },
          });
        requests.push(path);
        if (path.endsWith('/incidents'))
          return route.fulfill({
            json: {
              items: [
                {
                  id: 'issue-1',
                  location: { kioskName: 'Tủ Nhà Văn hóa Thanh Niên' },
                  reason: 'Cửa ô A02 chưa đóng sau lượt nhận hoa',
                  status: 'OPEN',
                },
              ],
              page: 1,
              hasMore: true,
            },
          });
        if (path.endsWith('/staff-tasks') || path.endsWith('/tasks'))
          return route.fulfill({
            json: {
              items: [
                {
                  id: 'task-1',
                  kind: 'DELIVERY',
                  kioskName: 'Tủ Đại học FPT',
                  assigneeName: 'Ngọc Anh',
                  assigneeId: 'person',
                  status: 'SUBMITTED',
                  version: 1,
                  instructions: 'Đã giao hoa và kiểm tra ô nhận.',
                  address: 'Thủ Đức, TP.HCM',
                  shopName: 'Tiệm Hoa Nhỏ',
                  report: 'Đã hoàn tất giao hoa, chờ quản trị viên kiểm tra.',
                },
              ],
              page: 1,
              hasMore: false,
            },
          });
        if (path.endsWith('/products'))
          return route.fulfill({
            json: [
              { id: 'p1', status: 'ACTIVE' },
              { id: 'p2', status: 'DRAFT' },
            ],
          });
        if (path.endsWith('/wallet'))
          return route.fulfill({
            json: {
              balance: { availableBalance: 1250000, pendingBalance: 350000 },
              entries: [],
              bankConfigured: true,
              withdrawals: [],
            },
          });
        if (path.endsWith('/preorders'))
          return route.fulfill({
            json: {
              items: [
                {
                  id: 'order-1',
                  productName: 'Bó hồng pastel',
                  kioskName: 'Tủ Đại học FPT',
                  pickupAt: '2026-10-12T09:00:00Z',
                  state: 'REQUESTED',
                  orderStatus: null,
                  ready: false,
                },
              ],
              page: 1,
              hasMore: false,
            },
          });
        return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
      });
      await page.goto(role === 'ADMIN' ? '/admin' : role === 'SELLER' ? '/seller' : '/staff');
      if (role === 'SELLER') {
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tổng quan cửa hàng');
        await expect(page.getByText('Chào Ngọc Anh')).toBeVisible();
      } else if (role === 'ADMIN') {
        await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tổng quan quản trị');
      } else {
        await expect(page.getByRole('heading', { level: 1 })).toContainText('Ngọc Anh');
      }
      if (role === 'ADMIN')
        await expect(page.getByText('Cửa ô A02 chưa đóng sau lượt nhận hoa')).toBeVisible();
      if (role === 'SELLER') await expect(page.getByText(/1\.250\.000/)).toBeVisible();
      if (role === 'SELLER_STAFF')
        await expect(
          page.getByRole('heading', { name: 'Giao hoa · Tủ Đại học FPT' }),
        ).toBeVisible();
      expect(
        requests.every((path) =>
          path.startsWith(
            role === 'ADMIN'
              ? '/api/admin/'
              : role === 'SELLER'
                ? '/api/sellers/my-shop/'
                : '/api/staff/',
          ),
        ),
      ).toBe(true);
      if (width < 900) {
        const toggle = page.getByRole('button', { name: 'Mở danh mục quản lý' });
        await toggle.click();
        const firstLink = page
          .getByRole('navigation', { name: 'Điều hướng quản lý' })
          .getByRole('link')
          .first();
        await firstLink.focus();
        await page.keyboard.press('Escape');
        await expect(toggle).toBeFocused();
        await expect(page.getByRole('navigation', { name: 'Điều hướng quản lý' })).toBeHidden();
      }
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
      await page.screenshot({
        path: `artifacts/dashboard-new-${role.toLowerCase()}-${width}.png`,
        fullPage: true,
      });
    });
  }
}

test('One failed overview feed stays recoverable without hiding other data', async ({ page }) => {
  let failed = true;
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { id: 'admin', name: 'Admin', role: 'ADMIN' } }),
  );
  await page.route('**/api/admin/preorders?*', (route) =>
    route.fulfill({ json: { items: [], hasMore: false } }),
  );
  await page.route('**/api/admin/staff-tasks?*', (route) =>
    route.fulfill({
      json: {
        items: [{ id: 't', kioskName: 'Tủ FPT', assigneeName: 'Nhân viên Hoa', kind: 'DELIVERY' }],
        hasMore: false,
      },
    }),
  );
  await page.route('**/api/admin/incidents?*', (route) =>
    failed
      ? route.fulfill({ status: 503 })
      : route.fulfill({ json: { items: [], hasMore: false } }),
  );
  await page.goto('/admin');
  const panel = page.getByRole('region', { name: 'Sự cố cần xử lý' });
  await expect(panel.getByRole('alert')).toContainText('Chưa tải được');
  await expect(page.getByText('Nhân viên Hoa', { exact: true })).toBeVisible();
  await expect(panel.getByText('Chưa có mục nào trong danh sách')).toHaveCount(0);
  failed = false;
  await panel.getByRole('button', { name: 'Thử lại sự cố cần xử lý' }).click();
  await expect(panel.getByText('Chưa có mục nào trong danh sách')).toBeVisible();
});

test('Empty wallet does not fabricate a financial balance', async ({ page }) => {
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'seller',
        name: 'Shop',
        role: 'SELLER',
        sellerId: 'shop',
        sellerStatus: 'ACTIVE',
        packageExpiresAt: '2030-01-01',
      },
    }),
  );
  await page.route('**/api/sellers/shop/products', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/sellers/shop/preorders?*', (route) =>
    route.fulfill({ json: { items: [], hasMore: false } }),
  );
  await page.route('**/api/sellers/shop/wallet', (route) =>
    route.fulfill({ json: { balance: null } }),
  );
  await page.goto('/seller');
  await expect(page.getByText('Ví chưa có số dư được ghi nhận.')).toBeVisible();
  await expect(
    page.getByRole('region', { name: 'Tình hình cửa hàng' }).getByText(/0\s*₫/),
  ).toHaveCount(0);
  await page.setViewportSize({ width: 320, height: 1000 });
  await page.addStyleTag({ content: ':root { font-size: 36px !important; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

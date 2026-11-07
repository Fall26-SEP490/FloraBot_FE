import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/admin/refunds?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/admin/complaints?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/admin/withdrawals?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/admin/incidents?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/admin/slots', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: '10000000-0000-0000-0000-000000000001',
        name: 'Quản trị viên',
        role: 'ADMIN',
        sellerId: null,
        sellerStatus: null,
        packageExpiresAt: null,
      },
    }),
  );
});

test('Admin can retry a failed seller read without the retired monthly package API', async ({
  page,
}) => {
  let listReady = false;
  const retired: string[] = [];
  await page.route('**/api/packages', (route) => {
    retired.push(route.request().url());
    return route.fulfill({ status: 404 });
  });
  await page.route('**/api/admin/sellers*', (route) =>
    route.fulfill(listReady ? { json: [] } : { status: 503 }),
  );
  await page.goto('/admin/shops');
  await expect(page.getByRole('button', { name: 'Tải lại hồ sơ' })).toBeVisible();
  listReady = true;
  await page.getByRole('button', { name: 'Tải lại hồ sơ' }).click();
  await expect(page.locator('.admin-sellers').getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('Không có hồ sơ phù hợp với bộ lọc hiện tại.')).toBeVisible();
  expect(retired).toEqual([]);
});

for (const width of [390, 1440]) {
  test(`Admin shop directory shows annual lease expiry, filters and accessibility ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    const shops = [
      {
        id: '20000000-0000-0000-0000-000000000099',
        shopName: 'Tiệm Hoa Ban Mai',
        phone: '0901234567',
        address: 'Thủ Đức',
        status: 'PENDING',
        packageId: null,
        packageExpiresAt: null,
      },
      {
        id: '20000000-0000-0000-0000-000000000098',
        shopName: 'Hoa Sài Gòn',
        phone: '0907654321',
        address: 'Quận 1',
        status: 'ACTIVE',
        packageId: null,
        packageExpiresAt: '2027-11-07',
      },
    ];
    await page.route('**/api/admin/sellers*', (route) => {
      const status = new URL(route.request().url()).searchParams.get('status');
      return route.fulfill({ json: shops.filter((shop) => !status || shop.status === status) });
    });
    await page.goto('/admin/shops');
    await page.getByLabel('Tìm tên shop hoặc số điện thoại').fill('không tìm thấy');
    await expect(page.getByText('Không có hồ sơ phù hợp với bộ lọc hiện tại.')).toBeVisible();
    await page.getByLabel('Tìm tên shop hoặc số điện thoại').fill('');
    await page.getByLabel('Lọc trạng thái shop').selectOption('ACTIVE');
    await expect(page.locator('.admin-shop-list li')).toHaveCount(1);
    await page.locator('.admin-shop-list summary').click();
    await expect(page.locator('.shop-profile')).toContainText('7/11/2027');
    await page.getByLabel('Lọc trạng thái shop').selectOption('PENDING');
    await page.locator('.admin-shop-list summary').click();
    await expect(page.locator('.shop-profile')).toContainText(
      'Chưa có kỳ thuê kiosk đang hiệu lực',
    );
    await expect(
      page.locator('.shop-profile').getByRole('link', { name: 'Hồ sơ thuê kiosk' }),
    ).toHaveAttribute('href', '/admin/installations');
    await expect(page.getByRole('button', { name: 'Duyệt hồ sơ shop' })).toHaveCount(0);
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

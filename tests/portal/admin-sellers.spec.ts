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
});

test.beforeEach(async ({ page }) => {
  await page.route('**/api/admin/incidents?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
});

test.beforeEach(async ({ page }) => {
  await page.route('**/api/admin/slots', (route) => route.fulfill({ json: [] }));
});

test('Admin can retry failed seller and package reads', async ({ page }) => {
  let listReady = false;
  let packagesReady = false;
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
  await page.route('**/api/admin/sellers*', (route) =>
    route.fulfill(
      listReady || new URL(route.request().url()).searchParams.get('status') === 'ACTIVE'
        ? { json: [] }
        : { status: 503 },
    ),
  );
  await page.route('**/api/packages', (route) =>
    route.fulfill(packagesReady ? { json: [] } : { status: 503 }),
  );
  await page.goto('/admin/shops');
  await expect(page.getByRole('button', { name: 'Tải lại hồ sơ' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tải lại gói thuê' })).toBeVisible();
  listReady = true;
  packagesReady = true;
  await page.getByRole('button', { name: 'Tải lại hồ sơ' }).click();
  await page.getByRole('button', { name: 'Tải lại gói thuê' }).click();
  await expect(page.locator('.admin-sellers').getByRole('alert')).toHaveCount(0);
  await expect(page.getByText('Không có hồ sơ phù hợp với bộ lọc hiện tại.')).toBeVisible();
});

for (const width of [390, 1440]) {
  test(`Admin approval, retry, filters and accessibility ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    const shop = {
      id: '20000000-0000-0000-0000-000000000099',
      shopName: 'Tiệm Hoa Ban Mai',
      phone: '0901234567',
      address: 'Thủ Đức',
      status: 'PENDING',
      packageId: null as string | null,
      packageExpiresAt: null,
    };
    const packageId = '20000000-0000-0000-0000-00000000000a';
    let attempts = 0;
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
    await page.route('**/api/packages', (route) =>
      route.fulfill({ json: [{ id: packageId, name: 'Cơ bản', monthlyFee: 400000, maxSlots: 3 }] }),
    );
    await page.route('**/api/admin/sellers*', (route) => {
      const status = new URL(route.request().url()).searchParams.get('status');
      return route.fulfill({ json: !status || status === shop.status ? [shop] : [] });
    });
    await page.route('**/api/admin/flows/approve_seller', (route) => {
      expect(route.request().postDataJSON()).toEqual({ p_seller: shop.id, p_package: packageId });
      attempts++;
      if (attempts === 1)
        return route.fulfill({
          status: 409,
          json: { detail: 'Chưa duyệt được hồ sơ. Hãy thử lại.' },
        });
      shop.status = 'APPROVED';
      shop.packageId = packageId;
      return route.fulfill({ status: 204 });
    });
    await page.goto('/admin/shops');
    await page.getByLabel('Lọc trạng thái shop').selectOption('PENDING');
    await page.getByLabel('Tìm tên shop hoặc số điện thoại').fill('không tìm thấy');
    await expect(page.getByText('Không có hồ sơ phù hợp với bộ lọc hiện tại.')).toBeVisible();
    await page.getByLabel('Tìm tên shop hoặc số điện thoại').fill('0901234567');
    await page.locator('.admin-sellers .admin-shop-list summary').click();
    await page.getByRole('button', { name: 'Duyệt hồ sơ shop' }).click();
    const select = page.getByLabel('Gói thuê cho Tiệm Hoa Ban Mai');
    await expect(select).toBeFocused();
    await expect(page.getByText('Chọn gói thuê đã thống nhất với shop.')).toBeVisible();
    expect(attempts).toBe(0);
    await select.selectOption(packageId);
    await page.getByRole('button', { name: 'Duyệt hồ sơ shop' }).click();
    await expect(page.locator('.admin-sellers').getByRole('alert')).toHaveText(
      'Chưa duyệt được hồ sơ. Hãy thử lại.',
    );
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
    await page.screenshot({ path: `.impeccable/review/portal-admin-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Duyệt hồ sơ shop' }).click();
    await expect(
      page.getByRole('status').filter({ hasText: 'Đã duyệt Tiệm Hoa Ban Mai' }),
    ).toBeVisible();
    await expect(
      page.getByRole('status').filter({ hasText: 'Đã duyệt Tiệm Hoa Ban Mai' }),
    ).toBeFocused();
    await expect(page.locator('.admin-shop-list li')).toHaveCount(0);
    await page.getByLabel('Lọc trạng thái shop').selectOption('APPROVED');
    await expect(page.locator('.admin-shop-list li')).toHaveCount(1);
    await page.locator('.admin-shop-list summary').click();
    await expect(page.getByRole('button', { name: 'Duyệt hồ sơ shop' })).toHaveCount(0);
    expect(attempts).toBe(2);
  });
}

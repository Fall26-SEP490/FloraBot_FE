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

for (const width of [390, 1440]) {
  test(`Admin slot assignment with conflicts and accessible focus ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    const seller = {
      id: '20000000-0000-0000-0000-000000000099',
      shopName: 'Tiệm Hoa Ban Mai',
      phone: '0901234567',
      address: 'Thủ Đức',
      status: 'ACTIVE',
      packageId: null,
      packageExpiresAt: '2099-12-31',
    };
    const slot = {
      id: '30000000-0000-0000-0000-000000000099',
      kioskId: '40000000-0000-0000-0000-000000000099',
      slotCode: 'A01',
      status: 'FREE',
      currentSellerId: null as string | null,
      bouquetId: null,
      kioskCode: 'FPT-01',
      kioskName: 'Đại học FPT',
      kioskAddress: 'Khu Công nghệ cao, Thủ Đức',
      kioskStatus: 'ONLINE',
    };
    let attempts = 0;
    let ready = false;
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
    await page.route('**/api/packages', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/admin/sellers*', (route) =>
      route.fulfill({
        json:
          new URL(route.request().url()).searchParams.get('status') === 'ACTIVE' ? [seller] : [],
      }),
    );
    await page.route('**/api/admin/slots', (route) =>
      route.fulfill(ready ? { json: [slot] } : { status: 503 }),
    );
    await page.route('**/api/admin/flows/assign_slot', (route) => {
      expect(route.request().postDataJSON()).toEqual({ p_slot: slot.id, p_seller: seller.id });
      attempts++;
      if (attempts === 1)
        return route.fulfill({ status: 409, json: { detail: 'Vượt hạn mức ô của gói.' } });
      slot.status = 'RENTED_EMPTY';
      slot.currentSellerId = seller.id;
      return route.fulfill({ json: '50000000-0000-0000-0000-000000000099' });
    });
    await page.goto('/admin/slots');
    const section = page.locator('.admin-slots');
    await expect(section.getByRole('alert')).toContainText('Chưa tải được ô tủ');
    ready = true;
    await section.getByRole('button', { name: 'Làm mới danh sách ô' }).click();
    await section.getByLabel('Tìm kiosk, địa chỉ hoặc mã ô').fill('không tìm thấy');
    await expect(section.getByText('Không có ô phù hợp với bộ lọc hiện tại.')).toBeVisible();
    await section.getByLabel('Tìm kiosk, địa chỉ hoặc mã ô').fill('FPT-01');
    await section.locator('summary').click();
    await section.getByRole('button', { name: 'Gán ô cho shop' }).click();
    await expect(section.getByLabel('Shop thuê ô A01')).toBeFocused();
    expect(attempts).toBe(0);
    await section.getByLabel('Shop thuê ô A01').selectOption(seller.id);
    await section.getByRole('button', { name: 'Gán ô cho shop' }).click();
    await expect(section.getByRole('alert')).toHaveText('Vượt hạn mức ô của gói.');
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
    await section.screenshot({ path: `.impeccable/review/portal-slots-${width}.png` });
    await section.getByRole('button', { name: 'Gán ô cho shop' }).click();
    await expect(section.getByRole('status').filter({ hasText: 'Đã gán ô A01' })).toBeFocused();
    await expect(section.locator('li')).toHaveCount(0);
    await section.getByLabel('Lọc trạng thái ô').selectOption('RENTED_EMPTY');
    await section.locator('summary').click();
    await expect(section.getByText('Tiệm Hoa Ban Mai', { exact: true })).toBeVisible();
    await expect(section.getByRole('button', { name: 'Gán ô cho shop' })).toHaveCount(0);
    expect(attempts).toBe(2);
  });
}

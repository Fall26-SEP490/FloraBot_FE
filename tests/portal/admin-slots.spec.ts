import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/admin/withdrawals?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/admin/incidents?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
});

for (const width of [390, 1440]) {
  test(`Admin assigns a whole kiosk with conflict handling and accessible focus ${width}`, async ({
    page,
  }) => {
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
    const kiosk = {
      id: '40000000-0000-0000-0000-000000000099',
      code: 'FPT-01',
      name: 'Đại học FPT',
      status: 'ONLINE',
      sellerId: null as string | null,
      sellerName: null as string | null,
      slotCount: 6,
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
    await page.route('**/api/admin/kiosks', (route) =>
      route.fulfill(ready ? { json: [kiosk] } : { status: 503 }),
    );
    await page.route('**/api/admin/flows/assign_kiosk', (route) => {
      expect(route.request().postDataJSON()).toEqual({ p_kiosk: kiosk.id, p_seller: seller.id });
      attempts++;
      if (attempts === 1) {
        return route.fulfill({
          status: 409,
          json: { detail: 'Kiosk còn hoa hoặc đang có giao dịch.' },
        });
      }
      kiosk.sellerId = seller.id;
      kiosk.sellerName = seller.shopName;
      return route.fulfill({ json: { result: null } });
    });

    await page.goto('/admin/slots');
    const section = page.locator('.admin-slots');
    await expect(section.getByRole('alert')).toContainText('Chưa tải được kiosk');
    ready = true;
    await section.getByRole('button', { name: 'Làm mới danh sách kiosk' }).click();
    await section.getByLabel('Tìm mã kiosk, tên kiosk hoặc shop').fill('không tìm thấy');
    await expect(section.getByText('Không có kiosk phù hợp với bộ lọc hiện tại.')).toBeVisible();
    await section.getByLabel('Tìm mã kiosk, tên kiosk hoặc shop').fill('FPT-01');
    await section.locator('summary').click();

    await section.getByRole('button', { name: 'Gán kiosk cho shop' }).click();
    await expect(section.getByLabel('Shop quản lý toàn bộ kiosk')).toBeFocused();
    expect(attempts).toBe(0);

    await section.getByLabel('Shop quản lý toàn bộ kiosk').selectOption(seller.id);
    await section.getByRole('button', { name: 'Gán kiosk cho shop' }).click();
    await page.getByRole('button', { name: 'Gán toàn bộ kiosk' }).click();
    await expect(section.getByRole('alert')).toHaveText('Kiosk còn hoa hoặc đang có giao dịch.');

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
    await section.screenshot({ path: `.impeccable/review/portal-kiosks-${width}.png` });

    await section.getByRole('button', { name: 'Gán kiosk cho shop' }).click();
    await page.getByRole('button', { name: 'Gán toàn bộ kiosk' }).click();
    await expect(
      section.getByRole('status').filter({ hasText: 'Đã gán toàn bộ kiosk Đại học FPT' }),
    ).toBeFocused();
    await expect(section.locator('li')).toHaveCount(0);
    await section.getByLabel('Lọc phân bổ').selectOption('ASSIGNED');
    await section.locator('summary').click();
    await expect(section.getByText('Tiệm Hoa Ban Mai', { exact: true })).toBeVisible();
    await expect(
      section.getByRole('button', { name: 'Chuyển kiosk sang shop khác' }),
    ).toBeVisible();
    expect(attempts).toBe(2);
  });
}

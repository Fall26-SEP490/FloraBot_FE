import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
});

for (const width of [390, 1440]) {
  test(`Seller stocks a batch, handles uncertainty and reads inventory ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    const sellerId = '20000000-0000-0000-0000-000000000099';
    const product = {
      id: '30000000-0000-0000-0000-000000000099',
      name: 'Hoa hồng dịu dàng',
      description: '',
      price: 350000,
      tags: [],
      status: 'ACTIVE',
      shelfLifeHours: 48,
    };
    const slots = ['A01', 'A02'].map((slotCode, i) => ({
      id: `40000000-0000-0000-0000-00000000000${i}`,
      kioskId: '50000000-0000-0000-0000-000000000099',
      slotCode,
      status: 'RENTED_EMPTY',
      bouquetId: null as string | null,
      kioskCode: 'FPT-01',
      kioskName: 'Đại học FPT',
      kioskAddress: 'Thủ Đức',
      productId: null as string | null,
      qrCode: null as string | null,
      priceSnapshot: null as number | null,
      sellableUntil: null as string | null,
    }));
    let attempts = 0;
    const batches: string[] = [];
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: {
          id: 'user',
          name: 'Shop hoa',
          role: 'SELLER',
          sellerId,
          sellerStatus: 'ACTIVE',
          packageExpiresAt: '2099-12-31',
        },
      }),
    );
    await page.route('**/api/**/products', (route) => route.fulfill({ json: [product] }));
    await page.route('**/api/**/subscriptions', (route) =>
      route.fulfill({ json: { package: null, subscriptions: [] } }),
    );
    await page.route('**/api/**/slots', (route) => route.fulfill({ json: slots }));
    await page.route('**/flows/stock_bouquet', (route) => {
      const body = route.request().postDataJSON() as {
        p_batch: string;
        p_slot: string;
        p_product: string;
        p_qr: string;
      };
      expect(Object.keys(body).sort()).toEqual(['p_batch', 'p_product', 'p_qr', 'p_slot']);
      expect(body.p_batch).toMatch(/^[0-9a-f-]{36}$/);
      expect(body.p_product).toBe(product.id);
      batches.push(body.p_batch);
      attempts++;
      if (attempts === 1)
        return route.fulfill({
          status: 409,
          json: { detail: 'Ô đang được cập nhật. Kiểm tra lại trước khi nạp.' },
        });
      const slot = slots.find((item) => item.id === body.p_slot)!;
      Object.assign(slot, {
        status: 'STOCKED',
        bouquetId: 'bouquet-id',
        productId: product.id,
        qrCode: body.p_qr,
        priceSnapshot: 350000,
        sellableUntil: '2026-10-09T10:00:00Z',
      });
      // Simulate a committed write whose response is lost: the subsequent read is authoritative.
      return attempts === 3 ? route.abort() : route.fulfill({ json: { result: 'bouquet-id' } });
    });
    await page.goto('/seller/stock');
    const section = page.locator('.seller-stock');
    await section.getByRole('button', { name: 'Ghi nhận bó hoa vào ô' }).click();
    await expect(section.getByLabel('Ô trống của shop')).toBeFocused();
    await expect(section.getByText('Nhập mã trên tem của bó hoa.')).toBeVisible();
    expect(attempts).toBe(0);
    await section.getByLabel('Ô trống của shop').selectOption(slots[0].id);
    await section.getByLabel('Sản phẩm nạp vào ô').selectOption(product.id);
    await section.getByLabel('Mã trên tem bó hoa').fill('FLOWER-001');
    await section.getByRole('button', { name: 'Ghi nhận bó hoa vào ô' }).click();
    await expect(section.getByRole('alert')).toContainText('Ô đang được cập nhật');
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
    await section.screenshot({ path: `.impeccable/review/portal-stock-${width}.png` });
    await section.getByRole('button', { name: 'Ghi nhận bó hoa vào ô' }).click();
    await expect(
      section.getByRole('status').filter({ hasText: 'Đã ghi nhận bó FLOWER-001' }),
    ).toBeFocused();
    await expect(
      section.getByText('Lô hiện tại: đã nhận phản hồi thành công cho 1 bó.'),
    ).toBeVisible();
    await section.locator('summary').first().click();
    await expect(section.getByText('FLOWER-001', { exact: true })).toBeVisible();
    await section.getByLabel('Ô trống của shop').selectOption(slots[1].id);
    await section.getByLabel('Mã trên tem bó hoa').fill('FLOWER-002');
    await section.getByRole('button', { name: 'Ghi nhận bó hoa vào ô' }).click();
    await expect(section.getByRole('alert')).toContainText('đối chiếu mã bó');
    await expect(section.getByRole('button', { name: 'Ghi nhận bó hoa vào ô' })).toBeDisabled();
    await section.locator('summary').last().click();
    await expect(section.getByText('FLOWER-002', { exact: true })).toBeVisible();
    expect(attempts).toBe(3);
    expect(new Set(batches).size).toBe(1);
    await section.getByRole('button', { name: 'Bắt đầu lô mới' }).click();
    await expect(
      section.getByText('Lô hiện tại: đã nhận phản hồi thành công cho 0 bó.'),
    ).toBeVisible();
  });
}

test('Expired seller can inspect slots but cannot stock', async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'user',
        name: 'Shop',
        role: 'SELLER',
        sellerId: 'seller-id',
        sellerStatus: 'PAST_DUE',
        packageExpiresAt: '2020-01-01',
      },
    }),
  );
  await page.route('**/api/**/products', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/**/slots', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/**/subscriptions', (route) =>
    route.fulfill({ json: { package: null, subscriptions: [] } }),
  );
  await page.goto('/seller/stock');
  await expect(
    page
      .locator('.seller-stock')
      .getByText('Shop cần có gói đang hoạt động để nạp hoa. Bạn vẫn có thể xem các ô đang thuê.'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ghi nhận bó hoa vào ô' })).toHaveCount(0);
});

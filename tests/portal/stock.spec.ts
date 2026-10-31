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
  test(`Seller sees bouquet sale states and slot warnings together at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    const sellerId = '20000000-0000-0000-0000-000000000099';
    const kioskId = '50000000-0000-0000-0000-000000000099';
    const productId = '30000000-0000-0000-0000-000000000099';
    const base = {
      kioskId,
      zone: 'WALK_IN',
      status: 'HELD',
      bouquetId: 'bouquet',
      bouquetStatus: 'SOLD',
      productId,
      orderId: 'order',
      orderCode: 'FB-PAID',
      orderStatus: 'PAID',
      paymentStatus: 'SUCCEEDED',
      kioskName: 'Tủ kiểm thử',
      priceSnapshot: 350000,
    };
    const slots = [
      {
        ...base,
        status: 'STOCKED',
        bouquetStatus: 'STOCKED',
        orderId: null,
        orderCode: null,
        orderStatus: null,
        paymentStatus: null,
      },
      { ...base, bouquetStatus: 'HELD', orderStatus: 'AWAITING_PAYMENT', paymentStatus: 'PENDING' },
      base,
      { ...base, orderStatus: 'DISPENSING' },
      {
        ...base,
        status: 'RENTED_EMPTY',
        bouquetId: null,
        bouquetStatus: null,
        productId: null,
        orderId: null,
        orderCode: null,
        orderStatus: null,
        paymentStatus: null,
      },
      { ...base, status: 'STOCKED', orderStatus: 'DISPENSE_FAILED' },
      { ...base, status: 'FAULT' },
      { ...base, status: 'LOCKED' },
      { ...base, status: 'PENDING_REMOVAL' },
    ].map((slot, index) => ({ ...slot, id: `slot-${index}`, slotCode: `A0${index + 1}` }));
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      const data =
        path === '/api/auth/me'
          ? {
              id: 'seller-user',
              role: 'SELLER',
              name: 'Shop kiểm thử',
              sellerId,
              sellerStatus: 'ACTIVE',
            }
          : path === `/api/sellers/${sellerId}/kiosks`
            ? [{ id: kioskId, name: 'Tủ kiểm thử', code: 'K01' }]
            : path === `/api/me/kiosks/${kioskId}/slots`
              ? slots
              : path === '/api/me/products'
                ? [{ id: productId, name: 'Mẫu đang ACTIVE', status: 'ACTIVE', price: 350000 }]
                : { items: [] };
      return route.fulfill({ json: data });
    });
    await page.goto('/seller/stock');
    const card = (code: string) =>
      page.getByRole('button', { name: `Xem chi tiết ô ${code}`, exact: true });
    for (const [code, label] of [
      ['A01', 'Đang bán'],
      ['A02', 'Khách đang thanh toán'],
      ['A03', 'Đã bán — chờ khách nhận'],
      ['A04', 'Đã bán — đang xử lý nhận hoa'],
      ['A05', 'Ô trống'],
      ['A06', 'Nhận hoa thất bại — cần xử lý'],
    ])
      await expect(card(code)).toContainText(label);
    for (const [code, warning] of [
      ['A07', 'Có sự cố'],
      ['A08', 'Đang khóa'],
      ['A09', 'Chờ lấy hoa hết hạn'],
    ]) {
      await expect(card(code)).toContainText('Đã bán — chờ khách nhận');
      await expect(card(code)).toContainText(warning);
    }
    await card('A07').click();
    const modal = page.getByRole('dialog', { name: 'Chi tiết ô A07' });
    await expect(modal).toContainText('Đã bán — chờ khách nhận');
    await expect(modal).toContainText('Có sự cố');
    await expect(modal).toContainText('FB-PAID');
    await page.keyboard.press('Escape');
    await page.getByRole('button', { name: /^Đang có hoa/ }).click();
    await expect(page.locator('.stock-slot-card')).toHaveCount(8);
    await expect(card('A03')).toBeVisible();
    await page.getByRole('button', { name: /^Cần xử lý/ }).click();
    await expect(card('A06')).toBeVisible();
    await expect(card('A07')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

for (const width of [390, 1440]) {
  test(`Seller selects a kiosk, stocks flowers and reads its inventory ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    const sellerId = '20000000-0000-0000-0000-000000000099';
    const kioskId = '50000000-0000-0000-0000-000000000099';
    const kiosk = {
      id: kioskId,
      code: 'FPT-01',
      name: 'Đại học FPT',
      address: 'Thủ Đức',
      region: 'TP.HCM',
      status: 'ONLINE',
      latitude: null,
      longitude: null,
      coordinates: null,
      locationComplete: true,
      canEditLocation: true,
    };
    const product = {
      id: '30000000-0000-0000-0000-000000000099',
      name: 'Hoa hồng dịu dàng',
      description: '',
      price: 350000,
      tags: [],
      status: 'ACTIVE',
      shelfLifeHours: null,
      inventoryKind: 'ARTIFICIAL',
    };
    const slots = ['A01', 'A02'].map((slotCode, i) => ({
      id: `40000000-0000-0000-0000-00000000000${i}`,
      kioskId,
      slotCode,
      status: 'RENTED_EMPTY',
      zone: 'WALK_IN',
      bouquetId: null as string | null,
      kioskCode: kiosk.code,
      kioskName: kiosk.name,
      kioskAddress: kiosk.address,
      productId: null as string | null,
      qrCode: null as string | null,
      priceSnapshot: null as number | null,
      sellableUntil: null as string | null,
    }));
    let attempts = 0;

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
    await page.route(`**/api/sellers/${sellerId}/kiosks`, (route) =>
      route.fulfill({ json: [kiosk] }),
    );
    await page.route('**/api/me/products', (route) => route.fulfill({ json: [product] }));
    await page.route('**/api/**/subscriptions', (route) =>
      route.fulfill({ json: { package: null, subscriptions: [] } }),
    );
    await page.route(`**/api/me/kiosks/${kioskId}/slots`, (route) =>
      route.fulfill({ json: slots }),
    );
    await page.route('**/api/me/flows/stock_bouquet', (route) => {
      const body = route.request().postDataJSON() as { productId: string; slotId: string };
      expect(Object.keys(body).sort()).toEqual(['productId', 'slotId']);
      expect(body.productId).toBe(product.id);
      attempts++;
      if (attempts === 1) {
        return route.fulfill({
          status: 409,
          json: { detail: 'Ô đang được cập nhật. Kiểm tra lại trước khi nạp.' },
        });
      }
      const slot = slots.find((item) => item.id === body.slotId)!;
      Object.assign(slot, {
        status: 'STOCKED',
        bouquetId: `bouquet-${attempts}`,
        productId: product.id,
        qrCode: `FB-AUTO-${attempts}`,
        priceSnapshot: 350000,
      });
      return attempts === 3 ? route.abort() : route.fulfill({ json: { result: slot.bouquetId } });
    });

    await page.goto('/seller/stock');
    const section = page.locator('.seller-stock');
    await expect(section.getByLabel('Kiosk của shop')).toHaveValue(kioskId);
    await expect(section.getByRole('button', { name: 'Nạp hoa vào ô' })).toBeDisabled();
    expect(attempts).toBe(0);

    await section.getByLabel(/Chọn ô Walk-in trống/).selectOption(slots[0].id);
    await section.getByLabel('2. Chọn mẫu hoa').selectOption(product.id);
    await section.getByRole('button', { name: 'Nạp hoa vào ô' }).click();
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
    const slotTitle = await section.locator('.stock-slot-card strong').first().boundingBox();
    expect(slotTitle!.height).toBeLessThan(40);
    await section.screenshot({ path: `.impeccable/review/portal-stock-${width}.png` });

    await section.getByRole('button', { name: 'Nạp hoa vào ô' }).click();
    await expect(
      section.getByRole('status').filter({ hasText: 'Đã ghi nhận Hoa hồng dịu dàng vào ô A01' }),
    ).toBeFocused();
    const firstCard = section.getByRole('button', { name: 'Xem chi tiết ô A01' });
    await firstCard.click();
    await expect(page.getByRole('dialog', { name: 'Chi tiết ô A01' })).toBeVisible();
    await expect(section.getByText('FB-AUTO-2', { exact: true })).toBeVisible();
    await expect(section.getByLabel('Hình thức bán cho ô A01')).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(firstCard).toBeFocused();

    await section.getByLabel(/Chọn ô Walk-in trống/).selectOption(slots[1].id);
    await section.getByRole('button', { name: 'Nạp hoa vào ô' }).click();
    await expect(section.getByRole('alert')).toContainText('Làm mới kiosk');
    await expect(section.getByRole('button', { name: 'Nạp hoa vào ô' })).toHaveCount(0);
    await section.getByRole('button', { name: 'Xem chi tiết ô A02' }).click();
    await expect(section.getByText('FB-AUTO-3', { exact: true })).toBeVisible();
    expect(attempts).toBe(3);
  });
}

test('Expired seller can inspect a selected kiosk but cannot stock', async ({ page }) => {
  const sellerId = '20000000-0000-0000-0000-000000000099';
  const kioskId = '50000000-0000-0000-0000-000000000099';
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'user',
        name: 'Shop',
        role: 'SELLER',
        sellerId,
        sellerStatus: 'PAST_DUE',
        packageExpiresAt: '2020-01-01',
      },
    }),
  );
  await page.route(`**/api/sellers/${sellerId}/kiosks`, (route) =>
    route.fulfill({
      json: [
        {
          id: kioskId,
          code: 'FPT-01',
          name: 'Đại học FPT',
          address: 'Thủ Đức',
          region: 'TP.HCM',
          status: 'ONLINE',
          latitude: null,
          longitude: null,
          coordinates: null,
          locationComplete: true,
          canEditLocation: true,
        },
      ],
    }),
  );
  await page.route('**/api/me/products', (route) => route.fulfill({ json: [] }));
  await page.route(`**/api/me/kiosks/${kioskId}/slots`, (route) => route.fulfill({ json: [] }));
  await page.route('**/api/**/subscriptions', (route) =>
    route.fulfill({ json: { package: null, subscriptions: [] } }),
  );
  await page.goto('/seller/stock');
  await expect(
    page
      .locator('.seller-stock')
      .getByText(
        'Shop cần có gói đang hoạt động để nạp hoa. Bạn vẫn có thể xem các ô đang quản lý.',
      ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nạp hoa vào ô' })).toHaveCount(0);
});

test('Seller classifies empty slots, blocks held slots and stocks only WALK_IN', async ({
  page,
}) => {
  const sellerId = '20000000-0000-0000-0000-000000000099';
  const kioskId = '50000000-0000-0000-0000-000000000099';
  const productId = '30000000-0000-0000-0000-000000000099';
  const slots = [
    { slotCode: 'A01', zone: 'WALK_IN' },
    { slotCode: 'A02', zone: 'PREORDER' },
    { slotCode: 'W03' },
    { slotCode: 'P04', zone: 'UNRECOGNIZED' },
  ].map((slot, index) => ({
    ...slot,
    id: `40000000-0000-0000-0000-00000000000${index}`,
    kioskId,
    status: 'RENTED_EMPTY',
    bouquetId: null,
    kioskCode: 'FPT-01',
    kioskName: 'Kiosk FPT',
    kioskAddress: 'Thủ Đức',
    productId: null,
    qrCode: null,
    priceSnapshot: null,
    sellableUntil: null,
  }));
  const writes: unknown[] = [];
  const zoneWrites: unknown[] = [];
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me')
      return route.fulfill({
        json: {
          id: 'user',
          name: 'Shop',
          role: 'SELLER',
          sellerId,
          sellerStatus: 'ACTIVE',
          packageExpiresAt: '2099-12-31',
        },
      });
    if (path === `/api/sellers/${sellerId}/kiosks`)
      return route.fulfill({ json: [{ id: kioskId, code: 'FPT-01', name: 'Kiosk FPT' }] });
    if (path === `/api/me/kiosks/${kioskId}/slots`) return route.fulfill({ json: slots });
    if (path === '/api/me/products')
      return route.fulfill({
        json: [{ id: productId, name: 'Hoa hồng', status: 'ACTIVE', price: 350000 }],
      });
    if (path === '/api/me/kiosks/' + kioskId + '/slots/' + slots[2].id + '/zone') {
      expect(route.request().method()).toBe('PUT');
      const body = route.request().postDataJSON();
      zoneWrites.push(body);
      slots[2].zone = body.zone;
      return route.fulfill({ json: {} });
    }
    if (path === '/api/me/kiosks/' + kioskId + '/slots/' + slots[0].id + '/zone') {
      slots[0].zone = route.request().postDataJSON().zone;
      return route.fulfill({ json: {} });
    }
    if (path === '/api/me/kiosks/' + kioskId + '/slots/' + slots[3].id + '/zone') {
      slots[3].status = 'HELD';
      return route.fulfill({ status: 409, json: { detail: 'Ô đang bị giữ.' } });
    }
    if (path === '/api/me/flows/stock_bouquet') {
      writes.push(route.request().postDataJSON());
      return route.fulfill({ json: {} });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/seller/stock');
  const section = page.locator('.seller-stock');
  const slot = section.getByLabel(/Chọn ô Walk-in trống/);
  await expect(slot.locator('option')).toHaveCount(2);
  await slot.selectOption(slots[0].id);
  await section.getByLabel('2. Chọn mẫu hoa').selectOption(productId);
  const review = section.getByRole('note', { name: 'Kiểm tra trước khi nạp hoa' });
  await expect(review).toContainText('Bó này chỉ mua trực tiếp tại kiosk');

  await expect(section.getByLabel('Hình thức bán của ô tủ')).toHaveCount(0);
  await expect(
    section.getByLabel('Thống kê ô tủ').locator('.operations-metric').nth(1).locator('strong'),
  ).toHaveText('1');
  await section.getByRole('button', { name: 'Nạp hoa vào ô' }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({ productId, slotId: slots[0].id });
  await section.getByRole('button', { name: 'Xem chi tiết ô W03' }).click();
  const zoneChoice = section.getByLabel('Hình thức bán cho ô W03');
  await zoneChoice.selectOption('PREORDER');
  await section.getByRole('button', { name: 'Lưu hình thức bán' }).click();
  await expect.poll(() => zoneWrites.length).toBe(1);
  expect(zoneWrites[0]).toEqual({ zone: 'PREORDER' });
  await expect(zoneChoice).toHaveValue('PREORDER');
  await page.keyboard.press('Escape');
  await section.getByRole('button', { name: 'Xem chi tiết ô P04' }).click();
  const heldChoice = section.getByLabel('Hình thức bán cho ô P04');
  await heldChoice.selectOption('WALK_IN');
  await section.getByRole('button', { name: 'Lưu hình thức bán' }).click();
  await expect(heldChoice).toHaveCount(0);
  await expect(section.getByRole('alert')).toContainText('Ô đang bị giữ.');
  await page.keyboard.press('Escape');
  slots[0].zone = undefined;
  await section.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(
    section.getByLabel('Thống kê ô tủ').locator('.operations-metric').nth(1).locator('strong'),
  ).toHaveText('0');
  await expect(section.getByRole('button', { name: 'Nạp hoa vào ô' })).toHaveCount(0);
  await expect(section.getByRole('note')).toContainText('Không có ô Walk-in trống');
  await expect(slot).toHaveCount(0);
  await expect(section.getByLabel('2. Chọn mẫu hoa')).toHaveCount(0);
  await section.getByRole('button', { name: 'Xem chi tiết ô A01' }).click();
  const firstZone = section.getByLabel('Hình thức bán cho ô A01');
  await firstZone.selectOption('WALK_IN');
  await section.getByRole('button', { name: 'Lưu hình thức bán' }).click();
  await page.keyboard.press('Escape');
  await expect(slot).toBeEnabled();
  await slot.selectOption(slots[0].id);
  await expect(section.getByRole('button', { name: 'Nạp hoa vào ô' })).toBeEnabled();
});

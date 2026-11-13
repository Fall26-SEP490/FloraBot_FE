import { expect, test } from '@playwright/test';

test('Seller can assign a monitored Walk-in slot and approve a separate repair', async ({
  page,
}) => {
  const sellerId = 'shop-1';
  const kioskId = 'kiosk-1';
  const slotId = 'slot-1';
  const repair = {
    id: 'repair-1',
    kioskName: 'Tủ FPT',
    slotCode: 'A02',
    reason: 'Kiểm tra cửa kẹt',
    expiresAt: null as string | null,
  };
  await page.route('**/api/**', (route) => {
    switch (new URL(route.request().url()).pathname) {
      case '/api/auth/me':
        return route.fulfill({
          json: { id: 'seller', name: 'Shop', role: 'SELLER', sellerId, sellerStatus: 'ACTIVE' },
        });
      case `/api/sellers/${sellerId}/kiosks`:
        return route.fulfill({ json: [{ id: kioskId, code: 'K01', name: 'Tủ FPT' }] });
      case `/api/me/kiosks/${kioskId}/slots`:
        return route.fulfill({
          json: [
            {
              id: slotId,
              kioskId,
              slotCode: 'A01',
              status: 'RENTED_EMPTY',
              zone: 'WALK_IN',
              bouquetId: null,
              sensorEnabled: true,
              sensorReady: true,
            },
          ],
        });
      case `/api/me/kiosks/${kioskId}/slots/${slotId}/maintenance-sessions/active`:
        return route.fulfill({ status: 204 });
      case '/api/me/products':
        return route.fulfill({
          json: [
            { id: 'product-1', name: 'Hoa hồng', status: 'ACTIVE', price: 350000, quantity: 5 },
          ],
        });
      case `/api/sellers/${sellerId}/staff`:
        return route.fulfill({ json: [{ id: 'staff-1', name: 'Nhân viên A' }] });
      case '/api/me/inventory-tasks': {
        const { id, ...payload } = route.request().postDataJSON();
        expect(id).toBeTruthy();
        expect(payload).toEqual({
          assigneeId: 'staff-1',
          kioskId,
          slotId,
          action: 'LOAD',
          expectedBouquetId: null,
          productId: 'product-1',
          instructions: 'Nạp hoa đúng ô A01.',
        });
        return route.fulfill({ json: { id } });
      }
      case '/api/me/technical-repairs':
        return route.fulfill({ json: [repair] });
      case '/api/me/technical-repairs/repair-1/approve':
        expect(route.request().method()).toBe('POST');
        repair.expiresAt = new Date(Date.now() + 600_000).toISOString();
        return route.fulfill({ json: { expiresAt: repair.expiresAt } });
      default:
        return route.fulfill({ json: { items: [] } });
    }
  });
  await page.goto('/seller/stock');
  await page.getByText('Duyệt quyền mở ô để sửa tủ', { exact: true }).click();
  await expect(page.getByText('Kiểm tra cửa kẹt')).toBeVisible();
  await page.getByRole('button', { name: 'Duyệt quyền mở ô', exact: true }).click();
  await expect(page.getByText(/Đã duyệt đến/)).toBeVisible();
  await page.getByRole('button', { name: 'Xem chi tiết ô A01' }).click();
  const modal = page.getByRole('dialog', { name: 'Chi tiết ô A01' });
  await modal.getByText('Giao nhân viên thao tác ô A01').click();
  await modal.getByLabel('Nhân viên', { exact: true }).selectOption('staff-1');
  await modal.getByLabel('Mẫu hoa', { exact: true }).selectOption('product-1');
  await modal.getByLabel(/Hướng dẫn/).fill('Nạp hoa đúng ô A01.');
  await modal.getByRole('button', { name: 'Xác nhận giao nhân viên' }).click();
  await expect(modal.getByText('Đã giao công việc cho nhân viên.')).toBeVisible();
});
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
        'Shop cần có kỳ thuê đang hoạt động để nạp hoa. Bạn vẫn có thể xem các ô đang quản lý.',
      ),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nạp hoa vào ô' })).toHaveCount(0);
});

test('Seller cannot change slot types and stocks only WALK_IN', async ({ page }) => {
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
    section.getByRole('button', { name: /^Walk-in trống/ }).locator('.stock-tab-count'),
  ).toHaveText('1');
  await section.getByRole('button', { name: 'Nạp hoa vào ô' }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({ productId, slotId: slots[0].id });
  await section.getByRole('button', { name: 'Xem chi tiết ô W03' }).click();
  await expect(page.getByLabel('Hình thức bán cho ô W03')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Lưu hình thức bán' })).toHaveCount(0);
  expect(zoneWrites).toEqual([]);
  await page.keyboard.press('Escape');
  slots[0].zone = undefined;
  await section.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(
    section.getByRole('button', { name: /^Walk-in trống/ }).locator('.stock-tab-count'),
  ).toHaveText('0');
  await expect(section.getByRole('button', { name: 'Nạp hoa vào ô' })).toHaveCount(0);
  await expect(section.getByRole('note')).toContainText('Không có ô Walk-in trống');
  await expect(slot).toHaveCount(0);
  await expect(section.getByLabel('2. Chọn mẫu hoa')).toHaveCount(0);
  await section.getByRole('button', { name: 'Xem chi tiết ô A01' }).click();
  await expect(page.getByLabel('Hình thức bán cho ô A01')).toHaveCount(0);
  expect(zoneWrites).toEqual([]);
});

for (const expireOnCheck of [false, true])
  test(`Monitored Walk-in slot uses a physical maintenance session before stocking (expires: ${expireOnCheck})`, async ({
    page,
  }) => {
    const sellerId = '20000000-0000-0000-0000-000000000099';
    const kioskId = '50000000-0000-0000-0000-000000000099';
    const slotId = '40000000-0000-0000-0000-000000000099';
    const productId = '30000000-0000-0000-0000-000000000099';
    const slot = {
      id: slotId,
      kioskId,
      slotCode: 'A01',
      status: 'RENTED_EMPTY',
      zone: 'WALK_IN',
      bouquetId: null as string | null,
      productId: null as string | null,
      kioskName: 'Tủ kiểm thử',
      sensorEnabled: true,
      sensorReady: true,
      manualRetryEnabled: true,
    };
    let confirmed = false;
    const progress = {
      id: '',
      kioskId,
      slotId,
      action: 'LOAD',
      stage: 'AwaitLoading',
      substate: 'Initial',
      currentCmdId: '70000000-0000-0000-0000-000000000099',
      expiresAt: '2099-01-01T00:00:00Z',
      inspectionReason: null as string | null,
      availableActions: ['check', 'report-issue'],
      retryAfterSeconds: null,
    };
    let oldFlowCalls = 0;
    let maintenanceCalls = 0;
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me')
        return route.fulfill({
          json: { id: 'seller', name: 'Shop', role: 'SELLER', sellerId, sellerStatus: 'ACTIVE' },
        });
      if (path === `/api/sellers/${sellerId}/kiosks`)
        return route.fulfill({ json: [{ id: kioskId, code: 'K01', name: 'Tủ kiểm thử' }] });
      if (path === `/api/me/kiosks/${kioskId}/slots`) return route.fulfill({ json: [slot] });
      if (path === '/api/me/products')
        return route.fulfill({
          json: [{ id: productId, name: 'Hoa hồng', status: 'ACTIVE', price: 350000 }],
        });
      if (path === '/api/me/flows/stock_bouquet') {
        oldFlowCalls++;
        return route.fulfill({ status: 500, json: {} });
      }
      if (path === `/api/me/kiosks/${kioskId}/slots/${slotId}/maintenance-sessions/active`)
        return confirmed
          ? route.fulfill({ json: progress })
          : route.fulfill({ status: 204, body: '' });
      if (path === '/api/me/maintenance-open' && route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        expect(body.operation).toBe('START');
        expect(body.kioskId).toBe(kioskId);
        expect(body.slotId).toBe(slotId);
        expect(body.action).toBe('LOAD');
        expect(body.productId).toBe(productId);
        expect(body.expectedBouquetId).toBeNull();
        maintenanceCalls++;
        progress.id = body.sessionId;
        confirmed = true;
        slot.status = 'LOCKED';
        return route.fulfill({ json: progress });
      }
      if (
        path ===
        `/api/me/kiosks/${kioskId}/slots/${slotId}/maintenance-sessions/${progress.id}/check`
      ) {
        if (expireOnCheck) {
          progress.stage = 'NeedsInspection';
          progress.inspectionReason = 'SessionExpired';
          return route.fulfill({ json: progress });
        }
        progress.stage = 'Completed';
        slot.status = 'STOCKED';
        slot.bouquetId = '80000000-0000-0000-0000-000000000099';
        slot.productId = productId;
        return route.fulfill({ json: progress });
      }
      if (path === `/api/me/kiosks/${kioskId}/slots/${slotId}/maintenance-sessions/${progress.id}`)
        return route.fulfill({ json: progress });
      return route.fulfill({ json: { items: [] } });
    });

    await page.goto('/seller/stock');
    await page.getByLabel(/Chọn ô Walk-in trống/).selectOption(slotId);
    await page.getByLabel('2. Chọn mẫu hoa').selectOption(productId);
    await page.getByRole('button', { name: 'Mở ô để nạp hoa' }).click();
    const modal = page.getByRole('dialog', { name: 'Chi tiết ô A01' });
    await expect(modal).toContainText('Đang chờ tủ xác nhận mở cửa');
    expect(maintenanceCalls).toBe(1);
    expect(oldFlowCalls).toBe(0);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.getByRole('button', { name: 'Xem chi tiết ô A01' }).click();
    await expect(page.getByRole('dialog', { name: 'Chi tiết ô A01' })).toContainText(
      'Đang chờ tủ xác nhận mở cửa',
    );
    await modal.getByRole('button', { name: 'Kiểm tra tiến độ' }).click();
    if (expireOnCheck) {
      await expect(modal).toContainText('Phiên đã hết hạn');
      await expect(modal).toContainText('Ô vẫn khóa trong hệ thống');
      await expect(modal).not.toContainText('SessionExpired');
      await expect(modal.getByRole('button', { name: 'Thử lại lệnh mở cửa' })).toHaveCount(0);
      return;
    }
    await expect(modal).toContainText('Đã hoàn tất');
    await expect(page.getByRole('button', { name: 'Xem chi tiết ô A01' })).toContainText(
      'Đã nạp hoa',
    );
  });

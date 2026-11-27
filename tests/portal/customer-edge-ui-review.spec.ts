import { expect, test } from '@playwright/test';

// Visual review of controls that only appear after a customer action or conflict.
// All requests are intercepted: these scenarios never alter real orders or payments.
for (const width of [390, 1440]) {
  test(`Customer rare action surfaces at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date('2030-11-08T03:00:00Z') });
    const row = {
      id: 'rare-request',
      kind: 'CUSTOM',
      state: 'QUOTED',
      orderStatus: null as string | null,
      productId: 'flower',
      sellerId: 'shop',
      kioskId: 'kiosk',
      orderId: null as string | null,
      productName: 'Bó hoa hồng pastel',
      shopName: 'Tiệm Hoa An Nhiên',
      kioskName: 'Kiosk Nguyễn Huệ',
      address: '12 Nguyễn Huệ, Thành phố Hồ Chí Minh',
      instructions: 'Hoa hồng pastel tặng sinh nhật.',
      quotedPrice: 380000,
      quotedFlowerPrice: 350000,
      quotedAccessoryTotal: 30000,
      quoteVersion: 1,
      quoteNote: 'Hoa tông pastel, kèm nơ trắng.',
      requestedAccessories: [{ accessoryId: 'bow', name: 'Nơ trắng', quantity: 3 }],
      quotedAccessories: [
        { accessoryId: 'bow', name: 'Nơ trắng', quantity: 2, unitPrice: 15000, lineTotal: 30000 },
      ],
      pickupAt: '2030-11-10T03:00:00Z',
      pickupBefore: '2030-11-10T05:00:00Z',
      quoteExpiresAt: '2030-11-09T03:00:00Z',
      payBefore: '2030-11-09T05:00:00Z',
      ready: false,
      orderCode: 'FB-REVIEW',
      trackingToken: null,
    };
    const writes: string[] = [];
    await page.route('**/hub/**', (r) => r.abort());
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== 'GET') {
        writes.push(path);
        return route.fulfill({ status: 503, json: { detail: 'Dịch vụ tạm thời không khả dụng.' } });
      }
      if (path === '/api/auth/me')
        return route.fulfill({ json: { id: 'customer', role: 'CUSTOMER', name: 'Minh Anh' } });
      if (path === '/api/member/preorders')
        return route.fulfill({ json: { items: [row], page: 1, hasMore: false } });
      if (path === '/api/member/kiosk-applications/current')
        return route.fulfill({ status: 404, json: {} });
      return route.fulfill({ json: { items: [], hasMore: false } });
    });
    await page.goto('/tai-khoan?requestId=rare-request#web-orders');
    await page.getByRole('button', { name: 'Xác nhận báo giá', exact: true }).click();
    row.quoteVersion = 2;
    row.quotedPrice = 390000;
    await page.getByRole('button', { name: 'Tải lại đơn hàng', exact: true }).click();
    const changed = page
      .getByRole('alert')
      .filter({ hasText: 'Shop đã cập nhật báo giá trong lúc bạn xem' });
    await expect(changed).toBeVisible();
    await expect(changed).toContainText('Chọn “Quay lại”');
    await expect(changed).toHaveCSS('color', 'rgb(166, 38, 34)');
    await expect(page.getByRole('button', { name: 'Đồng ý báo giá', exact: true })).toBeDisabled();
    await page
      .locator('.order-action-card')
      .screenshot({ path: test.info().outputPath(`quote-changed-${width}.png`) });
    await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
    await page.getByRole('button', { name: 'Hủy yêu cầu', exact: true }).click();
    const cancel = page.locator('.order-action-card[data-action="cancel"]');
    const reason = cancel.getByLabel('Lý do hủy', { exact: true });
    const confirmCancel = cancel.getByRole('button', { name: 'Xác nhận hủy đơn', exact: true });
    const consent = cancel.getByRole('checkbox', {
      name: 'Tôi hiểu yêu cầu đặt trước này sẽ bị hủy.',
    });
    await expect(reason).toBeVisible();
    await expect
      .poll(() =>
        reason.evaluate((element) => {
          const [red, green, blue] = getComputedStyle(element)
            .borderTopColor.match(/\d+/g)!
            .map(Number);
          return green >= red && green >= blue;
        }),
      )
      .toBe(true);
    await expect(confirmCancel).toBeDisabled();
    await reason.fill('Đổi lịch nhận');
    await expect(confirmCancel).toBeDisabled();
    await consent.check();
    await expect(confirmCancel).toBeEnabled();
    await reason.fill('     ');
    await expect(confirmCancel).toBeDisabled();
    await reason.fill('Đổi lịch nhận');
    await consent.uncheck();
    await cancel.screenshot({ path: test.info().outputPath(`cancel-${width}.png`) });
    expect(writes).toEqual([]);
    await cancel.getByRole('button', { name: 'Quay lại', exact: true }).click();
    row.state = 'ORDERED';
    row.orderId = 'order-review';
    row.orderStatus = 'AWAITING_PAYMENT';
    await page.reload();
    await page.getByRole('button', { name: 'Thanh toán ngay', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Thanh toán đơn hoa' });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByText('Dịch vụ tạm thời không khả dụng.', { exact: true }),
    ).toBeVisible();
    await expect(dialog.getByRole('status')).toContainText(
      'Kiểm tra trạng thái” trước khi tải lại mã QR',
    );
    const retry = dialog.getByRole('button', { name: 'Tải lại mã QR', exact: true });
    await expect(retry).toBeDisabled();
    await dialog.screenshot({ path: test.info().outputPath(`payment-error-${width}.png`) });
    await dialog.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click();
    await expect(retry).toBeEnabled();
    expect(writes).toEqual(['/api/member/preorders/rare-request/payment-link']);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockPayos } from './payos.fixture';
const id = '70000000-0000-0000-0000-000000000001';
const makeRow = () => ({
  id,
  kind: 'CUSTOM',
  state: 'QUOTED',
  productId: 'p1',
  sellerId: 's1',
  kioskId: 'k1',
  instructions: 'Hoa hồng pastel, ngân sách 400000 đồng',
  pickupAt: '2030-11-10T03:00:00Z',
  pickupBefore: '2030-11-10T05:00:00Z',
  quotedPrice: 380000 as number | null,
  quoteNote: 'Giá gồm hoa và phụ kiện, tông pastel.',
  quoteExpiresAt: '2030-11-09T03:00:00Z',
  orderId: null as string | null,
  checkoutId: null,
  orderCode: 'FB-QUOTE',
  orderStatus: null as string | null,
  trackingToken: null,
  ready: false,
  payBefore: '2030-11-09T05:00:00Z',
  productName: 'Bó hoa pastel',
  shopName: 'Tiệm Hoa An Nhiên',
  kioskName: 'Kiosk Nguyễn Huệ',
  address: '12 Nguyễn Huệ, TP.HCM',
});
async function fixture(page: Page) {
  const state = {
    row: makeRow(),
    acceptStatus: 200,
    writes: [] as { path: string; body: unknown }[],
  };
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') {
      state.writes.push({ path, body: route.request().postDataJSON() });
      if (path.endsWith('/accept')) {
        if (state.acceptStatus !== 200)
          return route.fulfill({
            status: state.acceptStatus,
            json: { detail: 'Shop vừa cập nhật báo giá. Hãy kiểm tra lại.' },
          });
        state.row = {
          ...state.row,
          state: 'ORDERED',
          orderStatus: 'AWAITING_PAYMENT',
          orderId: 'order-1',
        };
        return route.fulfill({ json: { result: id } });
      }
      return route.abort();
    }
    if (path === '/api/auth/me')
      return route.fulfill({ json: { id: 'customer', name: 'Minh Anh', role: 'CUSTOMER' } });
    if (path === '/api/member/preorders')
      return route.fulfill({ json: { items: [state.row], page: 1, hasMore: false } });
    if (path === '/api/member/kiosk-applications/current')
      return route.fulfill({ status: 404, json: {} });
    if (path === '/api/member/profile') return route.fulfill({ json: { loyaltyPoints: 0 } });
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  return state;
}
for (const width of [390, 1440]) {
  test(`Customer reviews exact quote and explicitly accepts before seeing payOS payment at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await fixture(page);
    const original = {
      price: state.row.quotedPrice,
      pickupAt: state.row.pickupAt,
      note: state.row.quoteNote,
    };
    await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
    const quote = page.getByRole('region', { name: 'Báo giá của shop', exact: true });
    await expect(quote).toContainText('380.000 đ');
    await expect(quote).toContainText(state.row.address);
    await expect(quote).toContainText('Phản hồi báo giá trước');
    await expect(quote).toContainText(state.row.quoteNote);
    await expect(page.getByRole('button', { name: 'Thanh toán ngay', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Kiểm tra báo giá', exact: true }).click();
    const submit = page.getByRole('button', { name: 'Đồng ý báo giá', exact: true });
    await expect(submit).toBeDisabled();
    await page
      .getByRole('checkbox', { name: 'Tôi đồng ý với giá, ghi chú và lịch nhận của shop.' })
      .check();
    await expect(submit).toBeEnabled();
    await quote.scrollIntoViewIfNeeded();
    expect(
      (
        await new AxeBuilder({ page })
          .include('#web-orders')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: test.info().outputPath(`quote-${width}.png`) });
    await submit.click();
    await expect(
      page.getByRole('region', { name: 'Thông tin thanh toán', exact: true }),
    ).toContainText('Số tiền cần thanh toán');
    await expect(
      page.getByRole('region', { name: 'Thông tin thanh toán', exact: true }),
    ).toContainText('thanh toán qua PayOS ngay tại đây');
    await expect(page.getByRole('button', { name: 'Thanh toán ngay', exact: true })).toBeEnabled();
    expect(state.writes).toEqual([{ path: `/api/member/preorders/${id}/accept`, body: original }]);
  });
}
test('A quote that expires during review cannot be accepted', async ({ page }) => {
  await page.clock.install({ time: new Date('2030-11-09T02:59:58Z') });
  const state = await fixture(page);
  await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
  await page.getByRole('button', { name: 'Kiểm tra báo giá', exact: true }).click();
  await page
    .getByRole('checkbox', { name: 'Tôi đồng ý với giá, ghi chú và lịch nhận của shop.' })
    .check();
  await page.clock.fastForward(4000);
  await expect(page.getByRole('button', { name: 'Đồng ý báo giá', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Báo giá của shop', exact: true })).toContainText(
    'Báo giá đã hết hạn',
  );
  expect(state.writes).toEqual([]);
});
test('Missing quote amount is never displayed or accepted as zero', async ({ page }) => {
  const state = await fixture(page);
  state.row.quotedPrice = null;
  await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
  const quote = page.getByRole('region', { name: 'Báo giá của shop', exact: true });
  await expect(quote).toContainText('Chưa có báo giá');
  await expect(quote).toContainText('chưa có số tiền hợp lệ');
  await expect(page.getByRole('button', { name: 'Kiểm tra báo giá', exact: true })).toBeDisabled();
  expect(state.writes).toEqual([]);
});
test('Changed quote returns a clear conflict and does not create a payment link', async ({
  page,
}) => {
  const state = await fixture(page);
  state.acceptStatus = 409;
  await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
  await page.getByRole('button', { name: 'Kiểm tra báo giá', exact: true }).click();
  await page
    .getByRole('checkbox', { name: 'Tôi đồng ý với giá, ghi chú và lịch nhận của shop.' })
    .check();
  await page.getByRole('button', { name: 'Đồng ý báo giá', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Shop vừa cập nhật báo giá' }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].path).toMatch(/\/accept$/);
  await expect(page.getByRole('button', { name: 'Thanh toán ngay', exact: true })).toHaveCount(0);
});
for (const paid of [false, true]) {
  test(`payOS return uses BE ${paid ? 'PAID' : 'AWAITING_PAYMENT'} status rather than URL success`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.row = {
      ...state.row,
      state: 'ORDERED',
      orderId: 'order-1',
      orderStatus: paid ? 'PAID' : 'AWAITING_PAYMENT',
    };
    await page.goto(`/tai-khoan?requestId=${id}&paymentReturn=1&status=PAID#web-orders`);
    const banner = page.getByRole('status').filter({ hasText: 'Đã trở về từ payOS.' });
    await expect(banner).toContainText(
      paid ? 'Thanh toán đã được hệ thống xác nhận' : 'Hệ thống chưa xác nhận thanh toán',
    );
    await expect(page.getByRole('button', { name: 'Thanh toán ngay', exact: true })).toHaveCount(
      paid ? 0 : 1,
    );
    expect(state.writes).toEqual([]);
  });
}
test('An expired payment has an explanation and no enabled payment action', async ({ page }) => {
  const state = await fixture(page);
  state.row = {
    ...state.row,
    state: 'ORDERED',
    orderId: 'order-1',
    orderStatus: 'AWAITING_PAYMENT',
    payBefore: '2020-01-01T00:00:00Z',
  };
  await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
  await expect(
    page.getByRole('region', { name: 'Thông tin thanh toán', exact: true }),
  ).toContainText('Đã hết hạn thanh toán');
  await expect(page.getByRole('button', { name: 'Thanh toán ngay', exact: true })).toBeDisabled();
  expect(state.writes).toEqual([]);
});

test('A refreshed quote cannot be confirmed with an older review snapshot', async ({ page }) => {
  const state = await fixture(page);
  await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
  await page.getByRole('button', { name: 'Kiểm tra báo giá', exact: true }).click();
  await page
    .getByRole('checkbox', { name: 'Tôi đồng ý với giá, ghi chú và lịch nhận của shop.' })
    .check();
  state.row.quotedPrice = 420000;
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Shop đã cập nhật báo giá trong lúc bạn xem' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đồng ý báo giá', exact: true })).toBeDisabled();
  expect(state.writes).toEqual([]);
});

for (const width of [390, 1440]) {
  test(`One click opens bank QR payment without leaving FloraBot at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await fixture(page);
    state.row = {
      ...state.row,
      state: 'ORDERED',
      orderId: 'order-1',
      orderStatus: 'AWAITING_PAYMENT',
    };
    await mockPayos(page);
    let links = 0;
    await page.route(`**/api/member/preorders/${id}/payment-link`, async (route) => {
      links++;
      await new Promise((resolve) => setTimeout(resolve, 250));
      return route.fulfill({
        json: {
          checkoutUrl: 'https://pay.payos.vn/web/test-order',
          orderCode: 123456,
          amount: 360000,
          qrCode: '000201010212TEST-BANK-QR',
          recipientName: 'TIEM HOA AN NHIEN',
          recipientAccountMasked: '******7766',
        },
      });
    });
    await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
    const originalUrl = page.url();
    await page.getByRole('button', { name: 'Thanh toán ngay', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Thanh toán đơn hoa' });
    await expect(
      dialog.getByRole('img', { name: 'Mã QR thanh toán PayOS', exact: true }),
    ).toBeVisible();
    await expect(dialog).toContainText('360.000');
    await expect(dialog).toContainText('TIEM HOA AN NHIEN · ******7766');
    await expect(dialog.getByRole('link')).toHaveCount(0);
    await expect(page).toHaveURL(originalUrl);
    expect(page.context().pages()).toHaveLength(1);
    expect(links).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include('.payos-checkout-modal')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`payos-${width}.png`) });
    await dialog.getByRole('button', { name: 'Kiểm tra thanh toán', exact: true }).click();
    expect(links).toBe(1);
    // Refresh never treats a client action as payment success.
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Thanh toán ngay', exact: true })).toBeVisible();
    expect(state.row.orderStatus).toBe('AWAITING_PAYMENT');
  });
}

test('Preorder cannot open a payment link while the seller channel is unavailable', async ({
  page,
}) => {
  const state = await fixture(page);
  state.row = {
    ...state.row,
    state: 'ORDERED',
    orderId: 'order-1',
    orderStatus: 'AWAITING_PAYMENT',
  };
  await page.route(`**/api/member/preorders/${id}/payment-link`, (route) =>
    route.fulfill({ status: 503, json: { detail: 'seller_channel_unavailable' } }),
  );
  await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
  const pay = page.getByRole('button', { name: 'Thanh toán ngay', exact: true });
  await pay.click();
  await expect(
    page.getByRole('region', { name: 'Đơn đặt trước' }).getByRole('alert'),
  ).toContainText('Kênh nhận tiền của shop chưa sẵn sàng');
  await expect(page.getByRole('dialog', { name: 'Thanh toán đơn hoa' })).toHaveCount(0);
  await expect(pay).toBeEnabled();
});

for (const qrCode of [null, 'https://pay.payos.vn/web/not-a-bank-qr']) {
  test(
    'Missing or non-bank QR retries inline without opening PayOS: ' + qrCode,
    async ({ page }) => {
      const state = await fixture(page);
      state.row = {
        ...state.row,
        state: 'ORDERED',
        orderId: 'order-1',
        orderStatus: 'AWAITING_PAYMENT',
      };
      let attempts = 0;
      await page.route('**/api/member/preorders/' + id + '/payment-link', (route) => {
        attempts++;
        return route.fulfill({
          json: {
            checkoutUrl: 'https://pay.payos.vn/web/test-order',
            orderCode: 123456,
            amount: 380000,
            qrCode: attempts === 1 ? qrCode : '000201RETRIED-BANK-QR',
          },
        });
      });
      await page.goto('/tai-khoan?requestId=' + id + '#web-orders');
      await page.getByRole('button', { name: 'Thanh toán ngay', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Thanh toán đơn hoa' });
      await expect(dialog.getByRole('alert')).toContainText('Chưa có mã VietQR');
      await expect(dialog.locator('svg.payos-qr-svg')).toHaveCount(0);
      await expect(dialog.getByRole('link')).toHaveCount(0);
      await dialog.getByRole('button', { name: 'Tải lại mã QR', exact: true }).click();
      await expect(dialog.getByRole('img', { name: 'Mã QR thanh toán PayOS' })).toBeVisible();
      expect(attempts).toBe(2);
      expect(page.context().pages()).toHaveLength(1);
      await dialog.getByRole('button', { name: 'Kiểm tra thanh toán', exact: true }).click();
      await expect(dialog).toBeVisible();
      expect(state.row.orderStatus).toBe('AWAITING_PAYMENT');
      await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
      expect(state.writes).toEqual([]);
    },
  );
}

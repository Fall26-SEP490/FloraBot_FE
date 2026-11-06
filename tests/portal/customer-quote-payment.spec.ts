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
  test(`One click opens embedded order payment without leaving FloraBot at ${width}px`, async ({
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
        json: { checkoutUrl: 'https://pay.payos.vn/web/test-order', orderCode: 123456 },
      });
    });
    await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
    const originalUrl = page.url();
    await page.getByRole('button', { name: 'Thanh toán ngay', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Thanh toán đơn hoa' });
    await expect(dialog.getByTitle('Thanh toán bảo mật qua PayOS')).toBeVisible();
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
    // A provider success callback only refreshes authoritative BE state.
    await page.evaluate(() =>
      (
        window as unknown as { payosTestConfig: { onSuccess: () => void } }
      ).payosTestConfig.onSuccess(),
    );
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Thanh toán ngay', exact: true })).toBeVisible();
    expect(state.row.orderStatus).toBe('AWAITING_PAYMENT');
  });
}

test('PayOS script can be retried with the same link and a callback never cancels the flower order', async ({
  page,
}) => {
  const state = await fixture(page);
  state.row = {
    ...state.row,
    state: 'ORDERED',
    orderId: 'order-1',
    orderStatus: 'AWAITING_PAYMENT',
  };
  await mockPayos(page);
  await page.route('https://cdn.payos.vn/**', (route) => route.abort());
  let links = 0;
  await page.route(`**/api/member/preorders/${id}/payment-link`, (route) => {
    links++;
    return route.fulfill({
      json: { checkoutUrl: 'https://pay.payos.vn/web/test-order', orderCode: 123456 },
    });
  });
  await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
  await page.getByRole('button', { name: 'Thanh toán ngay', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Thanh toán đơn hoa' });
  await expect(dialog.getByRole('alert')).toContainText('Chưa tải được màn hình PayOS');
  await page.unroute('https://cdn.payos.vn/**');
  await dialog.getByRole('button', { name: 'Tải lại màn hình' }).click();
  await expect(dialog.getByTitle('Thanh toán bảo mật qua PayOS')).toBeVisible();
  expect(links).toBe(1);
  await page.evaluate(() =>
    (window as unknown as { payosTestConfig: { onCancel: () => void } }).payosTestConfig.onCancel(),
  );
  await expect(dialog).toHaveCount(0);
  expect(state.writes).toEqual([]);
  await expect(page.getByRole('button', { name: 'Thanh toán ngay', exact: true })).toBeVisible();
});

test('Official PayOS CDN SDK embeds the checkout with the current return URL and cleans up on close', async ({
  page,
  request,
}) => {
  const state = await fixture(page);
  state.row = {
    ...state.row,
    state: 'ORDERED',
    orderId: 'order-1',
    orderStatus: 'AWAITING_PAYMENT',
  };
  await mockPayos(page);
  const sdkResponse = await request.get(
    'https://cdn.payos.vn/payos-checkout/v1/stable/payos-initialize.js',
  );
  expect(sdkResponse.ok()).toBe(true);
  await page.route('https://cdn.payos.vn/payos-checkout/v1/stable/payos-initialize.js', (route) =>
    route.fulfill({ response: sdkResponse }),
  );
  await page.route(`**/api/member/preorders/${id}/payment-link`, (route) =>
    route.fulfill({
      json: { checkoutUrl: 'https://pay.payos.vn/web/test-order', orderCode: 123456 },
    }),
  );
  await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
  const returnUrl = page.url();
  await page.getByRole('button', { name: 'Thanh toán ngay', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Thanh toán đơn hoa' });
  const iframe = dialog.getByTitle('Thanh toán bảo mật qua PayOS');
  await expect(iframe).toBeVisible();
  const src = new URL((await iframe.getAttribute('src'))!);
  expect(src.origin).toBe('https://pay.payos.vn');
  expect(src.pathname).toBe('/embedded/test-order');
  expect(src.searchParams.get('redirect_uri')).toBe(returnUrl);
  await dialog.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('iframe[src*="pay.payos.vn"]')).toHaveCount(0);
  await expect(page).toHaveURL(returnUrl);
});

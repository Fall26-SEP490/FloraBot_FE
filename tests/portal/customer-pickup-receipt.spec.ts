import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const id = '70000000-0000-0000-0000-000000000001';
const orderId = '80000000-0000-0000-0000-000000000001';
const token = 'ABCD2345';
const row = {
  id,
  kind: 'CUSTOM',
  state: 'ORDERED',
  orderStatus: 'PAID',
  ready: true,
  productId: 'p1',
  kioskId: 'k1',
  sellerId: 's1',
  pickupAt: '2030-11-10T03:00:00Z',
  pickupBefore: '2030-11-10T05:00:00Z',
  quotedPrice: 350000,
  quoteNote: 'Hoa theo yêu cầu',
  quoteExpiresAt: null,
  orderId,
  checkoutId: null,
  orderCode: 'FB-PICKUP',
  trackingToken: token,
  payBefore: null,
  productName: 'Hoa hồng pastel',
  shopName: 'Shop Hoa An Nhiên',
  kioskName: 'Kiosk Nguyễn Huệ',
  address: '12 Nguyễn Huệ',
  instructions: 'Hoa hồng trắng',
};
const receipt = {
  orderId,
  orderCode: 'FB-PICKUP',
  status: 'COMPLETED',
  createdAt: '2030-11-10T02:00:00Z',
  completedAt: '2030-11-10T03:30:00Z',
  subtotal: 350000,
  discount: 0,
  total: 350000,
  refunds: { pendingAmount: 0, paidAmount: 0 },
  hasComplaint: false,
  canComplain: false,
  refundInformationProvided: false,
  disputeDeadline: null,
  items: [
    { name: row.productName, quantity: 1, unitPrice: 350000, total: 350000, status: 'PICKED_UP' },
  ],
};
async function setup(page: Page) {
  const state = { order: { ...row }, receipt: { ...receipt }, writes: [] as string[], lookups: 0 };
  await page.route('**/hub/**', (r) => r.abort());
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/receipts/lookup') {
      state.lookups++;
      expect(route.request().postDataJSON()).toEqual({ orderId, trackingToken: token });
      expect(route.request().headers().cookie).toBeUndefined();
      return route.fulfill({ json: state.receipt });
    }
    if (route.request().method() !== 'GET') {
      state.writes.push(path);
      return route.abort();
    }
    if (path === '/api/auth/me')
      return route.fulfill({ json: { id: 'customer', name: 'Minh Anh', role: 'CUSTOMER' } });
    if (path === '/api/member/preorders')
      return route.fulfill({ json: { items: [state.order], page: 1, hasMore: false } });
    if (path === '/api/member/profile') return route.fulfill({ json: { loyaltyPoints: 0 } });
    if (path === '/api/member/kiosk-applications/current')
      return route.fulfill({ status: 404, json: {} });
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  return state;
}
for (const width of [390, 1440]) {
  test(`Ready order separates email OTP from private receipt codes at ${width}px`, async ({
    page,
  }) => {
    await page.clock.install({ time: new Date('2030-11-10T03:30:00Z') });
    await page.setViewportSize({ width, height: 1000 });
    const state = await setup(page);
    await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
    const guide = page.getByRole('region', { name: 'Hướng dẫn nhận hoa', exact: true });
    await expect(guide.getByRole('heading', { name: 'Nhận hoa tại kiosk' })).toBeVisible();
    await expect(guide).toContainText('OTP 8 chữ số');
    const code = guide.locator('code').filter({ hasText: token });
    await expect(code).toBeHidden();
    await guide.locator('summary').click();
    await expect(code).toBeVisible();
    await expect(guide).toContainText('không phải OTP');
    await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
    await guide.getByRole('button', { name: 'Sao chép ID', exact: true }).click();
    await expect(guide.getByRole('button', { name: 'Đã chép ID', exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(orderId);
    await guide.getByRole('button', { name: 'Sao chép mã', exact: true }).click();
    await expect(guide.getByRole('button', { name: 'Đã chép mã', exact: true })).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(token);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await guide.locator('summary').click();
    await guide.scrollIntoViewIfNeeded();
    expect(
      (
        await new AxeBuilder({ page })
          .include('#web-orders')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`pickup-${width}.png`) });
    await page.getByRole('link', { name: 'Xem biên nhận', exact: true }).click();
    await expect(page).toHaveURL(/\/receipt$/);
    await expect(page.getByRole('heading', { name: 'Đơn FB-PICKUP', exact: true })).toBeFocused();
    await expect(
      page.getByRole('button', { name: 'Cập nhật trạng thái', exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Mã tra cứu', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xóa thông tin', exact: true })).toHaveCount(0);
    expect(
      (
        await new AxeBuilder({ page })
          .include('#main')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: test.info().outputPath(`receipt-${width}.png`) });
    state.receipt.status = 'REFUNDED';
    await page.getByRole('button', { name: 'Cập nhật trạng thái', exact: true }).click();
    await expect(page.locator('.receipt-result')).toContainText('Đã hoàn tiền');
    expect(state.lookups).toBe(2);
    expect(state.writes).toEqual([]);
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
    ).not.toContain(token);
  });
}
for (const [time, message] of [
  ['2030-11-10T02:00:00Z', 'Chưa đến giờ nhận'],
  ['2030-11-10T06:00:00Z', 'Đã qua giờ nhận trên đơn'],
]) {
  test(`Pickup timing explains ${message} without modifying the order`, async ({ page }) => {
    await page.clock.install({ time: new Date(time) });
    const state = await setup(page);
    await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
    await expect(
      page.getByRole('region', { name: 'Hướng dẫn nhận hoa', exact: true }),
    ).toContainText(message);
    if (message === 'Đã qua giờ nhận trên đơn') {
      const guide = page.getByRole('region', { name: 'Hướng dẫn nhận hoa', exact: true });
      await expect(guide).toContainText('Nhắn shop về đơn này trước khi đến kiosk.');
      await expect(guide.getByRole('list')).toHaveCount(0);
      await expect(
        guide.getByRole('button', { name: 'Nhắn shop về đơn này', exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Nhắn shop về đơn này', exact: true }),
      ).toHaveCount(1);
    }
    expect(state.writes).toEqual([]);
  });
}
test('A paid order still being prepared never offers pickup codes', async ({ page }) => {
  const state = await setup(page);
  state.order.ready = false;
  await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
  await expect(page.getByRole('region', { name: 'Thông tin đơn hoa', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Hướng dẫn nhận hoa', exact: true })).toHaveCount(
    0,
  );
  await expect(page.getByLabel('Thông tin nhận hoa tại Kiosk')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Xem biên nhận', exact: true })).toBeVisible();
  expect(state.writes).toEqual([]);
});
test('An unpaid preorder with a tracking token offers payment but no receipt', async ({ page }) => {
  const state = await setup(page);
  state.order.ready = false;
  state.order.orderStatus = 'AWAITING_PAYMENT';
  await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
  await expect(page.getByRole('button', { name: 'Thanh toán ngay' })).toBeEnabled();
  await expect(page.getByRole('link', { name: 'Xem biên nhận', exact: true })).toHaveCount(0);
  await expect(page.getByRole('region', { name: 'Hướng dẫn nhận hoa' })).toHaveCount(0);
  expect(state.lookups).toBe(0);
  await expect(page.getByRole('link', { name: 'Phản ánh về hoa', exact: true })).toHaveCount(0);
});
for (const width of [390, 1440]) {
  test(`A completed preorder opens its complaint form directly at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await setup(page);
    state.order.orderStatus = 'COMPLETED';
    state.receipt.canComplain = true;
    await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
    await page.getByRole('link', { name: 'Phản ánh về hoa', exact: true }).click();
    await expect(page).toHaveURL(/\/phan-anh$/);
    const form = page.getByRole('form', { name: 'Phản ánh về hoa', exact: true });
    await expect(form.getByLabel('Vấn đề với bó hoa')).toBeFocused();
    expect(state.lookups).toBe(1);
    await page.reload();
    await expect(form.getByLabel('Vấn đề với bó hoa')).toBeFocused();
    expect(state.lookups).toBe(2);
    expect(state.writes).toEqual([]);
    await form.getByRole('button', { name: 'Hủy phản ánh', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Gửi phản ánh về hoa', exact: true }),
    ).toBeFocused();
    expect(
      (
        await new AxeBuilder({ page })
          .include('#main')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.getByRole('link', { name: 'Quay lại đơn hàng', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/tai-khoan\\?requestId=${id}#web-orders$`));
    await expect(page.getByRole('link', { name: 'Phản ánh về hoa', exact: true })).toBeVisible();
  });
}
for (const alreadyReported of [false, true]) {
  test(`A complaint link explains ineligibility (already reported: ${alreadyReported})`, async ({
    page,
  }) => {
    const duplicateKeys: string[] = [];
    page.on('console', (message) => {
      if (/same key|unique.*key/i.test(message.text())) duplicateKeys.push(message.text());
    });
    const state = await setup(page);
    state.order.orderStatus = 'COMPLETED';
    state.receipt.hasComplaint = alreadyReported;
    if (alreadyReported) {
      await page.route('**/api/receipts/complaints/lookup?*', (route) => {
        expect(route.request().method()).toBe('POST');
        expect(route.request().postDataJSON()).toEqual({ orderId, trackingToken: token });
        return route.fulfill({
          json: {
            id: '90000000-0000-0000-0000-000000000001',
            orderId,
            status: 'OPEN',
            handlingState: 'REPORTED',
            reason: 'Hoa bị dập khi nhận.',
            createdAt: receipt.completedAt,
            items: [],
            evidence: { items: [], page: 1, hasMore: false },
          },
        });
      });
    }
    await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
    await page.getByRole('link', { name: 'Phản ánh về hoa', exact: true }).click();
    await expect(
      page.getByRole('status').filter({
        hasText: alreadyReported
          ? 'Đã ghi nhận phản ánh cho đơn này.'
          : 'Đơn này hiện chưa được hệ thống cho phép gửi phản ánh chất lượng hoa.',
      }),
    ).toBeVisible();
    if (alreadyReported) {
      await expect(page.getByText('Chờ shop tiếp nhận', { exact: true })).toBeVisible();
    }
    await expect(page.getByRole('form', { name: 'Phản ánh về hoa' })).toHaveCount(0);
    expect(state.lookups).toBe(1);
    expect(state.writes).toEqual([]);
    expect(duplicateKeys).toEqual([]);
  });
}
test('Receipt of a paid order does not claim stock readiness or expose its lookup codes by default', async ({
  page,
}) => {
  const state = await setup(page);
  state.receipt.status = 'PAID';
  await page.goto(`/receipt#order=${orderId}&token=${token}`);
  await expect(page.getByRole('heading', { name: 'Đơn FB-PICKUP', exact: true })).toBeFocused();
  await expect(page.locator('.receipt-recovery code')).toBeHidden();
  await page.locator('.receipt-recovery summary').click();
  await expect(page.locator('.receipt-recovery')).toContainText('không xác nhận hoa đã sẵn sàng');
  expect(state.writes).toEqual([]);
});
test('An expired complaint link explains the deadline without offering a form', async ({
  page,
}) => {
  const state = await setup(page);
  Object.assign(state.receipt, { disputeDeadline: '2020-11-11T03:30:00Z' });
  await page.goto(`/receipt#order=${orderId}&token=${token}`);
  await expect(page.getByRole('heading', { name: 'Đơn FB-PICKUP', exact: true })).toBeVisible();
  await expect(page.getByText('Đã hết thời hạn gửi phản ánh cho đơn này.')).toHaveCount(0);
  await page.getByRole('link', { name: 'Phản ánh về hoa', exact: true }).click();
  await expect(page).toHaveURL(/\/phan-anh$/);
  await expect(
    page.getByRole('heading', { name: 'Đã hết hạn phản ánh', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('status').filter({ hasText: 'Hạn gửi:' })).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('complaint-expired.png'), fullPage: true });
  await expect(page.getByRole('form', { name: 'Phản ánh về hoa' })).toHaveCount(0);
  expect(state.lookups).toBe(2);
  expect(state.writes).toEqual([]);
});
test('A complaint page without receipt codes explains how to select an order', async ({ page }) => {
  const state = await setup(page);
  await page.goto('/phan-anh');
  await expect(page.getByRole('heading', { name: 'Chọn đơn cần phản ánh' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem đơn hàng', exact: true })).toHaveAttribute(
    'href',
    '/tai-khoan#web-orders',
  );
  await expect(
    page.getByRole('link', { name: 'Tra cứu bằng mã biên nhận', exact: true }),
  ).toHaveAttribute('href', '/receipt');
  await expect(page.getByRole('link', { name: 'Quay lại biên nhận', exact: true })).toHaveCount(0);
  await expect(page.getByRole('form', { name: 'Phản ánh về hoa' })).toHaveCount(0);
  expect(state.lookups).toBe(0);
  expect(state.writes).toEqual([]);
});
test('A failed complaint lookup can retry without losing the order or submitting a complaint', async ({
  page,
}) => {
  const state = await setup(page);
  state.receipt.canComplain = true;
  let attempts = 0;
  await page.route('**/api/receipts/lookup', (route) => {
    attempts++;
    return attempts === 1 ? route.fulfill({ status: 500 }) : route.fulfill({ json: state.receipt });
  });
  await page.goto(`/phan-anh#order=${orderId}&token=${token}`);
  await expect(page.getByRole('heading', { name: 'Chưa tải được thông tin đơn' })).toBeVisible();
  await expect(page.getByRole('form', { name: 'Phản ánh về hoa' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Phản ánh về hoa' })).toBeVisible();
  expect(attempts).toBe(2);
  expect(state.writes).toEqual([]);
});

test('Receipt and complaint reloads keep the same order and return to its original list page', async ({
  page,
}) => {
  const state = await setup(page);
  state.order.orderStatus = 'COMPLETED';
  state.receipt.canComplain = true;
  await page.goto(`/tai-khoan?requestId=${id}&page=3#web-orders`);
  await page.getByRole('link', { name: 'Xem biên nhận', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đơn FB-PICKUP', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Đơn FB-PICKUP', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Phản ánh về hoa', exact: true }).click();
  await expect(page.getByRole('form', { name: 'Phản ánh về hoa' })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('form', { name: 'Phản ánh về hoa' })).toBeVisible();
  await page.getByRole('link', { name: 'Quay lại đơn hàng', exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`requestId=${id}&page=3#web-orders$`));
  await expect(page.locator(`#preorder-${id}`)).toHaveAttribute('open', '');
  await expect(page.locator('nav span[aria-current="page"]')).toHaveText('Trang 3');
  expect(state.writes).toEqual([]);
});

for (const width of [390, 1440]) {
  test(`Browser Back and the return button restore the selected order and scroll at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await setup(page);
    state.order.orderStatus = 'COMPLETED';
    await page.route('**/api/member/preorders?*', (route) => {
      const current = Number(new URL(route.request().url()).searchParams.get('page') || 1);
      const otherOrders = Array.from({ length: 10 }, (_, index) => ({
        ...state.order,
        id: `71000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
        productName: `Mẫu hoa ${index + 1}`,
      }));
      return route.fulfill({
        json: {
          items: current === 1 ? [otherOrders[0]] : [...otherOrders, state.order],
          page: current,
          hasMore: current === 1,
        },
      });
    });
    await page.goto('/tai-khoan#web-orders');
    await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
    await expect(page.locator('nav span[aria-current="page"]')).toHaveText('Trang 2');
    await expect(page).toHaveURL(/page=2#web-orders$/);
    const order = page.locator(`#preorder-${id}`);
    await order.locator(':scope > summary').click();
    const view = order.getByRole('link', { name: 'Xem biên nhận', exact: true });
    await view.scrollIntoViewIfNeeded();
    const position = await page.evaluate(() => scrollY);
    await view.click();
    await expect(page.getByRole('heading', { name: 'Đơn FB-PICKUP', exact: true })).toBeVisible();
    await page.goBack();
    await expect(order).toHaveAttribute('open', '');
    await expect(page.locator('nav span[aria-current="page"]')).toHaveText('Trang 2');
    await expect
      .poll(async () => Math.abs((await page.evaluate(() => scrollY)) - position))
      .toBeLessThan(12);
    await view.click();
    await expect(page.getByRole('heading', { name: 'Đơn FB-PICKUP', exact: true })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Đơn FB-PICKUP', exact: true })).toBeVisible();
    await page.getByRole('link', { name: 'Quay lại đơn hàng', exact: true }).click();
    await expect(order).toHaveAttribute('open', '');
    await expect(page.locator('nav span[aria-current="page"]')).toHaveText('Trang 2');
    await expect
      .poll(async () => Math.abs((await page.evaluate(() => scrollY)) - position))
      .toBeLessThan(12);
    expect(state.writes).toEqual([]);
  });
}

test('Receipt history entries restore their own order instead of a shared last-opened receipt', async ({
  page,
}) => {
  const state = await setup(page);
  const secondId = '80000000-0000-0000-0000-000000000002';
  await page.route('**/api/receipts/lookup', (route) => {
    const body = route.request().postDataJSON();
    return route.fulfill({
      json: {
        ...state.receipt,
        orderId: body.orderId,
        orderCode: body.orderId === secondId ? 'FB-SECOND' : 'FB-FIRST',
      },
    });
  });
  await page.goto(`/receipt#order=${orderId}&token=${token}`);
  await expect(page.getByRole('heading', { name: 'Đơn FB-FIRST', exact: true })).toBeVisible();
  await page.goto(`/receipt#order=${secondId}&token=BCDE3456`);
  await expect(page.getByRole('heading', { name: 'Đơn FB-SECOND', exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Đơn FB-SECOND', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'Đơn FB-FIRST', exact: true })).toBeVisible();
  await page.goto('/phan-anh');
  await expect(page.getByRole('heading', { name: 'Chọn đơn cần phản ánh' })).toBeVisible();
  expect(state.writes).toEqual([]);
});

test('A purchase support link preserves the transaction across reload and return', async ({
  page,
}) => {
  const state = await setup(page);
  const purchaseId = '90000000-0000-0000-0000-000000000001';
  await page.route('**/api/member/history?*', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: purchaseId,
            orderCode: 'FB-WALKIN',
            status: 'COMPLETED',
            createdAt: '2030-11-10T03:00:00Z',
            totalAmount: 350000,
            pointsEarned: 0,
            pointsRedeemed: 0,
            shopName: 'Shop Hoa An Nhiên',
            items: ['Hoa mua tại kiosk'],
          },
        ],
        page: 2,
        hasMore: false,
      },
    }),
  );
  await page.goto('/tai-khoan?page=2#web-orders');
  const purchase = page.locator(`#preorder-purchase-${purchaseId}`);
  await purchase.locator(':scope > summary').click();
  await purchase.getByRole('link', { name: 'Liên hệ hỗ trợ về giao dịch FB-WALKIN' }).click();
  await expect(page).toHaveURL(/\/lien-he\?/);
  await expect(page.getByText('Hỗ trợ giao dịch FB-WALKIN.')).toBeVisible();
  await page.reload();
  await page.getByRole('link', { name: 'Quay lại đơn hàng', exact: true }).click();
  await expect(purchase).toHaveAttribute('open', '');
  await expect(page.locator('nav span[aria-current="page"]')).toHaveText('Trang 2');
  expect(state.writes).toEqual([]);
});

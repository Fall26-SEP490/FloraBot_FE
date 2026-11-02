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
    await expect(
      guide.getByRole('heading', { name: 'Nhận hoa bằng OTP trong email' }),
    ).toBeVisible();
    await expect(guide).toContainText('OTP 8 chữ số');
    const code = guide.locator('code').filter({ hasText: token });
    await expect(code).toBeHidden();
    await guide.locator('summary').click();
    await expect(code).toBeVisible();
    await expect(guide).toContainText('không phải OTP');
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
    await page
      .getByRole('link', { name: 'Xem biên nhận và hỗ trợ hoàn tiền', exact: true })
      .click();
    await expect(page).toHaveURL(/\/receipt$/);
    await expect(page.getByLabel('Mã tra cứu', { exact: true })).toHaveValue(token);
    await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Đơn FB-PICKUP', exact: true })).toBeFocused();
    await expect(
      page.getByRole('button', { name: 'Cập nhật trạng thái', exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Mã tra cứu', { exact: true })).toBeHidden();
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
    await page.getByRole('button', { name: 'Cập nhật trạng thái', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Đơn FB-PICKUP', exact: true })).toBeFocused();
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
  expect(state.writes).toEqual([]);
});
test('Receipt of a paid order does not claim stock readiness or expose its lookup codes by default', async ({
  page,
}) => {
  const state = await setup(page);
  state.receipt.status = 'PAID';
  await page.goto(`/receipt#order=${orderId}&token=${token}`);
  await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đơn FB-PICKUP', exact: true })).toBeFocused();
  await expect(page.locator('.receipt-recovery code')).toBeHidden();
  await page.locator('.receipt-recovery summary').click();
  await expect(page.locator('.receipt-recovery')).toContainText('không xác nhận hoa đã sẵn sàng');
  expect(state.writes).toEqual([]);
});

import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const rows = [
  ['requested', 'REQUESTED', null, false],
  ['quoted', 'QUOTED', null, false],
  ['payment', 'ORDERED', 'AWAITING_PAYMENT', false],
  ['preparing', 'ORDERED', 'PAID', false],
  ['ready', 'ORDERED', 'PAID', true],
  ['completed', 'ORDERED', 'COMPLETED', true],
  ['failed', 'CANCELLED', 'DISPENSE_FAILED', false],
].map(([id, state, orderStatus, ready]) => ({
  id,
  state,
  orderStatus,
  ready,
  kind: 'CUSTOM',
  productId: 'p1',
  kioskId: 'k1',
  sellerId: 's1',
  instructions: 'Bó hoa hồng màu trắng',
  pickupAt: '2030-11-10T03:00:00Z',
  pickupBefore: '2030-11-10T05:00:00Z',
  quotedPrice: state === 'REQUESTED' ? null : 350000,
  quoteExpiresAt: '2030-11-09T00:00:00Z',
  quoteNote: 'Hoa theo yêu cầu',
  orderId: orderStatus ? `order-${id}` : null,
  checkoutId: null,
  orderCode: `FB-${id}`,
  trackingToken: null,
  payBefore: '2030-11-09T02:00:00Z',
  productName: `Hoa ${id}`,
  shopName: 'Shop Hoa An Nhiên',
  kioskName: 'Kiosk Nguyễn Huệ',
  address: '12 Nguyễn Huệ',
}));
async function setup(page: Page, status = 200, empty = false, hasMore = false) {
  const writes: string[] = [];
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') {
      writes.push(path);
      return route.abort();
    }
    if (path === '/api/auth/me')
      return route.fulfill({ json: { id: 'customer', name: 'Minh Anh', role: 'CUSTOMER' } });
    if (path === '/api/member/preorders')
      return route.fulfill({
        status,
        json:
          status === 200
            ? { items: empty ? [] : rows, page: 1, hasMore }
            : { detail: 'Unavailable' },
      });
    if (path === '/api/member/kiosk-applications/current')
      return route.fulfill({ status: 404, json: {} });
    if (path === '/api/member/chats/unread-count') return route.fulfill({ json: 0 });
    if (path === '/api/member/profile') return route.fulfill({ json: { loyaltyPoints: 0 } });
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  return writes;
}
for (const width of [390, 1440]) {
  test(`Customer filters and reads the next step without executing a transaction at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    const writes = await setup(page);
    await page.goto('/tai-khoan#web-orders');
    const filters = page.getByRole('group', { name: 'Tóm tắt trang đơn đang xem' });
    await expect(filters.getByRole('button', { name: 'Tất cả 7', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await filters.getByRole('button', { name: 'Cần bạn xử lý 2', exact: true }).click();
    await expect(page.locator('.customer-order-list > li')).toHaveCount(2);
    await expect(page.locator('.customer-order-list')).toContainText(
      'chỉ thanh toán sau khi đồng ý báo giá',
    );
    await expect(page.locator('.customer-order-list')).toContainText('chờ đơn cập nhật trạng thái');
    await expect(page.locator('.customer-order-list')).not.toContainText('Hoa completed');
    await filters.getByRole('button', { name: 'Chờ nhận hoa 1', exact: true }).click();
    await expect(page.locator('.customer-order-list > li')).toHaveCount(1);
    await expect(page.locator('.customer-order-list')).toContainText('Kiểm tra giờ nhận');
    await page.locator('.customer-order-list > li > details > summary').click();
    await expect(page.locator('.order-next-step')).toContainText('dùng mã OTP trong email');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include('#main')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`orders-${width}.png`) });
    await page.goto('/tai-khoan#overview');
    await expect(page.locator('.account-pending-list')).toContainText('Xem báo giá');
    await expect(page.locator('.account-pending-list')).toContainText('Xem thanh toán');
    await page.locator('.account-pending-list').getByRole('link', { name: 'Xem báo giá' }).click();
    await expect(page).toHaveURL(/requestId=quoted#web-orders$/);
    await expect(page.locator('#preorder-quoted')).toHaveAttribute('open', '');
    expect(writes).toEqual([]);
  });
}
test('Customer can recover from a failed order API while the rest of the account remains available', async ({
  page,
}) => {
  await setup(page, 503);
  await page.goto('/tai-khoan#overview');
  await expect(page.locator('.account-pending [role="alert"]')).toContainText('Chưa tải được đơn');
  await expect(page.getByRole('button', { name: 'Tải lại đơn', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Khám phá hoa', exact: true })).toBeVisible();
  await page.route('**/api/member/preorders?*', (route) =>
    route.fulfill({ json: { items: rows, page: 1, hasMore: false } }),
  );
  await page.getByRole('button', { name: 'Tải lại đơn', exact: true }).click();
  await expect(page.locator('.account-pending-list li')).toHaveCount(3);
});
test('An empty page with more results does not claim there are no orders in the account', async ({
  page,
}) => {
  await setup(page, 200, true, true);
  await page.goto('/tai-khoan#overview');
  await expect(page.locator('.account-pending')).toContainText('danh sách vừa tải');
  await expect(page.locator('.account-pending')).toContainText('Tất cả đơn');
});

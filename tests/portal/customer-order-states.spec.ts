import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { WebOrder } from '../../apps/web/src/features/orders/orders.types';

const base: WebOrder = {
  id: 'request-state',
  kind: 'CUSTOM',
  state: 'ORDERED',
  orderStatus: 'PAID',
  ready: false,
  productId: 'product-state',
  sellerId: 'seller-state',
  kioskId: 'kiosk-state',
  productName: 'Bó hoa hồng pastel',
  shopName: 'Tiệm Hoa An Nhiên',
  kioskName: 'Kiosk Nguyễn Huệ',
  address: '12 Nguyễn Huệ, Phường Sài Gòn, Thành phố Hồ Chí Minh',
  instructions: 'Hoa hồng pastel tặng sinh nhật, kèm nơ trắng.',
  pickupAt: '2030-11-10T03:00:00Z',
  pickupBefore: '2030-11-10T05:00:00Z',
  quotedPrice: 380000,
  quotedFlowerPrice: 350000,
  quotedAccessoryTotal: 30000,
  requestedAccessories: [{ accessoryId: 'bow', name: 'Nơ trắng', quantity: 3 }],
  quotedAccessories: [
    { accessoryId: 'bow', name: 'Nơ trắng', quantity: 2, unitPrice: 15000, lineTotal: 30000 },
  ],
  quoteVersion: 1,
  quoteNote: 'Hoa tông pastel, nơ trắng. Shop nhận 2 nơ theo báo giá.',
  quoteExpiresAt: '2030-11-11T03:00:00Z',
  orderId: 'order-state',
  checkoutId: null,
  orderCode: 'FB-STATE',
  trackingToken: 'PRIV2345',
  payBefore: '2030-11-11T03:00:00Z',
};
const cases: {
  key: string;
  patch: Partial<WebOrder>;
  text: string;
  disabled?: string;
  noReceipt?: boolean;
}[] = [
  {
    key: 'requested',
    patch: {
      state: 'REQUESTED',
      orderStatus: null,
      orderId: null,
      quotedPrice: null,
      quotedFlowerPrice: null,
      quotedAccessories: [],
      quoteNote: null,
    },
    text: 'Chưa có báo giá',
    noReceipt: true,
  },
  {
    key: 'quoted',
    patch: { state: 'QUOTED', orderStatus: null, orderId: null },
    text: 'Thay đổi so với yêu cầu',
    noReceipt: true,
  },
  {
    key: 'quote-expired',
    patch: {
      state: 'QUOTED',
      orderStatus: null,
      orderId: null,
      quoteExpiresAt: '2020-01-01T00:00:00Z',
    },
    text: 'Báo giá đã hết hạn',
    disabled: 'Xác nhận báo giá',
    noReceipt: true,
  },
  {
    key: 'quote-no-price',
    patch: { state: 'QUOTED', orderStatus: null, orderId: null, quotedPrice: null },
    text: 'Báo giá chưa có số tiền hợp lệ',
    disabled: 'Xác nhận báo giá',
    noReceipt: true,
  },
  {
    key: 'payment',
    patch: { orderStatus: 'AWAITING_PAYMENT' },
    text: 'Số tiền cần thanh toán',
    noReceipt: true,
  },
  {
    key: 'payment-expired',
    patch: { orderStatus: 'AWAITING_PAYMENT', payBefore: '2020-01-01T00:00:00Z' },
    text: 'Đã hết hạn thanh toán',
    disabled: 'Thanh toán ngay',
    noReceipt: true,
  },
  { key: 'preparing', patch: {}, text: 'Shop đang chuẩn bị hoa.' },
  {
    key: 'pickup-early',
    patch: { ready: true, pickupAt: '2030-11-11T03:00:00Z', pickupBefore: '2030-11-11T05:00:00Z' },
    text: 'Chưa đến giờ nhận',
  },
  { key: 'pickup-within', patch: { ready: true }, text: 'OTP 8 chữ số' },
  {
    key: 'pickup-expired',
    patch: { ready: true, pickupAt: '2030-11-09T03:00:00Z', pickupBefore: '2030-11-09T05:00:00Z' },
    text: 'Đã qua giờ nhận trên đơn',
  },
  {
    key: 'dispensing',
    patch: { orderStatus: 'DISPENSING', ready: true },
    text: 'Kiosk đang xử lý nhận hoa',
  },
  { key: 'completed', patch: { orderStatus: 'COMPLETED', ready: true }, text: 'Bạn đã nhận hoa.' },
  {
    key: 'cancelled',
    patch: { state: 'CANCELLED', orderStatus: 'CANCELLED' },
    text: 'Đơn đã kết thúc.',
    noReceipt: true,
  },
  {
    key: 'rejected',
    patch: {
      state: 'REJECTED',
      orderStatus: null,
      orderId: null,
      quotedPrice: null,
      quotedFlowerPrice: null,
    },
    text: 'Phản hồi của shop',
    noReceipt: true,
  },
  { key: 'expired', patch: { orderStatus: 'EXPIRED' }, text: 'Đơn đã kết thúc.', noReceipt: true },
  { key: 'disputed', patch: { orderStatus: 'DISPUTED' }, text: 'theo dõi phản ánh hoặc hoàn tiền' },
  {
    key: 'failed',
    patch: { orderStatus: 'DISPENSE_FAILED' },
    text: 'theo dõi phản ánh hoặc hoàn tiền',
  },
  { key: 'refunded', patch: { orderStatus: 'REFUNDED' }, text: 'Đơn đã được hoàn tiền.' },
];

for (const width of [390, 1440]) {
  test(`Customer order conditional surfaces at ${width}px`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: 1000 });
    await page.clock.install({ time: new Date('2030-11-10T04:00:00Z') });
    let row = { ...base };
    const mutations: string[] = [];
    const privilegedReads: string[] = [];
    await page.route('**/hub/**', (r) => r.abort());
    await page.route('**/api/**', (route) => {
      const req = route.request();
      const path = new URL(req.url()).pathname;
      if (path.startsWith('/api/me/products')) privilegedReads.push(path);
      if (req.method() !== 'GET') {
        mutations.push(path);
        return route.abort();
      }
      if (path === '/api/auth/me')
        return route.fulfill({ json: { id: 'customer', role: 'CUSTOMER', name: 'Minh Anh' } });
      if (path === '/api/member/preorders')
        return route.fulfill({ json: { items: [row], page: 1, hasMore: false } });
      if (path === '/api/member/kiosk-applications/current')
        return route.fulfill({ status: 404, json: {} });
      if (path === '/api/shop/catalog')
        return route.fulfill({
          json: {
            items: [
              {
                productId: base.productId,
                sellerId: base.sellerId,
                photo: 'https://images.example.test/bouquet.webp',
              },
            ],
            hasMore: false,
          },
        });
      return route.fulfill({ json: { items: [], hasMore: false, unreadCount: 0 } });
    });
    await page.route('https://images.example.test/**', async (route) => {
      await route.fulfill({
        path: 'apps/web/public/images/floral-white-online.webp',
        contentType: 'image/webp',
      });
    });
    for (const item of cases) {
      row = { ...base, ...item.patch };
      await page.goto(`/tai-khoan?requestId=${base.id}#web-orders`);
      await page.reload();
      await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toHaveCount(0);
      const card = page.locator(`#preorder-${base.id}`);
      await expect(card).toHaveAttribute('open', '');
      await expect(card).toContainText(item.text);
      await expect(card.locator('img')).toBeVisible();
      if (item.disabled)
        await expect(card.getByRole('button', { name: item.disabled, exact: true })).toBeDisabled();
      await expect(card.getByRole('link', { name: 'Xem biên nhận', exact: true })).toHaveCount(
        item.noReceipt ? 0 : 1,
      );
      await expect(card.getByRole('link', { name: 'Phản ánh về hoa', exact: true })).toHaveCount(
        item.key === 'completed' ? 1 : 0,
      );
      await expect(card.locator('code').filter({ hasText: base.trackingToken! })).toBeHidden();
      const main = page.locator('#web-orders');
      await main.scrollIntoViewIfNeeded();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
        item.key,
      ).toBe(true);
      if (
        [
          'quoted',
          'payment',
          'pickup-within',
          'pickup-expired',
          'completed',
          'failed',
          'refunded',
        ].includes(item.key)
      ) {
        expect(
          (
            await new AxeBuilder({ page })
              .include('#web-orders')
              .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
              .analyze()
          ).violations,
          item.key,
        ).toEqual([]);
        await page.screenshot({
          path: test.info().outputPath(`${item.key}-${width}.png`),
          fullPage: true,
        });
      }
    }
    expect(mutations).toEqual([]);
    expect(privilegedReads).toEqual([]);
  });
}

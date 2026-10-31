import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const sellerId = '20000000-0000-0000-0000-000000000001';
const kioskId = '40000000-0000-0000-0000-000000000001';
const productId = '30000000-0000-0000-0000-000000000001';
const slotId = '60000000-0000-0000-0000-000000000001';
const pickupAt = new Date(Date.now() + 4 * 3600000).toISOString();
const flower = {
  productId,
  sellerId,
  kioskId,
  name: 'Bó hoa giả pastel',
  shopName: 'Shop kiểm thử',
  kioskName: 'Kiosk kiểm thử',
  address: 'Địa điểm kiểm thử',
  description: 'Mẫu hoa giả cho sinh nhật',
  price: 350000,
  photo: null,
  bouquets: [],
};
function session(role: string) {
  return {
    id: `10000000-0000-0000-0000-${role === 'SELLER' ? '000000000003' : role === 'ADMIN' ? '000000000001' : '000000000010'}`,
    name: 'Tài khoản kiểm thử',
    role,
    sellerId: role === 'SELLER' ? sellerId : null,
    sellerStatus: 'ACTIVE',
    packageExpiresAt: '2030-10-16',
  };
}
function order() {
  return {
    id: '70000000-0000-0000-0000-000000000001',
    kind: 'CUSTOM',
    state: 'REQUESTED',
    productId,
    sellerId,
    kioskId,
    instructions: 'Hoa giả pastel, ngân sách 400000 đồng',
    pickupAt,
    pickupBefore: new Date(Date.now() + 6 * 3600000).toISOString(),
    quotedPrice: null as number | null,
    quoteNote: null as string | null,
    quoteExpiresAt: new Date(Date.now() + 3600000).toISOString(),
    orderId: null as string | null,
    checkoutId: null as string | null,
    orderCode: null as string | null,
    orderStatus: null as string | null,
    trackingToken: null as string | null,
    ready: false,
    payBefore: new Date(Date.now() + 420000).toISOString(),
    productName: flower.name,
    shopName: flower.shopName,
    kioskName: flower.kioskName,
    address: flower.address,
  };
}
async function common(
  page: Page,
  getRole: () => string,
  getOrder: () => ReturnType<typeof order>[],
  mutate?: (path: string, body: Record<string, unknown>) => Promise<unknown>,
) {
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api', '');
    if (route.request().method() === 'POST' && mutate) {
      const result = await mutate(path, route.request().postDataJSON() ?? {});
      if (result !== undefined) {
        await route.fulfill({ json: result });
        return;
      }
    }
    const data =
      path === '/auth/me'
        ? session(getRole())
        : path === '/member/profile'
          ? {
              id: session('CUSTOMER').id,
              fullName: 'Khách kiểm thử',
              email: 'customer@example.test',
              loyaltyPoints: 0,
            }
          : path === '/shop/catalog'
            ? { items: [flower], page: 1, hasMore: false }
            : path.endsWith('/preorders')
              ? { items: getOrder(), page: 1, hasMore: false }
              : path.endsWith('/slots')
                ? [
                    {
                      id: slotId,
                      kioskId,
                      slotCode: 'P01',
                      zone: 'PREORDER',
                      status: 'RENTED_EMPTY',
                      bouquetId: null,
                    },
                  ]
                : path === '/member/history'
                  ? { items: [], page: 1, hasMore: false, loyaltyPoints: 0 }
                  : path === '/admin/reports/v_admin_queue'
                    ? [{ hang_cho: 'Sự cố thiết bị đang mở', so_luong: 2 }]
                    : path === '/admin/reports/v_platform_revenue'
                      ? []
                      : { items: [], page: 1, hasMore: false };
    await route.fulfill({ json: data });
  });
}

test('Customer request → seller quote → customer acceptance/payment → seller stock → admin reports', async ({
  page,
}) => {
  let role = 'CUSTOMER';
  const row = order();
  let created = false;
  const writes: string[] = [];
  await common(
    page,
    () => role,
    () => (created ? [row] : []),
    async (path, body) => {
      writes.push(path);
      if (path === '/member/preorders') {
        expect(body.productId).toBe(productId);
        created = true;
        row.id = String(body.id);
        return { result: row.id };
      }
      if (path.endsWith('/quote')) {
        expect(role).toBe('SELLER');
        row.state = 'QUOTED';
        row.quotedPrice = Number(body.price);
        row.quoteNote = String(body.note);
        row.pickupAt = String(body.pickupAt);
        return { result: row.id };
      }
      if (path.endsWith('/accept')) {
        expect(body.price).toBe(row.quotedPrice);
        row.state = 'ORDERED';
        row.orderStatus = 'AWAITING_PAYMENT';
        row.orderId = '80000000-0000-0000-0000-000000000001';
        row.orderCode = 'TEST-ORDER-01';
        row.trackingToken = 'ABCD2345';
        return { result: row.id };
      }
      if (path.endsWith('/payment-link'))
        return { checkoutUrl: 'https://pay.payos.vn/web/test-order', amount: row.quotedPrice };
      if (path.endsWith('/fulfill')) {
        expect(body.slotId).toBe(slotId);
        expect(body.qrCode).toBe('TEST-BOUQUET-01');
        row.ready = true;
        return { result: row.id };
      }
      return undefined;
    },
  );
  await page.goto('/dat-hoa');
  await page.getByRole('button', { name: 'Đặt hoa', exact: true }).click();
  const localPickup = new Date(
    new Date(pickupAt).getTime() - new Date().getTimezoneOffset() * 60000,
  )
    .toISOString()
    .slice(0, 16);
  await page.getByLabel('Thời gian mong muốn nhận hoa').fill(localPickup);
  await page.getByLabel('Dịp tặng, màu hoa, ngân sách và lời nhắn').fill(row.instructions);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Gửi yêu cầu để shop báo giá', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đã nhận yêu cầu của bạn' })).toBeVisible();
  role = 'SELLER';
  await page.goto('/seller/orders');
  const sellerSummary = page.locator('details[id^="preorder-"] > summary');
  await expect(sellerSummary).toContainText(flower.name);
  await expect(sellerSummary).toContainText(flower.kioskName);
  await expect(page.getByLabel('Thống kê đơn ở trang 1')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Phân trang đơn đặt trước' })).toHaveCount(0);
  await page.locator('details[id^="preorder-"] > summary').click();
  await expect(page.getByText(row.instructions)).toBeVisible();
  await page.getByRole('button', { name: 'Báo giá hoặc từ chối' }).click();
  await page.getByLabel('Giá trọn gói (đồng)').fill('380000');
  await page
    .getByLabel('Mô tả mẫu hoa, điều kiện hoặc lý do từ chối')
    .fill('Hoa giả pastel theo yêu cầu, giá gồm phụ kiện.');
  await page
    .getByRole('checkbox', { name: 'Tôi đã đối chiếu và xác nhận thông tin trên.' })
    .check();
  await page.getByRole('button', { name: 'Xác nhận gửi', exact: true }).click();
  await expect(page.getByText('Đã có báo giá', { exact: true })).toBeVisible();
  role = 'CUSTOMER';
  await page.goto('/tai-khoan#web-orders');
  await page.locator('details[id^="preorder-"] > summary').click();
  await page.getByRole('button', { name: 'Kiểm tra báo giá' }).click();
  await page
    .getByRole('checkbox', { name: 'Tôi đã đối chiếu và xác nhận thông tin trên.' })
    .check();
  await page.getByRole('button', { name: 'Xác nhận gửi', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo liên kết thanh toán' }).click();
  await expect(page.getByLabel('Thông tin nhận hoa tại Kiosk')).toHaveCount(0);
  await expect(page.getByRole('link', { name: /Mở trang thanh toán payOS/ })).toHaveAttribute(
    'href',
    'https://pay.payos.vn/web/test-order',
  );
  // A controlled backend fixture represents a verified payment; no provider is contacted.
  row.orderStatus = 'PAID';
  role = 'SELLER';
  await page.goto('/seller/orders');
  await page.locator('details[id^="preorder-"] > summary').click();
  await page.getByRole('button', { name: 'Nạp hoa cho đơn này' }).click();
  await expect(page.getByRole('button', { name: 'Tiếp tục kiểm tra' })).toBeDisabled();
  await page.getByLabel('Ô trống tại tủ nhận').selectOption(slotId);
  await page.getByLabel('Mã QR của bó hoa').fill('TEST-BOUQUET-01');
  await page.getByRole('button', { name: 'Tiếp tục kiểm tra' }).click();
  await expect(page.locator('.fulfill-review')).toContainText('P01');
  await expect(page.locator('.fulfill-review')).toContainText('TEST-BOUQUET-01');
  await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
  await expect(page.getByLabel('Mã QR của bó hoa')).toHaveValue('TEST-BOUQUET-01');
  await page.getByRole('button', { name: 'Tiếp tục kiểm tra' }).click();
  await page
    .getByRole('checkbox', { name: 'Tôi đã đối chiếu và xác nhận thông tin trên.' })
    .check();
  await page.getByRole('button', { name: 'Xác nhận nạp hoa', exact: true }).click();
  await expect(page.getByText('Hoa đã sẵn sàng tại tủ', { exact: true })).toBeVisible();
  expect(
    writes.filter((path) => path.includes('device_event') || path.includes('request_pickup')),
  ).toEqual([]);
  role = 'CUSTOMER';
  await page.goto('/tai-khoan#web-orders');
  await page.locator('details[id^="preorder-"] > summary').click();
  await expect(page.getByLabel('Thông tin nhận hoa tại Kiosk')).toContainText('ABCD2345');
  await expect(page.getByLabel('Thông tin nhận hoa tại Kiosk')).toContainText(
    'Đã thanh toán nhưng chưa nhận hoa?',
  );
  role = 'ADMIN';
  await page.goto('/admin/reports');
  await expect(page.getByRole('cell', { name: 'Sự cố thiết bị đang mở' })).toBeVisible();
  await page.getByLabel('Chọn báo cáo').selectOption('v_platform_revenue');
  await expect(page.getByText(/Chưa có dữ liệu cho báo cáo này/)).toBeVisible();
});

test('payOS return opens the saved request and trusts server status instead of callback status', async ({
  page,
}) => {
  const row = {
    ...order(),
    state: 'ORDERED',
    orderStatus: 'AWAITING_PAYMENT',
    orderId: '80000000-0000-0000-0000-000000000001',
    trackingToken: 'ABCD2345',
  };
  await common(
    page,
    () => 'CUSTOMER',
    () => [row],
  );
  await page.addInitScript(
    ({ requestId }) =>
      sessionStorage.setItem(
        'florabot-preorder-payment',
        JSON.stringify({ requestId, page: 1, orderCode: 123456, savedAt: Date.now() }),
      ),
    { requestId: row.id },
  );
  await page.goto('/tai-khoan?orderCode=123456&status=PAID&cancel=false');
  await expect(page).toHaveURL(/requestId=.*paymentReturn=1#web-orders/);
  await expect(page.getByText('Đã trở về từ payOS.', { exact: false })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Tạo liên kết thanh toán' })).toBeVisible();
  await expect(page.getByLabel('Thông tin nhận hoa tại Kiosk')).toHaveCount(0);
});

test('Unknown write outcome remains locked across reload until an explicit successful read', async ({
  page,
}) => {
  const row = { ...order(), state: 'ORDERED', orderStatus: 'PAID' };
  let attempts = 0;
  await common(
    page,
    () => 'SELLER',
    () => [row],
  );
  await page.route('**/preorders/*/cancel', async (route) => {
    attempts++;
    await route.abort('failed');
  });
  await page.goto('/seller/orders');
  await page.locator('details[id^="preorder-"] > summary').click();
  await page.getByRole('button', { name: 'Hủy yêu cầu', exact: true }).click();
  await page.getByLabel('Lý do hủy').fill('Khách yêu cầu đối chiếu và hủy đơn.');
  await page
    .getByRole('checkbox', { name: 'Tôi đã đối chiếu và xác nhận thông tin trên.' })
    .check();
  await page.getByRole('button', { name: 'Xác nhận hủy đơn', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Kiểm tra kết quả từ máy chủ' })).toBeVisible();
  await page.reload();
  await page.locator('details[id^="preorder-"] > summary').click();
  await expect(page.getByRole('button', { name: 'Hủy yêu cầu', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Kiểm tra kết quả từ máy chủ' }).click();
  await expect(page.getByRole('button', { name: 'Hủy yêu cầu', exact: true })).toBeEnabled();
  expect(attempts).toBe(1);
});

for (const width of [390, 1440])
  test(`Order workflow reflows with keyboard-readable progress at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await common(
      page,
      () => 'SELLER',
      () => [{ ...order(), state: 'ORDERED', orderStatus: 'PAID' }],
    );
    await page.goto('/seller/orders');
    await page.locator('details[id^="preorder-"] > summary').click();
    await expect(page.getByRole('list', { name: 'Tiến độ đơn đặt hoa' })).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Tiến độ đơn đặt hoa' }).locator('[aria-current="step"]'),
    ).toContainText('Chuẩn bị');
    await expect(
      page.getByRole('list', { name: 'Tiến độ đơn đặt hoa' }).locator('[data-complete="true"]'),
    ).toHaveCount(2);
    await page.screenshot({ path: `artifacts/connected-orders-${width}.png`, fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  });

test('Completed and cancelled orders show their status without implying cancelled orders were fulfilled', async ({
  page,
}) => {
  await common(
    page,
    () => 'SELLER',
    () => [
      { ...order(), id: 'completed-order', state: 'ORDERED', orderStatus: 'COMPLETED' },
      { ...order(), id: 'cancelled-order', state: 'CANCELLED', orderStatus: 'CANCELLED' },
    ],
  );
  await page.goto('/seller/orders');
  const rows = page.locator('li:has(> details[id^="preorder-"])');
  await rows.nth(0).locator(':scope > details > summary').click();
  await rows.nth(1).locator(':scope > details > summary').click();
  await expect(
    rows
      .nth(0)
      .getByRole('list', { name: 'Tiến độ đơn đặt hoa' })
      .locator('[data-complete="true"]'),
  ).toHaveCount(5);
  await expect(rows.nth(1).getByRole('list', { name: 'Tiến độ đơn đặt hoa' })).toHaveCount(0);
  await expect(rows.nth(1)).toContainText('Đã hủy');
});

test('Every sample catalog item is display-only, including items with illustrative bouquet IDs', async ({
  page,
}) => {
  let writes = 0;
  await common(
    page,
    () => 'CUSTOMER',
    () => [],
  );
  await page.route('**/api/shop/catalog?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/member/preorders', async (route) => {
    writes++;
    await route.abort();
  });
  await page.route('**/api/member/chats/open', async (route) => {
    writes++;
    await route.abort();
  });
  await page.goto('/dat-hoa?demo=1');
  await page.getByRole('button', { name: 'Đặt hoa', exact: true }).first().click();
  await expect(page.getByText(/Không tạo đơn, thanh toán hoặc tin nhắn cho mẫu này/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Gửi yêu cầu để shop báo giá', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Đóng mẫu đang chọn' }).click();
  await page.getByRole('button', { name: 'Nhắn tin với shop', exact: true }).first().click();
  await expect(page.getByText(/Mẫu minh họa chưa gắn với shop thật/)).toBeVisible();
  expect(writes).toBe(0);
});

import { test, expect } from '@playwright/test';
import { setupSellerUsability, sampleRequest, shopId } from '../fixtures/seller-usability';

const ordersPath = `**/api/sellers/${shopId}/preorders?*`;

test('Seller quote form on mobile keeps totals unknown when accessory pricing fails', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setupSellerUsability(page);
  await page.route(ordersPath, (route) =>
    route.fulfill({
      json: {
        page: 1,
        hasMore: false,
        items: [
          {
            ...sampleRequest,
            requestedAccessories: [{ accessoryId: 'bow', name: 'Nơ lụa', quantity: 1 }],
          },
        ],
      },
    }),
  );
  await page.route('**/api/me/products', (route) =>
    route.fulfill({ json: [{ id: sampleRequest.productId, price: 350000 }] }),
  );
  await page.route(`**/api/sellers/${shopId}/accessories?scope=ALL`, (route) =>
    route.fulfill({ status: 503, json: {} }),
  );
  await page.goto('/seller/orders');
  await page.locator(`#preorder-${sampleRequest.id} > summary`).click();
  const row = page.getByRole('dialog');
  await row.getByRole('button', { name: 'Báo giá hoặc từ chối' }).click();
  await expect(row.getByLabel('Giá bó hoa (đồng)')).toHaveValue('350000');
  await expect(row.getByText('Chưa xác minh được giá một số phụ kiện.')).toBeVisible();
  await expect(row.getByText('Chưa đủ thông tin', { exact: true })).toBeVisible();
  await expect(row.getByLabel('Số lượng xác nhận Nơ lụa')).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await row
    .locator('form.order-action-card')
    .screenshot({ path: testInfo.outputPath('seller-quote-390.png') });
});

test('Seller must explicitly resolve accessory shortages before submitting a quote', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await setupSellerUsability(page);
  const requestedAccessories = [
    { accessoryId: 'bow', name: 'Nơ lụa', quantity: 2 },
    { accessoryId: 'card', name: 'Thiệp', quantity: 1 },
  ];
  await page.route(ordersPath, (route) =>
    route.fulfill({
      json: { items: [{ ...sampleRequest, requestedAccessories }], page: 1, hasMore: false },
    }),
  );
  await page.route(`**/api/sellers/${shopId}/accessories?scope=ALL`, (route) =>
    route.fulfill({
      json: [
        { id: 'bow', price: 10000, stockQuantity: 1, status: 'ACTIVE', kioskId: null },
        { id: 'card', price: 5000, stockQuantity: 0, status: 'ACTIVE', kioskId: null },
      ],
    }),
  );
  let sent = 0;
  await page.route(`**/api/sellers/${shopId}/preorders/${sampleRequest.id}/quote`, (route) => {
    sent++;
    expect(route.request().postDataJSON()).toMatchObject({
      price: 350000,
      accessories: [{ accessoryId: 'bow', quantity: 1 }],
    });
    return route.fulfill({ json: { result: sampleRequest.id } });
  });
  await page.goto('/seller/orders');
  await page.locator(`#preorder-${sampleRequest.id} > summary`).click();
  const row = page.getByRole('dialog');
  await row.getByRole('button', { name: 'Báo giá hoặc từ chối' }).click();
  const accessories = row.getByRole('region', { name: 'Xác nhận phụ kiện' });
  await expect(accessories.getByText('Khách chọn 2 · Kho còn 1')).toBeVisible();
  await expect(accessories.getByText('Khách chọn 1 · Đã hết hàng')).toBeVisible();
  await row.getByLabel('Ghi chú cho khách').fill('Bó hoa theo yêu cầu của khách.');
  const confirm = row.getByRole('checkbox', {
    name: 'Tôi đã đối chiếu và xác nhận thông tin trên.',
  });
  await confirm.check();
  const submit = row.getByRole('button', { name: 'Gửi báo giá', exact: true });
  await expect(submit).toBeDisabled();
  await accessories.getByRole('button', { name: 'Dùng 1 Nơ lụa còn lại' }).click();
  await expect(submit).toBeDisabled();
  await accessories.getByRole('button', { name: 'Bỏ Thiệp khỏi báo giá' }).click();
  await expect(confirm).not.toBeChecked();
  await expect(accessories.getByText('Đã bỏ khỏi báo giá · Khách chọn 1')).toBeVisible();
  await expect(row.getByText('360.000 đ', { exact: true })).toBeVisible();
  expect(sent).toBe(0);
  await confirm.check();
  await submit.click();
  await expect(row.getByText('Đã gửi báo giá.')).toBeVisible();
  expect(sent).toBe(1);
});

for (const width of [390, 1440]) {
  test(`Seller searches all loaded orders, opens a deep-linked result and resets filters at ${width}`, async ({
    page,
  }) => {
    const model = await setupSellerUsability(page);
    const rows = Array.from({ length: 25 }, (_, i) => ({
      ...sampleRequest,
      id: `test-request-${i}`,
      productName: `Hoa ${i}`,
    }));
    await page.route(ordersPath, (route) => {
      const current = Number(new URL(route.request().url()).searchParams.get('page'));
      return route.fulfill({
        json: {
          items: current === 1 ? rows.slice(0, 20) : rows.slice(20),
          page: current,
          hasMore: current === 1,
        },
      });
    });
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/seller/orders?page=2&requestId=test-request-24');
    await expect(page.getByRole('dialog')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByRole('dialog').locator('.management-modal-close')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByLabel('Tìm đơn của shop').fill('Hoa 0');
    await expect(page.locator('.web-orders summary')).toHaveCount(1);
    await expect(page.locator('#preorder-test-request-0')).toBeVisible();
    await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
    await expect(page.locator('.web-orders summary')).toHaveCount(20);
    await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
    await expect(page.locator('.web-orders summary')).toHaveCount(5);
    await page.getByRole('combobox', { name: 'Trạng thái đơn', exact: true }).click();
    await page.getByRole('option', { name: 'Chờ báo giá', exact: true }).click();
    await expect(page.locator('.web-orders summary')).toHaveCount(20);
    expect(model.writes).toEqual([]);
  });
}

test('Seller distinguishes unpaid work and keeps the existing quote and stock forms', async ({
  page,
}) => {
  const model = await setupSellerUsability(page);
  const rows = [
    sampleRequest,
    {
      ...sampleRequest,
      id: 'paid-order',
      state: 'ORDERED',
      orderStatus: 'PAID',
      quotedPrice: 300000,
    },
    {
      ...sampleRequest,
      id: 'unpaid-order',
      state: 'ORDERED',
      orderStatus: 'AWAITING_PAYMENT',
      quotedPrice: 300000,
    },
    { ...sampleRequest, id: 'ready-order', state: 'ORDERED', orderStatus: 'PAID', ready: true },
  ];
  await page.route(ordersPath, (route) =>
    route.fulfill({ json: { items: rows, page: 1, hasMore: false } }),
  );
  await page.goto('/seller/orders?filter=payment');
  await expect(page.locator('.web-orders summary')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('#preorder-unpaid-order')).toContainText('Theo dõi thanh toán');
  await page.getByRole('combobox', { name: 'Trạng thái đơn', exact: true }).click();
  await page.getByRole('option', { name: 'Chờ báo giá', exact: true }).click();
  await page.locator(`#preorder-${sampleRequest.id} > summary`).click();
  await page.getByRole('button', { name: 'Báo giá hoặc từ chối', exact: true }).click();
  await expect(page.getByLabel('Giá bó hoa (đồng)', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.getByRole('combobox', { name: 'Trạng thái đơn', exact: true }).click();
  await page.getByRole('option', { name: 'Đang chuẩn bị', exact: true }).click();
  await page.locator('#preorder-paid-order > summary').click();
  await page.getByRole('button', { name: 'Nạp hoa cho đơn này', exact: true }).click();
  await expect(page.getByLabel('Ô trống tại tủ nhận', { exact: true })).toBeVisible();
  expect(model.writes).toEqual([]);
});

test('Seller does not treat an API failure on a later order page as an empty queue', async ({
  page,
}) => {
  const model = await setupSellerUsability(page);
  let fail = true;
  await page.route(ordersPath, (route) => {
    const current = Number(new URL(route.request().url()).searchParams.get('page'));
    if (current === 2 && fail)
      return route.fulfill({ status: 503, json: { detail: 'Second page failed' } });
    return route.fulfill({
      json: {
        items: [{ ...sampleRequest, id: `order-${current}` }],
        page: current,
        hasMore: current === 1,
      },
    });
  });
  await page.goto('/seller/orders');
  await expect(page.getByRole('alert').filter({ hasText: 'Chưa tải được yêu cầu' })).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Chưa có đơn đặt trước', exact: true }),
  ).toHaveCount(0);
  fail = false;
  await page.getByRole('button', { name: 'Thử lại', exact: true }).click();
  await expect(page.locator('.web-orders summary')).toHaveCount(2);
  expect(model.writes).toEqual([]);
});

test('Seller workbench counts unread conversations across pages without marking them read', async ({
  page,
}) => {
  const model = await setupSellerUsability(page);
  await page.route(`**/api/sellers/${shopId}/chats?*`, (route) => {
    const current = Number(new URL(route.request().url()).searchParams.get('page'));
    return route.fulfill({
      json: {
        items: [{ id: `chat-${current}`, unreadCount: current === 1 ? 0 : 4 }],
        page: current,
        hasMore: current === 1,
      },
    });
  });
  await page.goto('/seller');
  const work = page.getByRole('region', { name: 'Cửa hàng của tôi', exact: true });
  await expect(work.getByRole('link', { name: /Tin nhắn khách hàng/ })).toContainText(
    '1 cuộc trò chuyện chưa đọc',
  );
  await expect(page.locator('.seller-guide > summary')).toHaveCount(0);
  expect(model.writes).toEqual([]);
});

test('Seller can load a partial queue without losing an open quote draft', async ({ page }) => {
  const model = await setupSellerUsability(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(ordersPath, async (route) => {
    const current = Number(new URL(route.request().url()).searchParams.get('page'));
    if (current === 51) await gate;
    return route.fulfill({
      json: {
        items: [
          { ...sampleRequest, id: current === 1 ? sampleRequest.id : `partial-order-${current}` },
        ],
        page: current,
        hasMore: current < 51,
      },
    });
  });
  try {
    await page.goto('/seller/orders');
    const more = page.getByRole('button', { name: 'Tải thêm đơn của shop', exact: true });
    await expect(more).toBeVisible();
    await expect(page.locator('#web-orders')).toContainText('Chưa tải hết đơn của shop');
    await page.locator(`#preorder-${sampleRequest.id} > summary`).click();
    await page.getByRole('button', { name: 'Báo giá hoặc từ chối', exact: true }).first().click();
    const price = page.getByLabel('Giá bó hoa (đồng)', { exact: true });
    await price.fill('325000');
    const drawerMore = page
      .getByRole('dialog')
      .getByRole('button', { name: 'Tải thêm đơn của shop', exact: true });
    await drawerMore.click();
    await expect(drawerMore).toBeDisabled();
    await expect(price).toHaveValue('325000');
    release();
    await expect(more).toHaveCount(0);
    await expect(price).toHaveValue('325000');
    expect(model.writes).toEqual([]);
  } finally {
    release();
  }
});

for (const width of [390, 1440]) {
  test(`Seller keeps date filtering and a compact empty table at ${width}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    const model = await setupSellerUsability(page);
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/seller/orders');
    await expect(page.getByRole('combobox', { name: 'Trạng thái đơn', exact: true })).toBeVisible();
    await expect(page.getByRole('group', { name: 'Lọc trạng thái đơn', exact: true })).toBeHidden();
    await page.getByRole('combobox', { name: 'Lọc theo ngày nhận', exact: true }).click();
    const calendar = page.getByRole('dialog', {
      name: 'Lọc theo ngày nhận (giờ Việt Nam)',
      exact: true,
    });
    await calendar.getByRole('combobox', { name: 'Năm', exact: true }).click();
    await page.getByRole('option', { name: '2020', exact: true }).click();
    await calendar.getByRole('combobox', { name: 'Tháng', exact: true }).click();
    await page.getByRole('option', { name: '1', exact: true }).click();
    await calendar.getByRole('button', { name: '01/01/2020', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Không có đơn nhận ngày 01/01/2020', exact: true }),
    ).toBeVisible();
    const empty = page.getByRole('status').filter({
      has: page.getByRole('heading', { name: 'Không có đơn nhận ngày 01/01/2020', exact: true }),
    });
    const columns = await page.getByText('Mã đơn', { exact: true }).boundingBox();
    const body = await empty.boundingBox();
    expect(columns!.y + columns!.height).toBeLessThanOrEqual(body!.y);
    expect(body!.height).toBeLessThanOrEqual(180);
    await expect(empty.locator('svg')).toHaveCount(0);
    await page.screenshot({ path: testInfo.outputPath(`empty-orders-${width}.png`) });
    await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
    await expect(page.locator('.web-orders summary')).toHaveCount(1);
    expect(model.writes).toEqual([]);
  });
}

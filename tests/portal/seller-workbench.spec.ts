import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupSellerUsability, sampleRequest, shopId } from '../fixtures/seller-usability';

const ordersPath = `**/api/sellers/${shopId}/preorders?*`;
for (const width of [390, 1440]) {
  test(`Seller workbench leads to matching work across API pages at ${width}`, async ({ page }) => {
    const model = await setupSellerUsability(page);
    model.pagedOrders = true;
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/seller');
    const work = page.getByRole('region', { name: 'Việc cần làm', exact: true });
    await expect(work).toBeVisible();
    await expect(work.getByRole('link', { name: /Chờ báo giá/ })).toContainText('1');
    await expect(work.getByRole('link', { name: /Chờ thanh toán/ })).toHaveAttribute(
      'href',
      '/seller/orders?filter=payment',
    );
    await work.getByRole('link', { name: /Chờ báo giá/ }).click();
    if (width === 390)
      await expect(page.getByRole('combobox', { name: 'Trạng thái đơn', exact: true })).toHaveValue(
        'requested',
      );
    else
      await expect(
        page.getByRole('button', { name: 'Chờ báo giá 1', exact: true }),
      ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator(`#preorder-${sampleRequest.id}`)).toBeVisible();
    await expect(page.locator('#web-orders')).toContainText('Đã tìm trên 2 yêu cầu của shop');
    expect(model.writes).toEqual([]);
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
  });
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
    await expect(page.locator('#preorder-test-request-24')).toHaveAttribute('open', '');
    await expect(page.locator('#preorder-test-request-24 > summary')).toBeFocused();
    await page.getByLabel('Tìm đơn của shop').fill('Hoa 0');
    await expect(page.locator('.web-orders summary')).toHaveCount(1);
    await expect(page.locator('#preorder-test-request-0')).toBeVisible();
    await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
    await expect(page.locator('.web-orders summary')).toHaveCount(20);
    await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
    await expect(page.locator('.web-orders summary')).toHaveCount(5);
    if (width === 390)
      await page
        .getByRole('combobox', { name: 'Trạng thái đơn', exact: true })
        .selectOption('requested');
    else await page.getByRole('button', { name: 'Chờ báo giá 25', exact: true }).click();
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
  await expect(page.locator('.web-orders summary')).toHaveCount(1);
  await expect(page.locator('#preorder-unpaid-order')).toContainText('Theo dõi thanh toán');
  await page.getByRole('button', { name: 'Chờ báo giá 1', exact: true }).click();
  await page.locator(`#preorder-${sampleRequest.id} > summary`).click();
  await page.getByRole('button', { name: 'Báo giá hoặc từ chối', exact: true }).click();
  await expect(page.getByLabel('Giá trọn gói (đồng)', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đang chuẩn bị 1', exact: true }).click();
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
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
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
  const work = page.getByRole('region', { name: 'Việc cần làm', exact: true });
  await expect(work.getByRole('link', { name: /Tin nhắn khách hàng/ })).toContainText(
    '1 cuộc trò chuyện chưa đọc',
  );
  await expect(page.locator('.seller-guide > summary')).toBeVisible();
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
    await expect(page.locator('#web-orders')).toContainText('Còn đơn chưa được tải');
    await page.locator(`#preorder-${sampleRequest.id} > summary`).click();
    await page.getByRole('button', { name: 'Báo giá hoặc từ chối', exact: true }).first().click();
    const price = page.getByLabel('Giá trọn gói (đồng)', { exact: true });
    await price.fill('325000');
    await more.click();
    await expect(more).toBeDisabled();
    await expect(price).toHaveValue('325000');
    release();
    await expect(more).toHaveCount(0);
    await expect(page.locator('#web-orders')).toContainText('Đã tìm trên 51 yêu cầu của shop');
    await expect(price).toHaveValue('325000');
    expect(model.writes).toEqual([]);
  } finally {
    release();
  }
});

test('Seller mobile keeps date filtering available without a tall status toolbar', async ({
  page,
}) => {
  const model = await setupSellerUsability(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/seller/orders');
  await expect(page.getByRole('combobox', { name: 'Trạng thái đơn', exact: true })).toBeVisible();
  await expect(page.getByRole('group', { name: 'Lọc trạng thái đơn', exact: true })).toBeHidden();
  await page.getByRole('button', { name: 'Lọc theo ngày nhận', exact: true }).click();
  await page.getByLabel('Ngày nhận hoa', { exact: true }).fill('2020-01-01');
  await expect(
    page.getByRole('heading', { name: 'Không tìm thấy yêu cầu phù hợp', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
  await expect(page.locator('.web-orders summary')).toHaveCount(1);
  expect(model.writes).toEqual([]);
});

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupSellerUsability, shopId, kioskId } from '../fixtures/seller-usability';

for (const width of [390, 1440]) {
  test(`Seller delivery assignment is clear and keeps token-scoped payload at ${width}`, async ({
    page,
  }) => {
    const model = await setupSellerUsability(page);
    await page.setViewportSize({ width, height: 950 });
    await page.route('**/staff-delivery-scopes', (route) =>
      route.fulfill({
        json: [
          {
            sellerId: shopId,
            shopName: 'Shop kiểm thử',
            kioskId,
            kioskName: 'Tủ kiểm thử Seller',
            address: 'Địa chỉ kiểm thử',
          },
        ],
      }),
    );
    let sends = 0;
    await page.route('**/api/me/staff-tasks', (route) => {
      sends++;
      expect(route.request().method()).toBe('POST');
      expect(route.request().postDataJSON()).toEqual({
        assigneeId: 'test-staff',
        kioskId,
        instructions: 'Giao hai bó hồng, kiểm tra đúng tủ.',
      });
      expect(route.request().headers()['idempotency-key']).toMatch(/^[a-f0-9-]{36}$/);
      return route.fulfill({ status: 201, json: { id: 'assigned-test' } });
    });
    await page.goto('/seller/tasks');
    await expect(page.locator('.seller-task-count')).toContainText('0 công việc trong trang 1');
    await expect(page.getByLabel('Thống kê công việc')).toHaveCount(0);
    await page.getByText('Phân công công việc mới', { exact: true }).click();
    const form = page.locator('.seller-assignment');
    await expect(form).toContainText('việc nạp hoa được nhân viên ghi nhận');
    await form.getByRole('button', { name: 'Giao công việc', exact: true }).click();
    await expect(page.getByText('Chọn nhân viên phụ trách.', { exact: true })).toBeVisible();
    expect(sends).toBe(0);
    await page.getByLabel('Nhân viên phụ trách', { exact: true }).selectOption('test-staff');
    await page
      .getByLabel('Shop và tủ giao hoa', { exact: true })
      .selectOption(`${shopId}:${kioskId}`);
    await page
      .getByLabel('Hướng dẫn công việc', { exact: true })
      .fill('Giao hai bó hồng, kiểm tra đúng tủ.');
    expect(
      (
        await new AxeBuilder({ page })
          .include('#staff-tasks')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await form.getByRole('button', { name: 'Giao công việc', exact: true }).click();
    await expect(form.getByRole('status')).toContainText('Đã phân công');
    expect(sends).toBe(1);
    expect(model.writes).toEqual([]);
  });

  test(`Seller accessories filter the correct kiosk and preserve restock review at ${width}`, async ({
    page,
  }) => {
    const model = await setupSellerUsability(page);
    await page.setViewportSize({ width, height: 950 });
    const rows = [
      {
        id: 'accessory-a',
        name: 'Đèn trang trí',
        price: 15000,
        stockQuantity: 8,
        status: 'ACTIVE',
        kioskId,
        kioskName: 'Tủ A',
        kioskCode: 'K-A',
        kioskAddress: 'Địa chỉ A',
        kioskStatus: 'ONLINE',
      },
      {
        id: 'accessory-b',
        name: 'Thiệp hoa',
        price: 10000,
        stockQuantity: 3,
        status: 'ACTIVE',
        kioskId: 'kiosk-b',
        kioskName: 'Tủ B',
        kioskCode: 'K-B',
        kioskAddress: 'Địa chỉ B',
        kioskStatus: 'OFFLINE',
      },
    ];
    await page.route('**/api/sellers/*/accessories', (route) => route.fulfill({ json: rows }));
    let sends = 0;
    await page.route('**/flows/restock_accessory', (route) => {
      sends++;
      expect(route.request().postDataJSON()).toEqual({ p_accessory: 'accessory-b', p_qty: 2 });
      rows[1].stockQuantity = 5;
      return route.fulfill({ json: { result: 'ok' } });
    });
    await page.goto('/seller/accessories');
    await expect(page.getByText(/Chọn “Xem tồn phụ kiện”/)).toBeVisible();
    await page.getByRole('button', { name: 'Xem tồn phụ kiện', exact: true }).click();
    await expect(page.locator('.accessory-card')).toHaveCount(2);
    await page.getByLabel('Tìm phụ kiện', { exact: true }).fill('DEN');
    await expect(page.locator('.accessory-card')).toHaveCount(1);
    await expect(page.locator('.accessory-card')).toContainText('Đèn trang trí');
    await page.getByLabel('Tủ chứa phụ kiện', { exact: true }).selectOption('kiosk-b');
    await expect(page.getByText('Không có phụ kiện khớp bộ lọc.', { exact: false })).toBeVisible();
    await page.getByRole('button', { name: 'Xóa bộ lọc phụ kiện', exact: true }).click();
    await page.getByLabel('Tủ chứa phụ kiện', { exact: true }).selectOption('kiosk-b');
    const card = page.locator('.accessory-card');
    await card.getByLabel('Số lượng bổ sung cho Thiệp hoa', { exact: true }).fill('2');
    await card.getByRole('button', { name: 'Kiểm tra số lượng', exact: true }).click();
    await expect(card).toContainText('Chỉ xác nhận sau khi đã đặt phụ kiện vào đúng tủ.');
    expect(sends).toBe(0);
    expect(
      (
        await new AxeBuilder({ page })
          .include('.seller-accessories')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await card.getByRole('button', { name: 'Xác nhận bổ sung', exact: true }).click();
    await expect(card.getByRole('status')).toContainText('Đã bổ sung 2 phụ kiện Thiệp hoa.');
    expect(sends).toBe(1);
    expect(model.writes).toEqual([]);
  });
}

for (const missing of ['staff', 'kiosk'] as const) {
  test(`Seller assignment explains missing ${missing} with a useful destination`, async ({
    page,
  }) => {
    const model = await setupSellerUsability(page);
    if (missing === 'staff') model.empty = true;
    await page.goto('/seller/tasks');
    await page.getByText('Phân công công việc mới', { exact: true }).click();
    const panel = page.locator('.seller-assignment');
    const name =
      missing === 'staff' ? 'Thêm hoặc mở lại nhân viên shop' : 'Kiểm tra kiosk của shop';
    await expect(panel.getByRole('link', { name, exact: true })).toHaveAttribute(
      'href',
      missing === 'staff' ? '/seller/staff' : '/seller/kiosks',
    );
    await expect(panel.getByRole('button', { name: 'Giao công việc', exact: true })).toHaveCount(0);
    expect(model.writes).toEqual([]);
  });
}

test('Seller task counts state their current API page and preserve server status filtering', async ({
  page,
}) => {
  const model = await setupSellerUsability(page);
  await page.route('**/api/sellers/*/staff-tasks?**', (route) => {
    const url = new URL(route.request().url());
    const current = Number(url.searchParams.get('page'));
    return route.fulfill({
      json: { items: [], page: current, hasMore: !url.searchParams.has('status') && current === 1 },
    });
  });
  await page.goto('/seller/tasks');
  await expect(page.locator('.seller-task-count')).toContainText('Còn công việc ở trang sau');
  await page.getByLabel('Lọc trạng thái', { exact: true }).selectOption('SUBMITTED');
  await expect(page.locator('.seller-task-count')).toContainText('Chờ duyệt báo cáo');
  await expect(page.locator('.seller-task-count')).not.toContainText('Còn công việc');
  expect(model.writes).toEqual([]);
});

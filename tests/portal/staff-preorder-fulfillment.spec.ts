import { expect, test } from '@playwright/test';

test('Seller staff fulfills only paid preorder into a PREORDER slot', async ({ page }) => {
  let writes = 0;
  let issued = 0;
  const clockStart = new Date();
  await page.clock.install({ time: clockStart });
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: { id: 'staff-1', name: 'Nhân viên Hoa', role: 'SELLER_STAFF', sellerId: 'shop-1' },
    }),
  );
  await page.route('**/api/staff/tasks?*', (route) =>
    route.fulfill({
      json: {
        page: 1,
        hasMore: false,
        items: [
          {
            id: 'task-1',
            kind: 'DELIVERY',
            status: 'IN_PROGRESS',
            version: 2,
            assigneeId: 'staff-1',
            assigneeName: 'Nhân viên Hoa',
            kioskName: 'Tủ FPT',
            address: 'Thủ Đức',
            shopName: 'Tiệm Hoa',
            instructions: 'Giao hoa theo đơn đã thanh toán',
            report: null,
          },
        ],
      },
    }),
  );
  await page.route('**/api/staff/tasks/task-1/inventory-maintenance', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await page.route('**/api/staff/tasks/task-1/preorders', (route) =>
    route.fulfill({
      json: {
        preorders: [
          {
            requestId: 'order-1',
            orderCode: 'FB-001',
            productName: 'Hoa hồng',
            pickupAt: new Date(Date.now() + 3600000).toISOString(),
          },
        ],
        slots: [
          { id: 'slot-p', slotCode: 'P01', zone: 'PREORDER' },
          { id: 'slot-w', slotCode: 'W01', zone: 'WALK_IN' },
          { id: 'slot-null', slotCode: 'U01', zone: null },
        ],
      },
    }),
  );
  await page.route('**/api/staff/tasks/task-1/preorders/order-1/fulfill', (route) => {
    writes++;
    expect(route.request().postDataJSON()).toEqual({
      slotId: 'slot-p',
      qrCode: 'BOUQUET-001',
      loadingAccessId: 'access-2',
    });
    return route.fulfill({ json: { requestId: 'order-1', bouquetId: 'bouquet-1' } });
  });
  await page.route('**/api/staff/tasks/task-1/preorders/order-1/loading-access', (route) => {
    expect(route.request().postDataJSON()).toEqual({ slotId: 'slot-p' });
    issued++;
    return route.fulfill({
      json: {
        id: `access-${issued}`,
        expiresAt: new Date(clockStart.getTime() + (issued === 1 ? 30_000 : 300_000)).toISOString(),
        resendAfterSeconds: 0,
        requiresCode: issued === 1,
      },
    });
  });
  await page.goto('/staff');
  await page.getByText('Nạp đơn đặt trước đã thanh toán', { exact: true }).click();
  await expect(page.getByLabel('Đơn đặt trước')).toBeVisible();
  await expect(
    page.getByLabel('Ô PREORDER trống').locator('option[value="slot-null"]'),
  ).toHaveCount(0);
  await expect(page.getByLabel('Ô PREORDER trống').locator('option[value="slot-w"]')).toHaveCount(
    0,
  );
  await page.getByLabel('Đơn đặt trước').selectOption('order-1');
  await page.getByLabel('Ô PREORDER trống').selectOption('slot-p');
  await page.getByLabel('Mã QR bó hoa').fill('BOUQUET-001');
  await expect(page.getByRole('button', { name: 'Xác nhận đã nạp vào ô' })).toBeDisabled();
  await page.getByRole('button', { name: 'Yêu cầu mở ô', exact: true }).click();
  await expect(page.getByText(/Mã đã gửi qua email/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xác nhận đã nạp vào ô' })).toBeEnabled();
  await page.clock.fastForward(31_000);
  await expect(page.getByText(/Đã hết thời hạn xác nhận/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xác nhận đã nạp vào ô' })).toBeDisabled();
  expect(writes).toBe(0);
  await page.getByRole('button', { name: 'Yêu cầu mở ô lại', exact: true }).click();
  await expect(page.getByText(/Đang có lượt nạp tại ô này/)).toBeVisible();
  await page.getByRole('button', { name: 'Xác nhận đã nạp vào ô' }).click();
  await expect(page.getByText('Đã ghi nhận hoa của đơn vào ô PREORDER.')).toBeVisible();
  expect(writes).toBe(1);
});

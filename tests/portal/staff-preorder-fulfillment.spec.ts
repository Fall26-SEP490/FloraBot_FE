import { expect, test } from '@playwright/test';
import { chooseSelect } from '../fixtures/select';

for (const lostResponse of [false, true]) {
  test(`Staff preorder fulfillment and uncertain recovery, lost response: ${lostResponse}`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.route('**/api/**', (route) => route.fulfill({ status: 501, json: {} }));
    await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
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
          preorders:
            writes > 0
              ? []
              : [
                  {
                    requestId: 'order-1',
                    orderCode: 'FB-001',
                    productName: 'Hoa hồng',
                    pickupAt: new Date(Date.now() + 3600000).toISOString(),
                    accessories: [
                      {
                        accessoryId: 'bow-1',
                        name: 'Nơ xanh',
                        quantity: 2,
                        unitPrice: 15000,
                        lineTotal: 30000,
                      },
                    ],
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
      if (lostResponse) return route.abort();
      return route.fulfill({ json: { requestId: 'order-1', bouquetId: 'bouquet-1' } });
    });
    await page.route(
      '**/api/staff/tasks/task-1/preorders/order-1/loading-access',
      async (route) => {
        expect(route.request().postDataJSON()).toEqual({ slotId: 'slot-p' });
        issued++;
        const issuedAt = await page.evaluate(() => Date.now());
        return route.fulfill({
          json: {
            id: `access-${issued}`,
            expiresAt: new Date(issuedAt + (issued === 1 ? 30_000 : 300_000)).toISOString(),
            resendAfterSeconds: 0,
            requiresCode: issued === 1,
          },
        });
      },
    );
    let confirmations = 0;
    await page.route('**/api/me/maintenance-access/access-1/confirm', async (route) => {
      confirmations++;
      expect(route.request().postDataJSON()).toEqual({ code: '012345' });
      const now = await page.evaluate(() => Date.now());
      return route.fulfill({
        json: { status: 'ACCEPTED', expiresAt: new Date(now + 30_000).toISOString() },
      });
    });
    await page.goto('/staff');
    await page.clock.runFor(1000);
    await page.getByRole('button', { name: 'Tiếp tục xử lý' }).click();
    await page.getByText('Nạp hoa cho đơn đặt trước', { exact: true }).click();
    await expect(page.getByLabel('Đơn đặt trước')).toBeVisible();
    await page.getByRole('combobox', { name: 'Ô PREORDER trống', exact: true }).click();
    await expect(
      page.locator('[role="listbox"] [role="option"][data-value="slot-null"]'),
    ).toHaveCount(0);
    await expect(page.locator('[role="listbox"] [role="option"][data-value="slot-w"]')).toHaveCount(
      0,
    );
    await expect(
      page.locator('[role="listbox"] [role="option"][data-value="slot-p"]'),
    ).toBeVisible();
    await page.keyboard.press('Escape');
    await chooseSelect(page, 'Đơn đặt trước', 'order-1');
    await expect(page.getByRole('region', { name: 'Phụ kiện cần đóng gói' })).toContainText(
      'Nơ xanh × 2',
    );
    await chooseSelect(page, 'Ô PREORDER trống', 'slot-p');
    await page.getByLabel('Mã định danh bó hoa').fill('BOUQUET-001');
    await expect(page.getByRole('button', { name: 'Xác nhận đã nạp vào ô' })).toBeDisabled();
    await page.getByRole('button', { name: 'Yêu cầu mở ô', exact: true }).click();
    await expect(page.getByText(/Mã đã gửi qua email/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xác nhận đã nạp vào ô' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Xác nhận mở ô', exact: true })).toBeDisabled();
    await page.getByLabel('Mã OTP 6 số').fill('012345');
    await page.getByRole('button', { name: 'Xác nhận mở ô', exact: true }).click();
    await expect(page.getByText('Đã gửi lệnh mở ô. Chờ tủ phản hồi.')).toBeVisible();
    expect(confirmations).toBe(1);
    await expect(page.getByRole('button', { name: 'Xác nhận đã nạp vào ô' })).toBeEnabled();
    await page.clock.fastForward(31_000);
    await expect(page.getByText(/Đã hết thời hạn xác nhận/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xác nhận đã nạp vào ô' })).toBeDisabled();
    expect(writes).toBe(0);
    await page.getByRole('button', { name: 'Yêu cầu mở ô lại', exact: true }).click();
    await expect(page.getByText(/Đang có lượt nạp tại ô này/)).toBeVisible();
    await page.getByRole('button', { name: 'Xác nhận đã nạp vào ô' }).click();
    if (lostResponse) {
      await expect(page.getByRole('button', { name: 'Tải lại để kiểm tra' })).toBeVisible();
      await expect(page.getByLabel('Mã định danh bó hoa')).toHaveValue('BOUQUET-001');
      let failCheck = true;
      await page.route('**/api/staff/tasks/task-1/preorders', (route) =>
        failCheck
          ? route.fulfill({ status: 503, json: { detail: 'Tạm gián đoạn' } })
          : route.fallback(),
      );
      await page.getByRole('button', { name: 'Tải lại để kiểm tra' }).click();
      await expect(
        page.getByText('Chưa kiểm tra được kết quả. Giữ nguyên thông tin và thử kiểm tra lại.'),
      ).toBeVisible();
      expect(writes).toBe(1);
      failCheck = false;
      await page.getByRole('button', { name: 'Tải lại để kiểm tra' }).click();
      await expect(
        page.getByText('Đã cập nhật đơn và ô. Kiểm tra lại trước khi nạp tiếp.'),
      ).toBeVisible();
    } else await expect(page.getByText('Đã ghi nhận hoa của đơn vào ô PREORDER.')).toBeVisible();
    await expect(page.getByText('Chưa có đơn đã thanh toán đến giờ nạp tại tủ này.')).toBeVisible();
    await expect(page.getByLabel('Đơn đặt trước')).toHaveCount(0);
    expect(writes).toBe(1);
  });
}

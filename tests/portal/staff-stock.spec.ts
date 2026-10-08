import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1440])
  test(`Staff records only scoped inventory and recovers uncertain stock ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    let writes = 0;
    let payload: unknown;
    const actions: { id: string; qrCode: string; createdAt: string }[] = [];
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: { id: 'staff-1', name: 'Nhân viên Hoa', role: 'STAFF', sellerId: null },
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
              assigneeName: 'Nhân viên Hoa',
              kioskName: 'Tủ FPT',
              address: 'Thủ Đức',
              shopName: 'Tiệm Hoa',
              instructions: 'Giao hoa và nạp đúng ô được phân công',
              report: null,
            },
          ],
        },
      }),
    );
    await page.route('**/api/staff/tasks/task-1/stock', (route) => {
      if (route.request().method() === 'GET')
        return route.fulfill({
          json: {
            products: [{ id: 'product-1', name: 'Hoa hồng pastel' }],
            slots: actions.length ? [] : [{ id: 'slot-1', code: 'A01' }],
            actions,
          },
        });
      writes++;
      const body = route.request().postDataJSON();
      expect(body.productId).toBe('product-1');
      expect(body.slotId).toBe('slot-1');
      expect(body.qrCode).toBe('FLOWER-001');
      if (writes === 1) {
        payload = body;
        actions.push({ id: body.id, qrCode: body.qrCode, createdAt: '2026-10-08T10:00:00Z' });
        return route.abort();
      }
      expect(body).toEqual(payload);
      return route.fulfill({ json: { id: body.id, bouquetId: 'bouquet-1' } });
    });
    await page.goto('/staff');
    await page.getByText('Nạp hoa và xem kết quả', { exact: true }).click();
    await page.getByRole('button', { name: 'Ghi nhận đã nạp hoa' }).click();
    await expect(page.getByText('Chọn mẫu hoa.', { exact: true })).toBeVisible();
    expect(writes).toBe(0);
    await page.getByLabel('Mẫu hoa cần nạp').selectOption('product-1');
    await page.getByLabel('Ô tủ trống').selectOption('slot-1');
    await page.getByLabel('Mã QR trên bó hoa').fill('FLOWER-001');
    await page.getByRole('button', { name: 'Ghi nhận đã nạp hoa' }).click();
    await expect(page.getByText('Xác nhận đã đặt hoa đúng ô.', { exact: true })).toBeVisible();
    expect(writes).toBe(0);
    await page.getByRole('checkbox', { name: 'Tôi đã đặt đúng bó hoa vào ô đã chọn.' }).check();
    expect(
      (
        await new AxeBuilder({ page })
          .include('#staff-tasks')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.getByRole('button', { name: 'Ghi nhận đã nạp hoa' }).click();
    await expect(page.getByRole('button', { name: 'Kiểm tra kết quả nạp' })).toBeVisible();
    await page.reload();
    await page.getByText('Nạp hoa và xem kết quả', { exact: true }).click();
    await page.getByRole('button', { name: 'Kiểm tra kết quả nạp' }).click();
    await expect(page.getByText('Đã ghi nhận bó hoa vào ô tủ.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ghi nhận đã nạp hoa' })).toHaveCount(0);
    expect(writes).toBe(2);
  });

import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1440]) {
  test(`Technician task report validation and uncertain response recovery ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: { id: 'tech-id', name: 'Kỹ thuật viên Hoa', role: 'TECHNICIAN', sellerId: null },
      }),
    );
    let version = 1;
    let status = 'ASSIGNED';
    let writes = 0;
    await page.route('**/api/staff/tasks?*', (route) =>
      route.fulfill({
        json: {
          page: 1,
          hasMore: false,
          items: [
            {
              id: 'task-1',
              kind: 'INCIDENT',
              status,
              version,
              assigneeName: 'Kỹ thuật viên Hoa',
              kioskName: 'Tủ FPT',
              address: 'Thủ Đức',
              shopName: null,
              instructions: 'Kiểm tra cửa bị kẹt tại tủ',
              report: null,
            },
          ],
        },
      }),
    );
    await page.route('**/api/staff/tasks/task-1/transition', async (route) => {
      writes++;
      expect(route.request().postDataJSON().version).toBe(version);
      version++;
      status = writes === 1 ? 'IN_PROGRESS' : 'SUBMITTED';
      if (writes === 1) return route.abort();
      return route.fulfill({ json: { id: 'task-1', version } });
    });
    await page.goto('/technician');
    await page.getByRole('button', { name: 'Xác nhận cập nhật' }).click();
    await expect(page.getByText('Mô tả ít nhất 10 ký tự.')).toBeVisible();
    expect(writes).toBe(0);
    await page.getByLabel('Nội dung cập nhật').fill('Bắt đầu kiểm tra cửa tại tủ');
    expect(
      (
        await new AxeBuilder({ page })
          .include('#staff-tasks')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.getByRole('button', { name: 'Xác nhận cập nhật' }).click();
    await expect(page.getByText(/Chưa xác nhận được trạng thái mới/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xác nhận cập nhật' })).toBeDisabled();
    expect(writes).toBe(1);
    await page.getByRole('button', { name: 'Tải lại công việc' }).click();
    await expect(page.getByLabel('Bước tiếp theo')).toHaveValue('SUBMITTED');
    await page.getByLabel('Nội dung cập nhật').fill('Đã kiểm tra xong, gửi quản trị viên duyệt');
    await page.getByRole('button', { name: 'Xác nhận cập nhật' }).click();
    await expect(page.getByRole('button', { name: 'Xác nhận cập nhật' })).toHaveCount(0);
    expect(writes).toBe(2);
  });

  test(`Seller staff task report validation and delivery workflow ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: { id: 'staff-id', name: 'Nhân viên Shop', role: 'SELLER_STAFF', sellerId: 'shop-1' },
      }),
    );
    let version = 1;
    let status = 'ASSIGNED';
    let writes = 0;
    await page.route('**/api/staff/tasks?*', (route) =>
      route.fulfill({
        json: {
          page: 1,
          hasMore: false,
          items: [
            {
              id: 'task-delivery-1',
              kind: 'DELIVERY',
              status,
              version,
              assigneeName: 'Nhân viên Shop',
              kioskName: 'Tủ FPT',
              address: 'Thủ Đức',
              shopName: 'Tiệm Hoa',
              instructions: 'Giao hoa đến ô tủ và nạp đúng mã',
              report: null,
            },
          ],
        },
      }),
    );
    await page.route('**/api/staff/tasks/task-delivery-1/transition', async (route) => {
      writes++;
      expect(route.request().postDataJSON().version).toBe(version);
      version++;
      status = writes === 1 ? 'IN_PROGRESS' : 'SUBMITTED';
      if (writes === 1) return route.abort();
      return route.fulfill({ json: { id: 'task-delivery-1', version } });
    });
    await page.goto('/staff');
    await expect(page.getByRole('heading', { name: 'Giao hoa · Tủ FPT' })).toBeVisible();
    await page.getByRole('button', { name: 'Xác nhận cập nhật' }).click();
    await expect(page.getByText('Mô tả ít nhất 10 ký tự.')).toBeVisible();
    expect(writes).toBe(0);
    await page.getByLabel('Nội dung cập nhật').fill('Bắt đầu giao hoa đến tủ');
    await page.getByRole('button', { name: 'Xác nhận cập nhật' }).click();
    await expect(page.getByText(/Chưa xác nhận được trạng thái mới/)).toBeVisible();
    expect(writes).toBe(1);
    await page.getByRole('button', { name: 'Tải lại công việc' }).click();
    await expect(page.getByLabel('Bước tiếp theo')).toHaveValue('SUBMITTED');
    await page.getByLabel('Nội dung cập nhật').fill('Đã nạp hoa và kiểm tra đầy đủ');
    await page.getByRole('button', { name: 'Xác nhận cập nhật' }).click();
    await expect(page.getByRole('button', { name: 'Xác nhận cập nhật' })).toHaveCount(0);
    expect(writes).toBe(2);
  });
}

import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1440])
  test(`Operations Manager validates handoff and recovers lost response ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: { id: 'manager', name: 'Nguyễn Quản Lý', role: 'OPERATIONS_MANAGER', sellerId: null },
      }),
    );
    await page.route('**/api/operations/staff', (route) =>
      route.fulfill({
        json: [
          { id: 'old', name: 'Hoa' },
          { id: 'new', name: 'Linh' },
        ],
      }),
    );
    let version = 1;
    let assigneeId = 'old';
    let writes = 0;
    await page.route('**/api/operations/staff-tasks?*', (route) =>
      route.fulfill({
        json: {
          page: 1,
          hasMore: false,
          items: [
            {
              id: 'handoff',
              kind: 'INCIDENT',
              version,
              status: 'ASSIGNED',
              assigneeId,
              assigneeName: assigneeId === 'old' ? 'Hoa' : 'Linh',
              kioskName: 'Tủ FPT',
              address: 'Thủ Đức',
              shopName: null,
              instructions: 'Kiểm tra lỗi kẹt cửa tủ',
              report: null,
            },
          ],
        },
      }),
    );
    await page.route('**/api/operations/staff-tasks/handoff/reassign', (route) => {
      writes++;
      expect(route.request().postDataJSON()).toEqual({
        version: 1,
        assigneeId: 'new',
        reason: 'Bàn giao ca chiều cho nhân viên Linh',
      });
      version = 2;
      assigneeId = 'new';
      return route.abort();
    });
    await page.goto('/operations/tasks');
    let panel = page.locator('.staff-reassignment');
    await panel.locator('summary').click();
    await panel.getByRole('button', { name: 'Xác nhận bàn giao' }).click();
    await expect(panel.getByLabel('Người nhận bàn giao')).toBeFocused();
    await expect(panel.getByText('Chọn người nhận bàn giao.', { exact: true })).toBeVisible();
    expect(writes).toBe(0);
    await expect(panel.locator('option[value="old"]')).toHaveCount(0);
    await panel.getByLabel('Người nhận bàn giao').selectOption('new');
    await panel
      .getByLabel('Lý do và thông tin bàn giao')
      .fill('Bàn giao ca chiều cho nhân viên Linh');
    await panel.getByRole('button', { name: 'Xác nhận bàn giao' }).click();
    await expect(
      panel.getByText('Xác nhận thay đổi người phụ trách.', { exact: true }),
    ).toBeVisible();
    await panel.getByRole('checkbox').check();
    expect(
      (
        await new AxeBuilder({ page })
          .include('.staff-reassignment')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await panel.getByRole('button', { name: 'Xác nhận bàn giao' }).click();
    await expect(panel.getByRole('alert')).toContainText('Chưa xác nhận được người phụ trách mới');
    await expect(panel.getByRole('button', { name: 'Xác nhận bàn giao' })).toBeDisabled();
    expect(writes).toBe(1);
    await page.getByRole('button', { name: 'Tải lại công việc', exact: true }).click();
    panel = page.locator('.staff-reassignment');
    await panel.locator('summary').click();
    await expect(panel.getByText(/Hiện phụ trách: Linh/)).toBeVisible();
    await expect(panel.locator('option[value="new"]')).toHaveCount(0);
    expect(writes).toBe(1);
    await page.screenshot({ path: `artifacts/staff-handoff-${width}.png`, fullPage: true });
  });

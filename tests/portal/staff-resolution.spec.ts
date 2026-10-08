import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1440])
  test(`Assigned incident repair validation and recovery ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ json: { id: 'actor', name: 'Thảo', role: 'STAFF' } }),
    );
    let completed = false;
    let attempt: unknown;
    let calls = 0;
    await page.route('**/api/staff/tasks?*', (route) =>
      route.fulfill({
        json: {
          page: 1,
          hasMore: false,
          items: [
            {
              id: 'task',
              kind: 'INCIDENT',
              status: completed ? 'SUBMITTED' : 'IN_PROGRESS',
              version: completed ? 3 : 2,
              assigneeName: 'Thảo',
              kioskName: 'Tủ FPT',
              address: 'Thủ Đức',
              instructions: 'Kiểm tra cửa tủ theo phân công',
            },
          ],
        },
      }),
    );
    await page.route('**/api/staff/tasks/task/resolve-incident', (route) => {
      calls++;
      if (calls === 1) {
        attempt = route.request().postDataJSON();
        return route.abort('failed');
      }
      expect(route.request().postDataJSON()).toEqual(attempt);
      completed = true;
      return route.fulfill({ json: { id: 'operation', version: 3 } });
    });
    await page.goto('/staff');
    const panel = page.locator('.staff-resolution');
    await panel.locator('summary').click();
    await panel.getByRole('button', { name: 'Đóng sự cố và gửi báo cáo' }).click();
    await expect(panel.getByText('Mô tả ít nhất 10 ký tự.')).toBeVisible();
    await expect(panel.getByText('Xác nhận đã kiểm tra thực tế tại tủ.')).toBeVisible();
    expect(calls).toBe(0);
    await panel
      .getByLabel('Kết quả sửa chữa và kiểm tra')
      .fill('Đã thay chốt cửa và kiểm tra hoạt động tại tủ.');
    await panel.getByRole('checkbox').check();
    expect(
      (
        await new AxeBuilder({ page })
          .include('.staff-resolution')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({ path: `artifacts/staff-resolution-${width}.png`, fullPage: true });
    await panel.getByRole('button', { name: 'Đóng sự cố và gửi báo cáo' }).click();
    await expect(panel.getByRole('alert')).toContainText('Chưa xác nhận được kết quả');
    await page.reload();
    await panel.locator('summary').click();
    await panel.getByRole('button', { name: 'Kiểm tra kết quả xử lý' }).click();
    await expect(panel).toHaveCount(0);
    await expect(
      page.locator('article').getByText('Chờ duyệt báo cáo', { exact: true }),
    ).toBeVisible();
    expect(calls).toBe(2);
    expect(
      await page.evaluate(() => sessionStorage.getItem('florabot-staff-resolution:actor:task')),
    ).toBeNull();
  });

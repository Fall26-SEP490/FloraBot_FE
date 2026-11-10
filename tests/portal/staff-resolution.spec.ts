import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1440])
  test(`Technician incident repair validation and recovery ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ json: { id: 'actor', name: 'Thảo', role: 'TECHNICIAN' } }),
    );
    let completed = false;
    let attempt: unknown;
    let calls = 0;
    let codeRequests = 0;
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
    await page.route('**/api/staff/tasks/task?*', (route) =>
      route.fulfill({
        json: {
          kioskStatus: 'ONLINE',
          incident: null,
          slotCode: 'S01',
          slotStatus: 'FAULT',
          history: [],
        },
      }),
    );
    await page.route('**/api/staff/tasks/task/repair-access', (route) => {
      expect(route.request().method()).toBe('POST');
      expect(route.request().postData()).toBeNull();
      codeRequests++;
      if (codeRequests === 1) return route.fulfill({ status: 404 });
      return route.fulfill({
        json: {
          id: 'challenge',
          code: '013582',
          expiresAt: new Date(Date.now() + 120_000).toISOString(),
        },
      });
    });
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
    await page.goto('/technician');
    await page.locator('.technician-task-body > summary').click();
    const access = page.getByRole('region', { name: 'Mã xác nhận sửa ô tủ' });
    await expect(page.getByRole('button', { name: 'Gửi báo cáo', exact: true })).toHaveCount(0);
    const codeButton = access.getByRole('button', { name: 'Lấy mã sửa ô tủ' });
    await codeButton.click();
    await expect(access.getByRole('alert')).toContainText('Kiểm tra chủ shop đã duyệt');
    await codeButton.click();
    await expect(access.getByRole('status')).toContainText('013582');
    expect(
      await page.evaluate(() => {
        return [...Object.values(localStorage), ...Object.values(sessionStorage)]
          .join(' ')
          .includes('013582');
      }),
    ).toBe(false);
    const panel = page.locator('details.staff-resolution');
    await panel.locator('summary').click();
    await panel.getByRole('button', { name: 'Gửi báo cáo sửa ô tủ' }).click();
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
    await panel.getByRole('button', { name: 'Gửi báo cáo sửa ô tủ' }).click();
    await expect(panel.getByRole('alert')).toContainText('Chưa xác nhận được kết quả');
    await page.reload();
    await page.locator('.technician-task-body > summary').click();
    await expect(codeButton).toBeVisible();
    await expect(access.getByText('013582')).toHaveCount(0);
    await panel.locator('summary').click();
    await panel.getByRole('button', { name: 'Kiểm tra kết quả xử lý' }).click();
    await expect(panel).toHaveCount(0);
    await expect(
      page.locator('article').getByText('Chờ duyệt báo cáo', { exact: true }),
    ).toBeVisible();
    expect(calls).toBe(2);
    expect(
      await page.evaluate(() =>
        Object.keys(sessionStorage).filter((k) => k.startsWith('florabot-staff-resolution:')),
      ),
    ).toEqual([]);

    // Verify wrong-kind action absent: seller staff never renders technical incident resolution
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: { id: 'seller-staff-1', name: 'Nhân viên', role: 'SELLER_STAFF', sellerId: 'shop-1' },
      }),
    );
    await page.goto('/staff');
    await expect(page.getByText('Ghi nhận đã sửa sự cố')).toHaveCount(0);
  });

import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const admin of [false, true])
  test(`Task context, read recovery and paged history for ${admin ? 'admin' : 'staff'}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: admin ? 1440 : 390, height: 1000 });
    const prefix = admin ? '/api/admin/staff-tasks' : '/api/staff/tasks';
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ json: { id: 'actor', name: 'Thảo', role: admin ? 'ADMIN' : 'STAFF' } }),
    );
    await page.route(`**${prefix}?*`, (route) =>
      route.fulfill({
        json: {
          page: 1,
          hasMore: false,
          items: [
            {
              id: 'task',
              kind: 'INCIDENT',
              status: 'COMPLETED',
              version: 4,
              assigneeName: 'Thảo',
              kioskName: 'Tủ FPT',
              address: 'Thủ Đức',
              instructions: 'Kiểm tra cửa tủ theo phân công',
              report: 'Đã gửi báo cáo kiểm tra cửa',
            },
          ],
        },
      }),
    );
    let fail = true;
    let reads = 0;
    await page.route(`**${prefix}/task?*`, (route) => {
      reads++;
      if (fail) {
        fail = false;
        return route.fulfill({ status: 503 });
      }
      const number = Number(new URL(route.request().url()).searchParams.get('page'));
      return route.fulfill({
        json: {
          kioskStatus: 'MAINTENANCE',
          lastHeartbeatAt: null,
          slotCode: 'A01',
          slotStatus: 'FAULT',
          incident: {
            kind: 'DEVICE_FAULT',
            status: 'OPEN',
            reason: 'Cửa không đóng sau khi nhận hoa',
            decision: null,
            createdAt: '2026-10-08T08:00:00Z',
          },
          history:
            number === 1
              ? [
                  {
                    id: '10',
                    actorName: 'Quản trị viên',
                    action: 'STAFF_TASK_UPDATED',
                    fromStatus: 'SUBMITTED',
                    toStatus: 'COMPLETED',
                    report: 'Đã kiểm tra báo cáo của nhân viên',
                    createdAt: '2026-10-08T09:00:00Z',
                  },
                ]
              : [],
          page: number,
          hasMore: number === 1,
        },
      });
    });
    await page.goto(admin ? '/admin/tasks' : '/staff');
    const panel = page.locator('.staff-task-details');
    await expect(panel.locator('summary')).toBeVisible();
    expect(reads).toBe(0);
    await panel.locator('summary').click();
    await expect(panel.getByRole('alert')).toContainText('Chưa tải được chi tiết');
    await panel.getByRole('button', { name: 'Thử tải lại chi tiết' }).click();
    await expect(panel.getByText('Cửa không đóng sau khi nhận hoa')).toBeVisible();
    await expect(panel.getByText('Chưa có tín hiệu được ghi nhận')).toBeVisible();
    await expect(panel.getByText('Đã kiểm tra báo cáo của nhân viên')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Lịch sử trước' })).toBeDisabled();
    expect(
      (
        await new AxeBuilder({ page })
          .include('.staff-task-details')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await panel.getByRole('button', { name: 'Lịch sử tiếp' }).click();
    await expect(panel.getByText('Chưa có lịch sử ở trang này.')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Lịch sử tiếp' })).toBeDisabled();
    await panel.getByRole('button', { name: 'Lịch sử trước' }).click();
    await expect(panel.getByText('Đã kiểm tra báo cáo của nhân viên')).toBeVisible();
    await page.screenshot({
      path: `artifacts/staff-detail-${admin ? 'admin' : 'staff'}.png`,
      fullPage: true,
    });
  });

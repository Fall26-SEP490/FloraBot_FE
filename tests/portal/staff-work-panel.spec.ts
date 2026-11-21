import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1440]) {
  for (const status of ['ASSIGNED', 'IN_PROGRESS', 'SUBMITTED', 'COMPLETED']) {
    test(`staff work panel ${status} at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 960 });
      const task = {
        id: 'task-ui',
        kind: 'DELIVERY',
        workType: status === 'COMPLETED' ? 'FLOWER_QUALITY' : null,
        status,
        version: 1,
        kioskName: 'Kiosk HCM 12',
        address: '12 Nguyễn Huệ, TP.HCM',
        instructions: 'Kiểm tra và giao đúng mẫu hoa đã chọn.',
        report:
          status === 'SUBMITTED' || status === 'COMPLETED' ? 'Đã giao hoa và kiểm tra ô tủ.' : null,
      };
      await page.route('**/hub/**', (route) => route.abort());
      await page.route('**/api/**', (route) => {
        const url = new URL(route.request().url());
        const path = url.pathname;
        if (path === '/api/auth/me')
          return route.fulfill({
            json: {
              id: 'staff-ui',
              name: 'Nhân viên Hoa',
              role: 'SELLER_STAFF',
              sellerId: 'shop-ui',
            },
          });
        if (path === '/api/staff/tasks')
          return route.fulfill({
            json: {
              items: url.searchParams.get('status') === status ? [task] : [],
              page: 1,
              hasMore: false,
            },
          });
        if (path.endsWith('/inventory-maintenance')) return route.fulfill({ status: 404 });
        if (path.endsWith('/stock'))
          return route.fulfill({
            json: {
              slots: [{ id: 'slot-ui', code: 'S01', zone: 'WALK_IN' }],
              products: [{ id: 'product-ui', name: 'Bó hoa hồng' }],
              actions: [],
            },
          });
        if (path.endsWith('/preorders'))
          return route.fulfill({ json: { preorders: [], slots: [] } });
        if (path.endsWith('/quality'))
          return route.fulfill({
            json: {
              id: 'quality-ui',
              status: 'RESOLVED',
              handlingState: 'RESOLVED',
              reason: 'Hoa chưa đúng mẫu đã đặt.',
              resolution: 'Đã đổi hoa cho khách.',
              outcome: 'REPLACEMENT',
              items: [{ orderItemId: 'item-1', name: 'Bó hoa hồng', slotCode: 'S03' }],
              task: { instructions: task.instructions, report: task.report },
              replacement: null,
              evidence: { items: [], page: 1, hasMore: false },
            },
          });
        if (path === '/api/staff/tasks/task-ui/evidence')
          return route.fulfill({
            json: {
              items: [{ id: 'photo-ui', createdAt: '2026-11-21T08:00:00Z' }],
              page: 1,
              hasMore: false,
            },
          });
        if (path.endsWith('/evidence/photo-ui'))
          return route.fulfill({
            contentType: 'image/png',
            body: Buffer.from(
              'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
              'base64',
            ),
          });
        if (path === '/api/staff/tasks/task-ui')
          return route.fulfill({
            json: {
              status,
              kioskStatus: 'OFFLINE',
              lastHeartbeatAt: '2026-11-21T08:00:00Z',
              incident: null,
              slotCode: null,
              slotStatus: null,
              slotObservation: null,
              kioskSlots: [],
              history: [
                {
                  id: 'event-ui',
                  action: 'UPDATE',
                  fromStatus: 'ASSIGNED',
                  toStatus: status,
                  actorName: 'Nhân viên Hoa',
                  report: 'Đã kiểm tra tại kiosk.',
                  createdAt: '2026-11-21T08:00:00Z',
                },
              ],
              page: 1,
              hasMore: false,
            },
          });
        return route.fulfill({ json: [] });
      });
      await page.goto('/staff');
      if (status === 'COMPLETED')
        await page.getByText('Lịch sử công việc', { exact: true }).click();
      await page.locator('.staff-task-open').click();
      const panel = page.getByRole('dialog', { name: /Kiosk HCM 12/ });
      await expect(panel).toBeVisible();
      await expect(panel).toContainText(task.address);
      if (status === 'ASSIGNED')
        await expect(panel.getByRole('button', { name: 'Bắt đầu', exact: true })).toBeVisible();
      if (status === 'COMPLETED') {
        await expect(panel).toContainText('Đã đổi hoa cho khách.');
        await expect(panel).not.toContainText('Việc được giao:');
      }
      await panel.getByText('Ảnh minh chứng công việc', { exact: true }).click();
      const photo = panel.getByRole('button', { name: 'Xem lớn ảnh minh chứng 1' });
      await expect(photo).toBeVisible();
      const before = await photo.boundingBox();
      await panel.getByText('Thông tin tủ và lịch sử', { exact: true }).click();
      await expect(panel.getByText('Mất kết nối', { exact: true })).toBeVisible();
      const after = await photo.boundingBox();
      expect(after!.height).toBe(before!.height);
      expect(after!.width).toBe(before!.width);
      if (status === 'IN_PROGRESS') {
        await panel.getByText('Nạp hoa bán tại tủ', { exact: true }).click();
        await panel.getByText('Nạp hoa cho đơn đặt trước', { exact: true }).click();
        await panel.getByText('Viết báo cáo', { exact: true }).click();
        await expect(panel.getByLabel('Kết quả công việc')).toBeVisible();
      }
      expect(
        (await new AxeBuilder({ page }).include('.staff-work-panel').analyze()).violations,
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await photo.click();
      const viewer = page.getByRole('dialog', { name: 'Ảnh minh chứng công việc', exact: true });
      await expect(viewer).toBeVisible();
      await viewer.getByRole('button', { name: 'Đóng hộp thoại' }).click();
      await expect(panel).toBeVisible();
      await panel.getByRole('button', { name: 'Đóng hộp thoại' }).click();
      await expect(panel).toBeHidden();
    });
  }
}

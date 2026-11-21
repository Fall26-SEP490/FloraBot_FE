import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const admin of [false, true])
  test(`Private task evidence ${admin ? 'review' : 'recovery'}`, async ({ page }) => {
    await page.setViewportSize({ width: admin ? 1440 : 390, height: 1000 });
    const prefix = admin ? '/api/admin/staff-tasks' : '/api/staff/tasks';
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: {
          id: 'actor',
          name: 'Thảo',
          role: admin ? 'ADMIN' : 'SELLER_STAFF',
          sellerId: 'shop-1',
        },
      }),
    );
    await page.route(`**${prefix}?*`, (route) =>
      route.fulfill({
        json: {
          page: 1,
          hasMore: false,
          items: [
            {
              id: 'task',
              kind: admin ? 'INCIDENT' : 'DELIVERY',
              status: admin ? 'SUBMITTED' : 'IN_PROGRESS',
              version: 2,
              assigneeName: 'Thảo',
              kioskName: 'Tủ FPT',
              address: 'Thủ Đức',
              instructions: 'Kiểm tra cửa tủ theo phân công',
            },
          ],
        },
      }),
    );
    let savedId = '';
    let posts = 0;
    let reads = 0;
    let fail = true;
    let showMultiplePages = false;
    await page.route(`**${prefix}/task/evidence?*`, (route) => {
      reads++;
      if (fail) {
        fail = false;
        return route.fulfill({ status: 503 });
      }
      const params = new URL(route.request().url()).searchParams;
      return route.fulfill({
        json: {
          items:
            params.get('page') === '2'
              ? []
              : [{ id: savedId || 'old-photo', createdAt: '2026-10-09T08:00:00Z' }],
          page: Number(params.get('page') || 1),
          hasMore: showMultiplePages && params.get('page') === '1',
        },
      });
    });
    await page.route(`**${prefix}/task/evidence/upload`, (route) =>
      route.fulfill({
        json: { reference: 'evidence:v1:fixture', expiresAt: '2026-10-09T09:00:00Z' },
      }),
    );
    await page.route(`**${prefix}/task/evidence`, (route) => {
      posts++;
      savedId = route.request().postDataJSON().id;
      return route.abort('failed');
    });
    await page.goto(admin ? '/admin/tasks' : '/staff');
    if (admin) await page.getByRole('button', { name: /^Xem công việc / }).click();
    if (!admin) await page.locator('.staff-task-open').click();
    const panel = page.locator('.staff-evidence');
    await expect(panel.locator('summary')).toBeVisible();
    expect(reads).toBe(0);
    await panel.locator('summary').click();
    await expect(panel.getByRole('alert')).toContainText('Chưa tải được ảnh');
    await panel.getByRole('button', { name: 'Thử tải lại ảnh' }).click();
    if (admin) {
      await expect(panel.getByRole('link', { name: 'Xem ảnh 1 (mở tab mới)' })).toHaveAttribute(
        'href',
        `${prefix}/task/evidence/old-photo`,
      );
    } else {
      await expect(panel.getByRole('button', { name: 'Xem lớn ảnh minh chứng 1' })).toBeVisible();
    }
    await expect(panel.getByRole('button', { name: 'Ảnh trang trước' })).toHaveCount(0);
    await expect(panel.getByRole('button', { name: 'Ảnh trang tiếp' })).toHaveCount(0);
    showMultiplePages = true;
    await expect(panel.getByRole('button', { name: 'Tải lại ảnh', exact: true })).toHaveCount(0);
    await page.reload();
    if (admin) await page.getByRole('button', { name: /^Xem công việc / }).click();
    else await page.locator('.staff-task-open').click();
    await panel.locator('summary').click();
    await panel.getByRole('button', { name: 'Ảnh trang tiếp' }).click();
    await expect(panel.getByText('Chưa có ảnh minh chứng ở trang này.')).toBeVisible();
    await panel.getByRole('button', { name: 'Ảnh trang trước' }).click();
    if (admin) {
      await expect(panel.locator('input[type=file]')).toHaveCount(0);
    } else {
      await expect(panel.locator('.evidence-upload [role="status"]')).toHaveCount(0);
      await expect(panel.locator('.evidence-upload .error')).toHaveCount(0);
      await expect(panel.getByRole('button', { name: 'Gắn ảnh vào công việc' })).toBeDisabled();
      await panel
        .getByLabel('Ảnh minh chứng', { exact: true })
        .setInputFiles({ name: 'door.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
      await expect(
        panel.getByRole('button', { name: 'Tải ảnh minh chứng', exact: true }),
      ).toHaveCount(0);
      await expect(panel.getByRole('button', { name: 'Phóng to ảnh minh chứng' })).toBeVisible();
      await panel.getByRole('button', { name: 'Phóng to ảnh minh chứng' }).click();
      const preview = page.getByRole('dialog', { name: 'Ảnh minh chứng', exact: true });
      await expect(preview).toBeVisible();
      await preview.getByRole('button', { name: 'Đóng ảnh', exact: true }).click();
      await expect(panel.getByRole('button', { name: 'Gắn ảnh vào công việc' })).toBeEnabled();
      await panel.getByRole('button', { name: 'Gắn ảnh vào công việc' }).click();
      await expect(panel.getByRole('alert')).toContainText('Chưa xác nhận được ảnh');
      await page.reload();
      await page.locator('.staff-task-open').click();
      await panel.locator('summary').click();
      await panel.getByRole('button', { name: 'Kiểm tra kết quả gửi ảnh' }).click();
      await expect(panel.getByText('Đã gắn ảnh vào công việc.')).toBeVisible();
      expect(posts).toBe(1);
      expect(
        await page.evaluate(() =>
          Object.keys(sessionStorage).filter((k) => k.startsWith('florabot-staff-evidence:')),
        ),
      ).toEqual([]);
      await page.route(`**${prefix}/task/evidence`, (route) =>
        route.fulfill({ status: 400, json: { detail: 'Ảnh đã hết hạn.' } }),
      );
      await panel.getByLabel('Ảnh minh chứng', { exact: true }).setInputFiles({
        name: 'another.png',
        mimeType: 'image/png',
        buffer: Buffer.from('fixture'),
      });
      await expect(panel.getByRole('button', { name: 'Gắn ảnh vào công việc' })).toBeEnabled();
      await panel.getByRole('button', { name: 'Gắn ảnh vào công việc' }).click();
      await expect(panel.getByRole('alert')).toContainText('Ảnh đã hết hạn.');
      await expect(panel.getByRole('button', { name: 'Gắn ảnh vào công việc' })).toBeDisabled();
      expect(
        await page.evaluate(() =>
          Object.keys(sessionStorage).filter((k) => k.startsWith('florabot-staff-evidence:')),
        ),
      ).toEqual([]);
    }
    expect(
      (
        await new AxeBuilder({ page })
          .include('.staff-evidence')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: `artifacts/staff-evidence-${admin ? 'admin' : 'staff'}.png`,
      fullPage: true,
    });
  });

import { expect, test } from '@playwright/test';
import { setupSellerUsability, shopId } from '../fixtures/seller-usability';

const workspaces = [
  { role: 'ADMIN', path: '/admin/managers', compact: true },
  { role: 'OPERATIONS_MANAGER', path: '/operations/technicians', compact: true },
  { role: 'TECHNICIAN', path: '/technician', compact: true },
  { role: 'SELLER', path: '/seller/orders', compact: true },
  { role: 'SELLER_STAFF', path: '/staff', compact: true },
] as const;

for (const { role, path, compact } of workspaces) {
  test(`${role} uses its workspace canvas without stretching navigation or forms`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const model = await setupSellerUsability(page);
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: {
          id: `responsive-${role}`,
          role,
          name: 'Tài khoản kiểm thử bố cục',
          sellerId: role === 'SELLER' || role === 'SELLER_STAFF' ? shopId : null,
          sellerStatus: role === 'SELLER' ? 'ACTIVE' : null,
          packageExpiresAt: '2099-01-01',
        },
      }),
    );
    for (const endpoint of ['/api/admin/managers', '/api/operations/technicians']) {
      await page.route(`**${endpoint}`, (route) =>
        route.fulfill({
          json: [
            {
              id: 'directory-person',
              fullName: 'Người phụ trách kiểm thử',
              email: 'responsive@example.test',
              phone: null,
              role: role === 'ADMIN' ? 'OPERATIONS_MANAGER' : 'TECHNICIAN',
              status: 'ACTIVE',
              createdAt: '2026-11-01T00:00:00Z',
            },
          ],
        }),
      );
    }
    await page.route('**/api/staff/tasks?*', (route) => {
      const status = new URL(route.request().url()).searchParams.get('status');
      return route.fulfill({
        json: {
          items:
            status && status !== 'ASSIGNED'
              ? []
              : [
                  {
                    id: 'responsive-task',
                    kind: role === 'TECHNICIAN' ? 'INCIDENT' : 'DELIVERY',
                    status: 'ASSIGNED',
                    version: 1,
                    kioskName: 'Kiosk kiểm thử',
                    address: 'Thủ Đức',
                    instructions: 'Kiểm tra công việc được giao tại kiosk.',
                    assigneeName: 'Người phụ trách kiểm thử',
                    report: null,
                  },
                ],
          page: 1,
          hasMore: false,
        },
      });
    });

    await page.setViewportSize({ width: 1366, height: 1000 });
    await page.goto(path);
    const main = page.locator('#main');
    const sidebar = page.locator('.workspace-sidebar');
    await expect(main.getByRole('heading', { level: 1 }).first()).toBeVisible();

    for (const width of [1366, 1920, 2560, 375]) {
      await page.setViewportSize({ width, height: 1000 });
      await page.mouse.move(width - 1, 0);
      if (width > 900 && compact) {
        await expect
          .poll(() => sidebar.evaluate((el) => el.getBoundingClientRect().width))
          .toBeLessThan(90);
      }
      await expect
        .poll(() =>
          main.evaluate((el) => {
            const shell = el.closest('.dashboard-shell')!;
            const shellBox = shell.getBoundingClientRect();
            const tracks = getComputedStyle(shell).gridTemplateColumns.split(' ');
            const navWidth = innerWidth > 900 && tracks.length > 1 ? parseFloat(tracks[0]) : 0;
            const available = shellBox.width - navWidth;
            const box = el.getBoundingClientRect();
            const expectedX = shellBox.x + navWidth + Math.max(0, available - 2080) / 2;
            return Math.max(
              Math.abs(box.width - Math.min(2080, available)),
              Math.abs(box.x - expectedX),
            );
          }),
        )
        .toBeLessThan(1);
      const box = (await main.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );

      if (width === 1920 && compact) {
        await sidebar.hover();
        await expect
          .poll(() => sidebar.evaluate((el) => el.getBoundingClientRect().width))
          .toBeGreaterThan(240);
        const expandedBox = (await main.boundingBox())!;
        expect(Math.abs(expandedBox.width - box.width)).toBeLessThan(1);
        expect(Math.abs(expandedBox.x - box.x)).toBeLessThan(1);
        await page.mouse.move(width - 1, 0);
      }
      if (width === 2560 && (role === 'ADMIN' || role === 'OPERATIONS_MANAGER')) {
        await main
          .getByRole('button', { name: /^Thêm / })
          .first()
          .click();
        const dialog = page.getByRole('dialog');
        await expect(dialog).toBeVisible();
        expect((await dialog.boundingBox())!.width).toBeLessThan(900);
        await page.keyboard.press('Escape');
        await expect(dialog).toHaveCount(0);
      }
      if (width === 1920 || width === 375) {
        await page.screenshot({
          path: testInfo.outputPath(`${role}-${width}.png`),
          fullPage: true,
        });
      }
    }
    expect(model.writes).toEqual([]);
  });
}

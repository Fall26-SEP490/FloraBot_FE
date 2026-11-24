import { expect, test } from '@playwright/test';

test.use({ reducedMotion: 'reduce' });

for (const [action, label] of [
  ['LOAD', 'Nạp hoa'],
  ['REMOVE', 'Thu hồi hoa'],
  ['REPLACE', 'Thay hoa'],
] as const) {
  for (const status of ['ASSIGNED', 'IN_PROGRESS']) {
    test(`${label}: correct task title and scoped slot controls, ${status}`, async ({ page }) => {
      await page.setViewportSize({ width: status === 'ASSIGNED' ? 1440 : 390, height: 900 });
      let stage: string | null = null;
      let opens = 0;
      await page.route('**/hub/**', (route) => route.abort());
      await page.route('**/api/**', (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/auth/me')
          return route.fulfill({
            json: { id: 'staff', role: 'SELLER_STAFF', sellerId: 'shop', name: 'Nhân viên' },
          });
        if (url.pathname === '/api/staff/tasks')
          return route.fulfill({
            json: {
              items:
                url.searchParams.get('status') === status
                  ? [
                      {
                        id: 'slot-task',
                        kind: 'DELIVERY',
                        status,
                        version: 1,
                        kioskName: 'Kiosk HCM 12',
                        address: 'FPT Hòa Lạc',
                        instructions: 'Thao tác đúng ô tủ được giao.',
                      },
                    ]
                  : [],
              page: 1,
              hasMore: false,
            },
          });
        if (url.pathname.endsWith('/inventory-maintenance'))
          return route.fulfill({
            json: { action, status, slotCode: 'S01', sessionStage: stage, sessionSubstate: null },
          });
        if (url.pathname.endsWith('/inventory-maintenance/open')) {
          expect(route.request().postDataJSON()).toEqual({ operation: 'START', reason: null });
          opens++;
          stage = action === 'LOAD' ? 'AwaitLoading' : 'AwaitRemoval';
          return route.fulfill({ json: { id: 'slot-task', stage } });
        }
        return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
      });
      await page.goto('/staff');
      const card = page.getByRole('article', { name: `${label} · Kiosk HCM 12` });
      await expect(card).toBeVisible();
      await card
        .getByRole('button', { name: status === 'ASSIGNED' ? 'Mở công việc' : 'Tiếp tục xử lý' })
        .click();
      const panel = page.getByRole('dialog', { name: `${label} · Kiosk HCM 12` });
      await expect(panel).toBeVisible();
      await expect(panel.getByRole('heading', { name: /Giao hoa/ })).toHaveCount(0);
      if (status === 'IN_PROGRESS') {
        const operation = panel.getByRole('region', { name: 'Thao tác ô tủ có cảm biến' });
        await expect(operation.getByRole('heading', { name: `${label} · Ô S01` })).toBeVisible();
        if (action === 'REMOVE') await expect(operation).toContainText('lấy hoa về shop');
        const button = operation.getByRole('button', { name: 'Mở ô S01', exact: true });
        await button.click();
        await expect(operation).toContainText('Đã gửi yêu cầu mở ô. Chờ tủ phản hồi.');
        await expect(operation).not.toContainText('Tủ đã xác nhận thao tác hoàn tất.');
        await expect(button).toHaveCount(0);
        expect(opens).toBe(1);
        expect(await panel.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
          true,
        );
        await page.screenshot({ path: test.info().outputPath(`${action}-panel.png`) });
      } else {
        await expect(panel.getByRole('button', { name: 'Mở ô S01', exact: true })).toHaveCount(0);
        expect(opens).toBe(0);
      }
    });
  }
}

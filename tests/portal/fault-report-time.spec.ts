import { expect, test } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`fault report time survives reopening at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.setFixedTime(new Date('2026-11-26T04:02:00Z'));
    await page.route('**/hub/**', (route) => route.abort());
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me')
        return route.fulfill({
          json: {
            id: 'user',
            name: 'Seller',
            role: 'SELLER',
            sellerId: 'shop',
            sellerStatus: 'ACTIVE',
          },
        });
      if (path === '/api/sellers/shop/kiosks')
        return route.fulfill({
          json: [{ id: 'kiosk', name: 'Kiosk HCM 14', code: 'K14', status: 'ONLINE' }],
        });
      if (path === '/api/me/kiosks/kiosk/slots')
        return route.fulfill({
          json: [
            {
              id: 'slot',
              kioskId: 'kiosk',
              slotCode: 'S03',
              status: 'FAULT',
              zone: 'PREORDER',
              bouquetId: null,
              faultReportedAt: '2026-11-26T03:00:00Z',
            },
          ],
        });
      return route.fulfill({ json: [] });
    });
    await page.goto('/seller/stock');
    for (let i = 0; i < 2; i++) {
      await page.getByRole('button', { name: 'Xem chi tiết ô S03', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await expect(dialog.locator('time')).toHaveAttribute('dateTime', '2026-11-26T03:00:00Z');
      await expect(dialog.locator('time')).toContainText('10:00');
      await expect(dialog.getByText(/Đã chờ 1 giờ 2 phút/)).toBeVisible();
      await page.keyboard.press('Escape');
      await expect(dialog).not.toBeVisible();
    }
  });
}

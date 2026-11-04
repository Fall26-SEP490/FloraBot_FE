import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupAdminSurfaces } from '../fixtures/admin-surfaces';

for (const width of [390, 1440]) {
  test(`Flower sensors show independent states and hide stale or failed data at ${width}`, async ({
    page,
  }, testInfo) => {
    const model = await setupAdminSurfaces(page);
    await page.route('**/api/admin/kiosks', (route) =>
      route.fulfill({
        json: [
          {
            id: 'ui-kiosk',
            code: 'K-UI-01',
            name: 'Tủ kiểm thử',
            status: 'ONLINE',
            sellerId: null,
            sellerName: null,
            slotCount: 4,
          },
        ],
      }),
    );
    await page.route('**/api/admin/slots', (route) =>
      route.fulfill({
        json: [0, 1, 2, 3].map((index) => ({
          id: `slot-${index}`,
          kioskId: 'ui-kiosk',
          slotCode: `A0${index + 1}`,
          status: 'FREE',
          zone: 'WALK_IN',
          bouquetId: null,
        })),
      }),
    );
    let fresh = true;
    let fail = false;
    let reads = 0;
    await page.route('**/api/kiosks/*/flower-presence', async (route) => {
      reads++;
      if (fail) return route.fulfill({ status: 503, json: { detail: 'Test outage' } });
      return route.fulfill({
        json: {
          kioskId: 'ui-kiosk',
          observedAt: new Date().toISOString(),
          receivedAt: new Date().toISOString(),
          isFresh: fresh,
          slots: [true, false, null, true].map((value, index) => ({
            slotId: `slot-${index}`,
            slotCode: `A0${index + 1}`,
            relayChannel: index,
            hasFlowers: value,
          })),
        },
      });
    });
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/admin/slots');
    await page.getByLabel('Lọc phân bổ', { exact: true }).selectOption('ALL');
    await page.locator('.admin-shop-list > li > details > summary').first().click();
    await page.getByRole('button', { name: 'Xem các ô tủ', exact: true }).first().click();
    const panel = page.locator('.flower-presence').first();
    await expect(panel).toBeVisible();
    expect(reads).toBe(0);
    await panel.locator('summary').click();
    await expect(panel.locator('dd', { hasText: /^Có hoa$/ })).toHaveCount(2);
    await expect(panel.locator('dd', { hasText: /^Không có hoa$/ })).toHaveCount(1);
    await expect(panel.locator('dd', { hasText: /^Chưa xác định$/ })).toHaveCount(1);
    await expect(panel).toContainText('chưa cắm cảm biến');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: testInfo.outputPath(`flower-presence-${width}.png`),
      fullPage: true,
    });
    const accessibility = await new AxeBuilder({ page }).include('.flower-presence').analyze();
    expect(accessibility.violations).toEqual([]);
    fresh = false;
    await panel.getByRole('button', { name: 'Đọc lại cảm biến' }).click();
    await expect(panel.locator('dd', { hasText: /^Chưa xác định$/ })).toHaveCount(4);
    await expect(panel.locator('dd', { hasText: /^Có hoa$/ })).toHaveCount(0);
    fail = true;
    await panel.getByRole('button', { name: 'Đọc lại cảm biến' }).click();
    await expect(panel.getByRole('alert')).toBeVisible();
    await expect(panel.locator('dd')).toHaveCount(0);
    expect(model.writes).toEqual([]);
  });
}

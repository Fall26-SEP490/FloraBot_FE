import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupAdminSurfaces } from '../fixtures/admin-surfaces';

test('Admin can verify and enable sensors on a Walk-in slot', async ({ page }) => {
  await setupAdminSurfaces(page);
  await page.route('**/api/admin/slots', (route) =>
    route.fulfill({
      json: [
        { id: 'walk-in', kioskId: 'ui-kiosk', slotCode: 'S01', zone: 'WALK_IN', status: 'STOCKED' },
        {
          id: 'preorder',
          kioskId: 'ui-kiosk',
          slotCode: 'S03',
          zone: 'PREORDER',
          status: 'RENTED_EMPTY',
        },
      ],
    }),
  );
  let settings: {
    enabled: boolean;
    doorVerified: boolean;
    presenceVerified: boolean;
    supportsManualRetry?: boolean;
  } | null = null;
  await page.route('**/api/admin/kiosks/ui-kiosk/slots/walk-in/sensor-capabilities', (route) => {
    if (route.request().method() === 'PUT') settings = route.request().postDataJSON();
    return settings ? route.fulfill({ json: settings }) : route.fulfill({ status: 204 });
  });

  await page.route('**/api/admin/kiosks/ui-kiosk/slots/walk-in/manual-unlock-retry', (route) => {
    expect(route.request().method()).toBe('PUT');
    const body = route.request().postDataJSON();
    expect(body).toEqual({
      enabled: !settings?.supportsManualRetry,
      firmwareVerified: !settings?.supportsManualRetry,
    });
    settings = settings ? { ...settings, supportsManualRetry: body.enabled } : null;
    return route.fulfill({ json: settings });
  });

  await page.goto('/admin/slots');
  await page.getByLabel('Lọc phân bổ', { exact: true }).selectOption('ALL');
  await page.locator('.admin-shop-list > li > details > summary').first().click();
  await page.getByRole('button', { name: 'Xem các ô tủ', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Cấu hình cảm biến ô S03' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Cấu hình cảm biến ô S01' }).click();
  const dialog = page.getByRole('dialog', { name: 'Cấu hình cảm biến ô S01' });
  const enable = dialog.getByRole('checkbox', { name: 'Bật giám sát cho ô' });
  await expect(enable).toBeDisabled();
  await dialog.getByRole('checkbox', { name: 'Đã kiểm tra cảm biến cửa' }).check();
  await expect(enable).toBeDisabled();
  await dialog.getByRole('checkbox', { name: 'Đã kiểm tra cảm biến hoa' }).check();
  await enable.check();
  await dialog.getByRole('button', { name: 'Lưu cấu hình' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Đã lưu cấu hình cảm biến.');
  expect(settings).toEqual({ enabled: true, doorVerified: true, presenceVerified: true });

  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Cấu hình cảm biến ô S01' }).click();
  await expect(enable).toBeChecked();
  await expect(dialog.getByRole('button', { name: 'Lưu cấu hình' })).toBeDisabled();
  const enableRetry = dialog.getByRole('button', { name: 'Bật quyền thử mở lại' });
  await expect(enableRetry).toBeDisabled();
  await dialog.getByRole('checkbox', { name: /firmware hỗ trợ thử mở lại/ }).check();
  await enableRetry.click();
  await expect(dialog.getByRole('status')).toHaveText('Đã bật quyền thử mở lại.');
  await dialog.getByRole('button', { name: 'Tắt quyền thử mở lại' }).click();
  await expect(dialog.getByRole('status')).toHaveText('Đã tắt quyền thử mở lại.');
});

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

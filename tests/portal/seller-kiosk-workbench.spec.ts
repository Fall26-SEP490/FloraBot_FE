import { expect, test } from '@playwright/test';
import { setupSellerUsability, shopId } from '../fixtures/seller-usability';

for (const width of [1920, 1366, 768, 390]) {
  test(`kiosk selection and location editing without maps at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setupSellerUsability(page);
    const kiosks = Array.from({ length: 6 }, (_, index) => ({
      id: `kiosk-${index}`,
      code: `K-${index}`,
      name: `Kiosk ${index}`,
      address: `Address ${index}`,
      region: 'HCM',
      status: ['OFFLINE', 'ONLINE', 'MAINTENANCE'][index % 3],
      latitude: 10.7,
      longitude: 106.7,
      locationComplete: true,
      canEditLocation: index === 1,
    }));
    await page.route(`**/api/sellers/${shopId}/kiosks`, (route) => route.fulfill({ json: kiosks }));
    let saved: unknown;
    const sensorReads: string[] = [];
    let fresh = true;
    await page.route('**/api/kiosks/*/flower-presence', async (route) => {
      sensorReads.push(route.request().url());
      await route.fulfill({
        json: {
          observedAt: new Date().toISOString(),
          isFresh: fresh,
          slots: [true, false, null, true].map((hasFlowers, index) => ({
            slotId: `slot-${index}`,
            slotCode: `S0${index + 1}`,
            hasFlowers,
          })),
        },
      });
    });
    await page.route(`**/api/sellers/${shopId}/kiosks/kiosk-1/location`, async (route) => {
      saved = route.request().postDataJSON();
      await route.fulfill({ json: { ...kiosks[1], ...(saved as object) } });
    });
    await page.goto('/seller/kiosks');
    const selection = page.locator('.kiosk-selection');
    await expect(selection.locator('button')).toHaveCount(6);
    await expect(page.locator('.kiosk-card')).toHaveCount(1);
    await expect(page.locator('.kiosk-picker-map, .kiosk-map-column')).toHaveCount(0);
    await expect(page.locator('.seller-breadcrumb')).toHaveCount(0);
    await expect(page.locator('.dashboard-page-heading p')).toHaveCount(0);
    await expect(page.getByText('Đã có vị trí', { exact: true })).toHaveCount(0);
    await expect(page.locator('.kiosk-permission-notice')).toBeVisible();
    const sensors = page.getByRole('region', { name: 'Cảm biến hoa trong tủ' });
    await expect(sensors).toBeVisible();
    await expect(sensors.locator('summary')).toHaveCount(0);
    await expect(sensors.locator('dd', { hasText: /^Có hoa$/ })).toHaveCount(2);
    expect(sensorReads.some((url) => url.includes('/kiosk-0/'))).toBe(true);
    fresh = false;
    await sensors.getByRole('button', { name: 'Đọc lại cảm biến' }).click();
    await expect(sensors.locator('dd', { hasText: /^Chưa xác định$/ })).toHaveCount(4);
    const nav = await selection.boundingBox();
    const detail = await page.locator('.kiosk-card').boundingBox();
    expect(nav).toBeTruthy();
    expect(detail).toBeTruthy();
    if (width >= 1366) expect(detail!.x).toBeGreaterThan(nav!.x + nav!.width);
    else expect(detail!.y).toBeGreaterThan(nav!.y + nav!.height);
    await selection.getByRole('button', { name: /Kiosk 1/ }).click();
    await expect(page.locator('.kiosk-card h2')).toHaveText('Kiosk 1');
    await expect.poll(() => sensorReads.some((url) => url.includes('/kiosk-1/'))).toBe(true);
    await expect(page.locator('.kiosk-permission-notice')).toHaveCount(0);
    await page.locator('.kiosk-card summary').first().click();
    await page.locator('#kiosk-latitude-kiosk-1').fill('11.2');
    await page.locator('#kiosk-longitude-kiosk-1').fill('107.3');
    await page.locator('.kiosk-btn-submit').click();
    await expect
      .poll(() => saved)
      .toEqual({ address: 'Address 1', latitude: 11.2, longitude: 107.3 });
    await page.locator('#seller-kiosk-search').fill('Address 4');
    await expect(selection.locator('button')).toHaveCount(1);
    await expect(page.locator('.kiosk-card h2')).toHaveText('Kiosk 4');
    await page.locator('#seller-kiosk-search').fill('');
    for (const label of ['Trực tuyến', 'Ngoại tuyến', 'Sự cố']) {
      await page.locator('#seller-kiosk-status-filter').click();
      await page.getByRole('option', { name: label, exact: true }).click();
      await expect(selection.locator('button')).toHaveCount(2);
      await expect(selection.locator('.kiosk-status-badge')).toHaveText([label, label]);
      await expect(page.locator('.kiosk-card .kiosk-status-badge')).toHaveCount(0);
    }
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}

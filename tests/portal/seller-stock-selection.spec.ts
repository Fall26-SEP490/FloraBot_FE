import { test, expect } from '@playwright/test';

test('remembers the selected seller kiosk through navigation, reload and connection changes', async ({
  page,
}) => {
  test.setTimeout(90_000);
  let offline = false;
  let removed = false;
  const kiosks = () => [
    { id: 'new', name: 'Tủ mới', code: 'NEW', status: 'ONLINE' },
    ...(!removed
      ? [{ id: 'chosen', name: 'Tủ đã chọn', code: 'OLD', status: offline ? 'OFFLINE' : 'ONLINE' }]
      : []),
  ];
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me')
      return route.fulfill({
        json: {
          id: 'selection-user',
          name: 'Shop',
          role: 'SELLER',
          sellerId: 'selection-shop',
          sellerStatus: 'ACTIVE',
        },
      });
    if (path === '/api/sellers/selection-shop/kiosks') return route.fulfill({ json: kiosks() });
    return route.fulfill({ json: [] });
  });
  await page.goto('/seller/stock');
  const select = page.locator('#stock-kiosk');
  await expect(select).toHaveText('Tủ mới (NEW)');
  await select.click();
  await expect(page.getByRole('listbox')).toBeVisible();
  await page.screenshot({ path: test.info().outputPath('dropdown-desktop.png') });
  await select.press('ArrowDown');
  await select.press('Enter');
  await expect(select).toHaveText('Tủ đã chọn (OLD)');
  await select.click();
  await select.press('Escape');
  await expect(page.getByRole('listbox')).toHaveCount(0);
  await expect(select).toBeFocused();
  await page.setViewportSize({ width: 390, height: 900 });
  await select.click();
  const bounds = await page.getByRole('listbox').boundingBox();
  await page.screenshot({ path: test.info().outputPath('dropdown-mobile.png') });
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  await page.getByRole('option', { name: 'Tủ mới (NEW)', exact: true }).click();
  await expect(select).toHaveText('Tủ mới (NEW)');
  await select.click();
  await page.getByRole('option', { name: 'Tủ đã chọn (OLD)', exact: true }).click();
  // Unmount the workspace and return, as well as testing a complete reload.
  await page.goto('/seller');
  offline = true;
  await page.goto('/seller/stock');
  await expect(select).toHaveText('Tủ đã chọn (OLD)');
  await page.reload();
  await expect(select).toHaveText('Tủ đã chọn (OLD)');
  // A kiosk genuinely removed from the authorized list cannot be restored.
  removed = true;
  await page.reload();
  await expect(select).toHaveText('Tủ mới (NEW)');
});

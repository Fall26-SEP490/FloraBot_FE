import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`shared catalogue dropdown supports keyboard, focus and viewport at ${width}`, async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 950 });
    await page.route('**/api/**', (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() !== 'GET') return route.fulfill({ status: 405, json: {} });
      if (url.pathname === '/api/auth/me') return route.fulfill({ status: 401, json: {} });
      if (url.pathname === '/api/shop/catalog')
        return route.fulfill({
          json: {
            items: [
              {
                productId: 'product-test',
                kioskId: 'kiosk-test',
                sellerId: 'shop-test',
                name: 'Hoa kiểm thử',
                shopName: 'Shop kiểm thử',
                kioskName: 'Kiosk kiểm thử',
                address: 'Hà Nội',
                price: 250000,
                photo: null,
                bouquets: [],
                zone: 'PREORDER',
              },
            ],
            page: 1,
            hasMore: false,
          },
        });
      return route.fulfill({ json: [] });
    });
    await page.goto('/dat-hoa');
    const sort = page.getByRole('combobox', { name: 'Sắp xếp sản phẩm', exact: true });
    await expect(sort).toContainText('Mặc định');
    await sort.focus();
    await page.keyboard.press('Enter');
    const list = page.getByRole('listbox');
    await expect(list).toBeVisible();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await expect(sort).toContainText('Tên: A – Z');
    await expect(sort).toBeFocused();
    await expect(list).toHaveCount(0);
    await sort.click();
    const bounds = await list.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`dropdown-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(list).toHaveCount(0);
    await expect(sort).toBeFocused();
    await sort.click();
    await page.getByRole('option', { name: 'Giá: Thấp đến cao', exact: true }).click();
    await expect(sort).toContainText('Giá: Thấp đến cao');
    await expect(page.locator('select:not([aria-hidden="true"])')).toHaveCount(0);
  });
}

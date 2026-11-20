import { test, expect } from '@playwright/test';
import { setupSellerUsability } from '../fixtures/seller-usability';

for (const width of [1440, 390]) {
  test(`reload retains old data and blocks interaction until the response at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const model = await setupSellerUsability(page);
    await page.goto('/seller/products');
    await expect(page.locator('main')).toContainText(model.products[0].name);
    let release!: () => void;
    const response = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/me/products', async (route) => {
      await response;
      await route.fulfill({ json: [{ ...model.products[0], name: 'Updated product' }] });
    });
    await page.getByRole('button', { name: 'Tải lại mẫu hoa', exact: true }).click();
    const busy = page.locator('[data-refresh-region][aria-busy="true"]');
    await expect(busy).toBeVisible();
    await expect(busy).toContainText(model.products[0].name);
    await expect(busy.locator('[inert]')).toHaveCount(1);
    await expect(busy.getByRole('status')).toContainText('Đang cập nhật dữ liệu');
    release();
    await expect(busy).toHaveCount(0);
    await expect(page.locator('main')).toContainText('Updated product');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

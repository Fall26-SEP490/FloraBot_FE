import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1440]) {
  test(`home flower types match catalog filters at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me') return route.fulfill({ status: 401, json: {} });
      if (path === '/api/shop/catalog')
        return route.fulfill({
          json: {
            items: [
              { productId: 'rose', name: 'Hoa hồng đỏ', tags: ['hoa hồng'] },
              { productId: 'tulip', name: 'Tulip hồng', tags: ['flower:tulip'] },
              { productId: 'mixed', name: 'Bó hoa phối', tags: ['flower:rose', 'flower:tulip'] },
            ].map((item) => ({
              ...item,
              sellerId: 'seller',
              kioskId: 'kiosk',
              shopName: 'Tiệm Hoa An Nhiên',
              kioskName: 'Tủ Nguyễn Huệ',
              address: '12 Nguyễn Huệ, TP.HCM',
              description: '',
              price: 250000,
              photo: '/images/floral-pink-online.webp',
              bouquets: [],
              zone: 'PREORDER',
              preorderAvailable: true,
            })),
            page: 1,
            hasMore: false,
          },
        });
      return route.fulfill({ json: [] });
    });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Chọn theo loại hoa' })).toBeVisible();
    const homeLink = page.getByRole('link', { name: 'Xem mẫu Hoa hồng', exact: true });
    await expect(homeLink).toHaveAttribute('href', '/dat-hoa?flower=rose');
    await page.screenshot({ path: `artifacts/home-flower-types-${width}.png`, fullPage: false });
    await homeLink.click();
    await expect(page.locator('.flower-card')).toHaveCount(2);

    const panel = page.getByRole('complementary', { name: 'Bộ lọc sản phẩm' });
    if (width === 390) await page.getByRole('button', { name: 'Bộ lọc', exact: true }).click();
    const flower = panel.getByRole('combobox', { name: 'Loại hoa' });
    await expect(flower).toHaveValue('rose');
    await expect(panel.getByRole('combobox', { name: 'Dịp tặng' })).toHaveCount(0);
    await expect(flower.locator('option[value="rose"]')).toHaveText('Hoa hồng: còn 2 mẫu');
    await expect(flower.locator('option[value="lily"]')).toHaveCount(0);
    const price = panel.getByRole('radio', { name: /^Dưới 300.000/ });
    await price.click();
    await expect(price).toBeChecked();
    await expect(panel.getByRole('radio', { name: /^Mua trực tiếp tại tủ/ })).toHaveCount(0);
    const axe = await new AxeBuilder({ page }).include('#catalog-filters').analyze();
    expect(axe.violations).toEqual([]);
    expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    await page.screenshot({ path: `artifacts/catalog-flower-types-${width}.png`, fullPage: false });
    if (width === 390) {
      await expect(panel.getByRole('button', { name: 'Áp dụng bộ lọc' })).toHaveText(
        'Xem 2 mẫu hoa',
      );
      await panel.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
    }
    await page.reload();
    await expect(page.locator('.flower-card')).toHaveCount(2);
    if (width === 390) await page.getByRole('button', { name: 'Bộ lọc', exact: true }).click();
    await expect(flower).toHaveValue('rose');
    await flower.selectOption('tulip');
    await expect(page).toHaveURL(/flower=tulip/);
    await expect(page.getByRole('heading', { name: 'Tulip hồng', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Hoa hồng đỏ', exact: true })).toHaveCount(0);
    await page.goBack();
    await expect(flower).toHaveValue('rose');
    await expect(page.locator('.flower-card')).toHaveCount(2);

    // Retired occasion links must not leave a hidden filter on the catalog.
    await page.goto('/dat-hoa?occasion=Sinh+nh%E1%BA%ADt');
    await expect(page.locator('.flower-card')).toHaveCount(3);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  });
}

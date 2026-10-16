import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ status: 401, json: {} });
    if (path === '/api/shop/catalog')
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    return route.fulfill({ json: [] });
  });
});

for (const width of [320, 390, 820, 1440]) {
  test(`catalog search and cards fit at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/dat-hoa?demo=1');
    await expect(page.locator('.flower-card')).toHaveCount(12);
    await page.evaluate(() => document.fonts.ready);
    const input = await page
      .getByRole('searchbox', { name: 'Tìm mẫu hoa, shop hoặc tủ nhận' })
      .boundingBox();
    const button = await page.getByRole('button', { name: 'Tìm hoa', exact: true }).boundingBox();
    expect(input).not.toBeNull();
    expect(button).not.toBeNull();
    expect(Math.abs(input!.height - button!.height)).toBeLessThanOrEqual(1);
    if (width > 580) expect(Math.abs(input!.y - button!.y)).toBeLessThanOrEqual(1);
    else {
      expect(button!.y).toBeGreaterThanOrEqual(input!.y + input!.height);
      expect(Math.abs(input!.width - button!.width)).toBeLessThanOrEqual(1);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
    expect(
      await page.locator('.flower-card button').evaluateAll((elements) =>
        elements.every((el) => {
          const rect = el.getBoundingClientRect();
          return rect.height >= 44 && el.scrollWidth <= el.clientWidth + 1;
        }),
      ),
    ).toBe(true);
    const results = await new AxeBuilder({ page }).include('#main').analyze();
    expect(results.violations).toEqual([]);
    await page.screenshot({ path: `artifacts/catalog-after-${width}.png`, fullPage: false });
  });
}

test('desktop filters move with the document without a nested scrollbar', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('/dat-hoa?demo=1');
  await expect(page.locator('.flower-card')).toHaveCount(12);
  const sidebar = page.getByRole('complementary', { name: 'Bộ lọc sản phẩm' });
  const before = await sidebar.boundingBox();
  await page.evaluate(() => window.scrollTo({ top: 550, behavior: 'instant' }));
  const after = await sidebar.boundingBox();
  const scroll = await page.evaluate(() => window.scrollY);
  expect(Math.abs(before!.y - after!.y - scroll)).toBeLessThanOrEqual(1);
  expect(await sidebar.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
});

test('mobile filters expose selection, apply, and close with Escape', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dat-hoa?demo=1');
  await expect(page.locator('.flower-card')).toHaveCount(12);
  const toggle = page.getByRole('button', { name: /^Bộ lọc/ });
  const panel = page.getByRole('complementary', { name: 'Bộ lọc sản phẩm' });
  await expect(toggle).toHaveAttribute('aria-controls', 'catalog-filters');
  await expect(panel).toBeHidden();
  await toggle.click();
  const birthday = panel.getByRole('button', { name: /^Sinh nhật/ });
  await expect(birthday).toHaveText('Sinh nhật(4)');
  await birthday.click();
  await expect(birthday).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: /Xem 4 mẫu phù hợp/ }).click();
  await expect(panel).toBeHidden();
  await expect(toggle).toBeFocused();
  await expect(page.locator('.flower-card')).toHaveCount(4);
  await toggle.click();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(toggle).toBeFocused();
  await page.getByRole('button', { name: 'Xóa tất cả', exact: true }).click();
  await expect(page.locator('.flower-card')).toHaveCount(12);
});

test('a 600,000đ product belongs to only one price range', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.route('**/api/shop/catalog?*', (route) =>
    route.fulfill({
      json: {
        items: [600000, 600001, 1000000].map((price, index) => ({
          productId: `product-${index}`,
          sellerId: 'seller',
          kioskId: 'kiosk',
          name: `Mẫu ${price}`,
          shopName: 'Shop thử',
          kioskName: 'Tủ thử',
          address: '',
          description: 'Hoa giả',
          price,
          photo: null,
          bouquets: [],
        })),
        page: 1,
        hasMore: false,
      },
    }),
  );
  await page.goto('/dat-hoa');
  await expect(page.locator('.flower-card')).toHaveCount(3);
  const panel = page.getByRole('complementary', { name: 'Bộ lọc sản phẩm' });
  await panel.getByRole('button', { name: /^300.000 đ/ }).click();
  await expect(page.locator('.flower-card')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Mẫu 600000', exact: true })).toBeVisible();
  await panel.getByRole('button', { name: /^Trên 600.000 đ/ }).click();
  await expect(page.locator('.flower-card')).toHaveCount(2);
  await expect(page.getByRole('heading', { name: 'Mẫu 600000', exact: true })).toHaveCount(0);
});

test('flower details lock background scroll and restore keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dat-hoa?demo=1');
  const trigger = page.getByRole('button', { name: 'Xem chi tiết', exact: true }).first();
  await trigger.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).toBe('hidden');
  expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
});

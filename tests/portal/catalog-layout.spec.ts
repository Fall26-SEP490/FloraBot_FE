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
    await expect(page.getByRole('button', { name: 'Xem chi tiết', exact: true })).toHaveCount(0);
    const firstCard = page.locator('.flower-card').first();
    const order = await firstCard
      .getByRole('button', { name: 'Đặt hoa', exact: true })
      .boundingBox();
    const chat = await firstCard
      .getByRole('button', { name: 'Nhắn tin với shop', exact: true })
      .boundingBox();
    expect(order).not.toBeNull();
    expect(chat).not.toBeNull();
    expect(Math.abs(order!.y - chat!.y)).toBeLessThanOrEqual(1);
    expect(chat!.x).toBeGreaterThanOrEqual(order!.x + order!.width);
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
  await expect(birthday).toHaveText('Sinh nhật');
  await birthday.click();
  await expect(birthday).toHaveAttribute('aria-pressed', 'true');
  await panel.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
  await expect(panel).toBeHidden();
  await expect(toggle).toBeFocused();
  await expect(page.locator('.flower-card')).toHaveCount(4);
  await toggle.click();
  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(toggle).toBeFocused();
  await expect(page.getByRole('button', { name: 'Xóa tất cả', exact: true })).toHaveCount(0);
  await toggle.click();
  await panel.getByRole('button', { name: 'Đặt lại', exact: true }).click();
  await panel.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
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

test('order action opens an accessible modal and restores focus', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dat-hoa?demo=1');
  const trigger = page.getByRole('button', { name: 'Đặt hoa', exact: true }).first();
  await trigger.click();
  const panel = page.locator('.flower-request');
  await expect(panel).toBeVisible();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Đóng mẫu đang chọn' })).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(panel).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(await page.evaluate(() => getComputedStyle(document.body).overflow)).not.toBe('hidden');
});

test('flower image opens its detail page and allows ordering', async ({ page }) => {
  await page.goto('/dat-hoa?demo=1');
  const card = page.locator('.flower-card').first();
  const name = await card.locator('h2').innerText();
  await card.getByRole('link', { name: `Xem chi tiết ${name}` }).click();
  await expect(page).toHaveURL(/\/dat-hoa\/[^/]+\/[^/?]+\?demo=1/);
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/flower-detail-desktop.png', fullPage: true });
  await page.getByRole('button', { name: 'Đặt hoa', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: 'artifacts/flower-detail-mobile.png', fullPage: true });
});

test('detail page resolves product and kiosk beyond first API page on direct navigation', async ({
  page,
}) => {
  await page.route('**/api/shop/catalog?*', (route) => {
    const pageNumber = new URL(route.request().url()).searchParams.get('page');
    return route.fulfill({
      json:
        pageNumber === '1'
          ? { items: [], page: 1, hasMore: true }
          : {
              items: [
                {
                  productId: 'p1',
                  kioskId: 'k1',
                  sellerId: 's1',
                  name: 'Hoa hồng',
                  shopName: 'Shop hoa',
                  kioskName: 'Kiosk A',
                  address: 'Địa chỉ A',
                  description: null,
                  price: 200000,
                  photo: null,
                  bouquets: [],
                },
              ],
              page: 2,
              hasMore: false,
            },
    });
  });
  await page.goto('/dat-hoa/p1/k1');
  await expect(page.getByRole('heading', { name: 'Hoa hồng', exact: true })).toBeVisible();
  await expect(page.getByText('Kiosk A', { exact: false })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mô tả sản phẩm' })).toBeVisible();
  await expect(page.getByText('Shop chưa cung cấp mô tả cho mẫu hoa này.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Cửa hàng & kiosk' })).toBeVisible();
  await expect(page.getByText('Địa chỉ A')).toBeVisible();
  await expect(page.getByText(/Ảnh minh họa · Shop chưa có ảnh/)).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Hoa hồng', exact: true })).toBeVisible();
  await page.goto('/dat-hoa/p1/other-kiosk');
  await expect(page.getByText('Mẫu hoa không còn trong danh mục tại kiosk này.')).toBeVisible();
});

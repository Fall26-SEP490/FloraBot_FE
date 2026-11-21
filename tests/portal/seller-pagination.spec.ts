import { test, expect } from '@playwright/test';
import { setupSellerUsability, shopId } from '../fixtures/seller-usability';

for (const width of [390, 1440]) {
  test(`Seller pagination centers and changes pages at ${width}`, async ({ page }) => {
    const model = await setupSellerUsability(page);
    const product = model.products[0];
    model.products = Array.from({ length: 25 }, (_, index) => ({
      ...product,
      id: `flower-${index}`,
      name: `Hoa ${index + 1}`,
    }));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/seller/products');
    const paging = page.getByRole('navigation', { name: 'Phân trang danh sách sản phẩm' });
    await expect(paging).toBeVisible();
    await expect(paging.getByRole('button', { name: 'Trang trước' })).toBeDisabled();
    await expect(paging.locator('[aria-current="page"]')).toContainText('Trang 1 /');
    await paging.getByRole('button', { name: 'Trang sau' }).click();
    await expect(paging.locator('[aria-current="page"]')).toContainText('Trang 2 /');
    await paging.getByRole('button', { name: 'Trang trước' }).click();
    await expect(paging.locator('[aria-current="page"]')).toContainText('Trang 1 /');
    const group = await paging.boundingBox();
    const previous = await paging.getByRole('button', { name: 'Trang trước' }).boundingBox();
    const next = await paging.getByRole('button', { name: 'Trang sau' }).boundingBox();
    expect(
      Math.abs((previous!.x + next!.x + next!.width) / 2 - (group!.x + group!.width / 2)),
    ).toBeLessThan(2);
    expect(Math.abs(previous!.y - next!.y)).toBeLessThan(2);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('Seller task paging uses API hasMore and does not invent total pages', async ({ page }) => {
  await setupSellerUsability(page);
  await page.route(`**/api/sellers/${shopId}/staff-tasks?*`, (route) => {
    const current = Number(new URL(route.request().url()).searchParams.get('page') || 1);
    return route.fulfill({ json: { items: [], page: current, hasMore: current === 1 } });
  });
  await page.goto('/seller/tasks');
  const paging = page.getByRole('navigation', { name: 'Phân trang công việc' });
  await expect(paging.locator('[aria-current="page"]')).toHaveText('Trang 1');
  await paging.getByRole('button', { name: 'Trang sau' }).click();
  await expect(paging.locator('[aria-current="page"]')).toHaveText('Trang 2');
  await expect(paging.getByRole('button', { name: 'Trang sau' })).toBeDisabled();
  await paging.getByRole('button', { name: 'Trang trước' }).click();
  await expect(paging.locator('[aria-current="page"]')).toHaveText('Trang 1');
});

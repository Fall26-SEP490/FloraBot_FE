import { test, expect } from '@playwright/test';
import { setupSellerUsability, sampleRequest, shopId } from '../fixtures/seller-usability';

for (const width of [2560, 1920, 1440, 1366, 1024, 768, 390, 375]) {
  test(`seller preorder sheet stays compact and preserves the quote form at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 1000 });
    const model = await setupSellerUsability(page);
    await page.route(`**/api/sellers/${shopId}/preorders?*`, (route) =>
      route.fulfill({
        json: {
          items: Array.from({ length: 8 }, (_, i) => ({
            ...sampleRequest,
            id: `sheet-${i}`,
            orderCode: `FB261119-${i}`,
            productName: i === 0 ? 'Hoa hồng' : `Mẫu hoa ${i}`,
            orderStatus: i === 0 ? null : i % 2 ? 'COMPLETED' : 'AWAITING_PAYMENT',
            state: i === 0 ? 'REQUESTED' : 'ORDERED',
            quotedPrice: i === 0 ? null : 350000,
          })),
          page: 1,
          hasMore: false,
        },
      }),
    );
    await page.goto('/seller/orders');
    await expect(page.locator('#web-orders summary')).toHaveCount(8, { timeout: 30_000 });
    const status = page.getByRole('combobox', { name: 'Trạng thái đơn', exact: true });
    await status.click();
    await expect(page.getByRole('option', { name: 'Tất cả', exact: true })).toBeVisible();
    await expect(page.getByRole('option', { name: 'Chờ xác nhận', exact: true })).toHaveCount(0);
    await page.getByRole('option', { name: 'Chờ báo giá', exact: true }).click();
    await expect(page.locator('#web-orders summary')).toHaveCount(1);
    await status.click();
    await page.getByRole('option', { name: 'Tất cả', exact: true }).click();
    await expect(page.locator('#web-orders summary')).toHaveCount(8);
    await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toHaveCount(0);
    await expect(
      page.locator('#main').getByRole('link', { name: 'Tổng quan cửa hàng', exact: true }),
    ).toHaveCount(0);
    await expect(
      page.getByText('Báo giá, chuẩn bị hoa và theo dõi lịch nhận.', { exact: true }),
    ).toHaveCount(0);
    await expect(page.getByText(/Đã tìm trên .* yêu cầu của shop/)).toHaveCount(0);
    const row = page.locator('#preorder-sheet-0');
    if (width >= 1366)
      expect((await row.locator(':scope > summary').boundingBox())!.height).toBeLessThan(110);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const search = page.getByRole('searchbox', { name: 'Tìm đơn của shop' });
    const searchBox = (await search.boundingBox())!;
    const statusBox = (await status.boundingBox())!;
    if (width >= 1366) {
      expect(Math.abs(searchBox.y - statusBox.y)).toBeLessThan(2);
      expect(
        await row.evaluate((el) => el.scrollWidth <= el.closest('#web-orders')!.clientWidth),
      ).toBe(true);
    } else if (width <= 768) {
      expect(searchBox.y + searchBox.height).toBeLessThan(statusBox.y);
    }
    if (width >= 1440) expect(searchBox.width).toBeLessThanOrEqual(560);
    await page.screenshot({
      path: testInfo.outputPath(`seller-orders-${width}.png`),
      fullPage: true,
    });
    await row.locator(':scope > summary > span').last().click();
    const drawer = page.getByRole('dialog', { name: 'FB261119-0', exact: true });
    await expect(drawer).toBeVisible();
    await drawer.evaluate(async (el) => {
      await Promise.all(el.getAnimations().map((animation) => animation.finished));
    });
    expect(await drawer.locator('..').evaluate((el) => getComputedStyle(el).backdropFilter)).toBe(
      'none',
    );
    const drawerBox = (await drawer.boundingBox())!;
    expect(Math.abs(drawerBox.x + drawerBox.width - width)).toBeLessThan(2);
    expect(drawerBox.height).toBeGreaterThan(950);
    expect(drawerBox.y).toBe(0);
    expect(await drawer.evaluate((el) => getComputedStyle(el).borderRadius)).toBe('0px');
    if (width === 390) expect(Math.abs(drawerBox.width - width)).toBeLessThan(1);
    if (width >= 1366) expect(drawerBox.width).toBeLessThanOrEqual(680);
    await page.screenshot({ path: testInfo.outputPath(`seller-drawer-open-${width}.png`) });
    await drawer.getByRole('button', { name: 'Báo giá hoặc từ chối' }).click();
    const price = drawer.getByLabel('Giá bó hoa (đồng)', { exact: true });
    await expect(price).toBeVisible();
    await expect(price).toHaveValue('350000');
    const form = drawer.locator('form.order-action-card');
    const box = (await form.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    expect(model.writes).toEqual([]);
    await form.screenshot({ path: testInfo.outputPath(`seller-quote-${width}.png`) });
    await page.screenshot({ path: testInfo.outputPath(`seller-drawer-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(drawer).toHaveCSS('animation-name', /seller-order-drawer-out/);
    await expect(drawer).toHaveCount(0);
    await expect(row.locator(':scope > summary')).toBeFocused();
  });
}

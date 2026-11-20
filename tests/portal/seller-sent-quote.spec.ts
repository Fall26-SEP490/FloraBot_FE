import { expect, test } from '@playwright/test';
import { setupSellerUsability, sampleRequest, shopId } from '../fixtures/seller-usability';

for (const [width, accessories] of [
  [1440, false],
  [390, false],
  [1440, true],
] as const) {
  test(`seller sent quote stays compact and preserves actions at ${width} with accessories ${accessories}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 1000 });
    const model = await setupSellerUsability(page);
    const quoted = {
      ...sampleRequest,
      state: 'QUOTED',
      quotedFlowerPrice: 10000,
      quotedPrice: accessories ? 15000 : 10000,
      quotedAccessoryTotal: accessories ? 5000 : 0,
      quoteNote: 'Hoa hồng tông pastel, gói giấy trắng.',
      instructions: 'Tặng sinh nhật, hoa tông pastel.',
      requestedAccessories: accessories
        ? [{ accessoryId: 'bow', name: 'Nơ lụa', quantity: 1 }]
        : [],
      quotedAccessories: accessories
        ? [{ accessoryId: 'bow', name: 'Nơ lụa', quantity: 1, unitPrice: 5000, lineTotal: 5000 }]
        : [],
    };
    await page.route(`**/api/sellers/${shopId}/preorders?*`, (route) =>
      route.fulfill({ json: { items: [quoted], page: 1, hasMore: false } }),
    );
    await page.goto('/seller/orders');
    await page.locator(`#preorder-${sampleRequest.id} > summary`).click();
    const drawer = page.getByRole('dialog');
    await expect(drawer).toBeVisible();
    await drawer.evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
    });
    const progress = drawer.getByRole('list', { name: 'Tiến độ đơn đặt hoa' });
    await expect(progress.locator('[aria-current="step"]')).toContainText('Chờ khách xác nhận');
    expect((await progress.boundingBox())!.height).toBeLessThan(width === 390 ? 180 : 110);
    await expect(
      drawer.getByText('Đã gửi báo giá · Chờ khách xác nhận', { exact: true }),
    ).toHaveCount(0);
    await expect(
      drawer.getByText('Chỉ chuẩn bị hoa sau khi khách thanh toán.', { exact: true }),
    ).toBeVisible();
    await expect(drawer.getByText('Ghi chú cho khách', { exact: true })).toBeVisible();
    const total = drawer.getByRole('region', { name: 'Chi tiết báo giá', exact: true });
    await expect(total.getByText('Tổng báo giá', { exact: true })).toBeVisible();
    if (accessories) {
      await expect(total).toContainText('Nơ lụa');
      await expect(total).toContainText('15.000 đ');
    } else {
      await expect(total.getByText('10.000 đ', { exact: true })).toHaveCount(1);
      await expect(total.getByText('Bó hoa', { exact: true })).toHaveCount(0);
    }
    const edit = drawer.getByRole('button', { name: 'Chỉnh sửa báo giá', exact: true });
    const cancel = drawer.getByRole('button', { name: 'Hủy yêu cầu', exact: true });
    await expect(edit).toBeEnabled();
    await expect(cancel).toBeEnabled();
    expect(await drawer.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`sent-quote-${width}-${accessories}.png`) });
    if (!accessories) {
      await edit.click();
      await expect(drawer.getByLabel('Giá bó hoa (đồng)', { exact: true })).toHaveValue('10000');
      await expect(drawer.getByLabel('Ghi chú cho khách', { exact: true })).toHaveValue(
        quoted.quoteNote,
      );
      await drawer.locator('form').getByRole('button', { name: 'Đóng', exact: true }).click();
      await expect(edit).toBeVisible();
    }
    expect(model.writes).toEqual([]);
  });
}

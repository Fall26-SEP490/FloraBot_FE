import { expect, test } from '@playwright/test';
import { setupSellerUsability, shopId, sampleProduct } from '../fixtures/seller-usability';
import { chooseSelect } from '../fixtures/select';

for (const width of [1440, 390]) {
  test(`Seller catalog tables and panels at ${width}`, async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 1000 });
    const model = await setupSellerUsability(page);
    await page.route('**/api/me/products/*/photos*', (route) =>
      route.fulfill({
        json: {
          items: [
            { id: 'cover', url: 'https://res.cloudinary.com/test/flower.jpg', isCover: true },
          ],
          page: 1,
          hasMore: false,
        },
      }),
    );
    await page.route('https://res.cloudinary.com/test/flower.jpg', (route) =>
      route.fulfill({ path: 'apps/web/public/images/flowers-pink.jpg', contentType: 'image/jpeg' }),
    );
    model.products.push({
      ...sampleProduct,
      id: 'draft',
      name: 'Hoa hồng pastel',
      status: 'DRAFT',
    });
    await page.route(`**/api/sellers/${shopId}/accessories?scope=SHOP`, (route) =>
      route.fulfill({
        json: [
          {
            id: 'ribbon',
            name: 'Nơ lụa',
            price: 10000,
            stockQuantity: 22,
            status: 'ACTIVE',
            scope: 'SHOP',
          },
          {
            id: 'card',
            name: 'Thiệp chúc mừng',
            price: 15000,
            stockQuantity: 0,
            status: 'INACTIVE',
            scope: 'SHOP',
          },
        ],
      }),
    );
    await page.goto('/seller/products');
    await expect(
      page.getByRole('button', { name: `Xem mẫu hoa ${sampleProduct.name}`, exact: true }),
    ).toBeVisible({ timeout: 20_000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`products-${width}.png`) });
    await chooseSelect(page, 'Trạng thái', 'DRAFT');
    await expect(
      page.getByRole('button', { name: 'Xem mẫu hoa Hoa hồng pastel', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: `Xem mẫu hoa ${sampleProduct.name}`, exact: true }),
    ).toHaveCount(0);
    await chooseSelect(page, 'Trạng thái', 'ALL');
    await page
      .getByRole('button', { name: `Xem mẫu hoa ${sampleProduct.name}`, exact: true })
      .click();
    const panel = page.getByRole('dialog', { name: sampleProduct.name, exact: true });
    await expect(panel.getByRole('button', { name: 'Lưu giá', exact: true })).toBeVisible();
    await panel.evaluate(async (element) => {
      await Promise.all(element.getAnimations().map((animation) => animation.finished));
    });
    await page.screenshot({ path: testInfo.outputPath(`product-panel-${width}.png`) });
    await panel.getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true }).click();
    const edit = page.getByRole('dialog', { name: `Chỉnh sửa ${sampleProduct.name}`, exact: true });
    await expect(edit).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`product-edit-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(edit).toBeHidden();
    await expect(panel).toBeVisible();
    await panel
      .getByRole('button', {
        name: `Xem kích thước đầy đủ ảnh 1 của ${sampleProduct.name}`,
        exact: true,
      })
      .click();
    const photo = page.getByRole('dialog', {
      name: `${sampleProduct.name} · Ảnh 1/1`,
      exact: true,
    });
    await expect(photo).toBeVisible();
    await expect(photo.getByRole('button', { name: /Ảnh trước|Ảnh sau/ })).toHaveCount(0);
    const photoBox = await photo.boundingBox();
    expect(photoBox!.x).toBeGreaterThanOrEqual(0);
    expect(photoBox!.x + photoBox!.width).toBeLessThanOrEqual(width + 1);
    expect(photoBox!.height).toBeLessThanOrEqual(1000);
    const stage = await photo.locator('.product-photo-lightbox-stage').boundingBox();
    const fullImage = await photo.locator('.product-photo-lightbox-img').boundingBox();
    expect(stage!.height).toBeGreaterThanOrEqual(fullImage!.height);
    await page.screenshot({ path: testInfo.outputPath(`product-photo-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(photo).toBeHidden();
    await expect(panel).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await page.goto('/seller/accessories');
    await expect(
      page.getByRole('button', { name: 'Xem phụ kiện Nơ lụa', exact: true }),
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`accessories-${width}.png`) });
    await page.getByRole('searchbox', { name: 'Tìm phụ kiện' }).fill('khongco');
    await expect(page.getByText('Không tìm thấy phụ kiện phù hợp')).toBeVisible();
    await page.getByRole('searchbox', { name: 'Tìm phụ kiện' }).fill('');
    await page.getByRole('button', { name: 'Xem phụ kiện Nơ lụa', exact: true }).click();
    const accessory = page.getByRole('dialog', { name: 'Nơ lụa', exact: true });
    await expect(accessory.getByLabel('Tên phụ kiện', { exact: true })).toHaveValue('Nơ lụa');
    await accessory.getByRole('button', { name: 'Kiểm tra số lượng', exact: true }).click();
    await expect(accessory.getByRole('alert')).toContainText('Nhập số lượng nguyên');
    await accessory.getByLabel('Số lượng bổ sung cho Nơ lụa').fill('5');
    await accessory.getByRole('button', { name: 'Kiểm tra số lượng', exact: true }).click();
    await expect(
      accessory.getByRole('button', { name: 'Xác nhận bổ sung', exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`accessory-panel-${width}.png`) });
    await page.keyboard.press('Escape');
    await expect(accessory).toBeHidden();
    await page.getByRole('button', { name: 'Thêm phụ kiện', exact: true }).click();
    const create = page.getByRole('dialog', { name: 'Thêm phụ kiện', exact: true });
    await create.getByRole('button', { name: 'Tạo phụ kiện', exact: true }).click();
    await expect(create.getByRole('alert')).toContainText('Tên phụ kiện');
    expect(model.writes).toEqual([]);
  });
}

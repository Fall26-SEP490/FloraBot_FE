import { test, expect } from '@playwright/test';
import { setupSellerUsability, sampleProduct } from '../fixtures/seller-usability';

test('Product status uses confirmed sale toggle and creation has no draft hint', async ({
  page,
}) => {
  const model = await setupSellerUsability(page);
  let writes = 0;
  await page.route('**/flows/set_product_status', (route) => {
    expect(route.request().postDataJSON()).toEqual({
      productId: sampleProduct.id,
      status: 'INACTIVE',
    });
    writes++;
    model.products[0].status = 'INACTIVE';
    return route.fulfill({ json: { result: null } });
  });
  await page.goto('/seller/products');
  await page
    .getByRole('button', { name: `Xem mẫu hoa ${sampleProduct.name}`, exact: true })
    .click();
  await expect(page.getByText('Trạng thái kinh doanh', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ngừng bán mẫu hoa', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Ngừng bán mẫu hoa?', exact: true });
  await expect(confirm).toBeVisible();
  expect(writes).toBe(0);
  await confirm.getByRole('button', { name: 'Ngừng bán mẫu hoa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Bật bán mẫu hoa', exact: true })).toBeVisible();
  expect(writes).toBe(1);
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Thêm mẫu hoa', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'Thêm mẫu hoa', exact: true });
  await expect(create).toBeVisible();
  await expect(create.getByText('Bản mẫu', { exact: true })).toHaveCount(0);
  await expect(create.getByText('Thêm ảnh và bật bán sau khi tạo.', { exact: true })).toHaveCount(
    0,
  );
});

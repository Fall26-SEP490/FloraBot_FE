import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupSellerUsability, sampleRequest, kioskId } from '../fixtures/seller-usability';
const sections = [
  ['overview', 'Tổng quan cửa hàng', '[aria-labelledby="seller-orders-title"]'],
  ['orders', 'Đơn đặt trước', '#web-orders'],
  ['products', 'Mẫu hoa', '#seller-products'],
  ['stock', 'Hoa tại tủ', '.seller-stock'],
  ['accessories', 'Phụ kiện', '.seller-accessories'],
  ['kiosks', 'Vị trí kiosk', '.seller-kiosks-page'],
  ['tasks', 'Giao việc nhân viên', '#staff-tasks'],
  ['staff', 'Nhân viên shop', '.account-management-workspace'],
  ['chats', 'Tin nhắn khách hàng', '.staff-chat-section'],
  ['staff-chats', 'Tin nhắn nhân viên', '.staff-chat-section'],
  ['wallet', 'Ví & rút tiền', '#wallet'],
  ['subscriptions', 'Gói thuê', '#subscriptions'],
] as const;
for (const width of [390, 1440])
  for (const [section, title, selector] of sections) {
    test(`Seller ${section} has usable help, responsive content and accessible controls at ${width}`, async ({
      page,
    }) => {
      const model = await setupSellerUsability(page);
      await page.setViewportSize({ width, height: 1000 });
      await page.goto(section === 'overview' ? '/seller' : '/seller/' + section);
      await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
      await expect(page.locator(selector)).toBeVisible();
      await expect(page.locator('.seller-guide > summary')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        (
          await new AxeBuilder({ page })
            .include('#main')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
      expect(model.writes).toEqual([]);
    });
  }
for (const width of [390, 1440])
  test(`Seller can find tasks without accents and navigate with keyboard at ${width}`, async ({
    page,
  }) => {
    const model = await setupSellerUsability(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/seller');
    if (width === 390)
      await page.getByRole('button', { name: 'Mở danh mục quản lý', exact: true }).click();
    const nav = page.getByRole('navigation', { name: 'Điều hướng quản lý' });
    await expect(nav.getByRole('link')).toHaveCount(12);
    await nav.getByLabel('Tìm chức năng cửa hàng').fill('rut tien');
    await expect(nav.getByRole('link', { name: 'Ví & rút tiền', exact: true })).toBeVisible();
    await expect(nav.getByRole('link', { name: 'Mẫu hoa', exact: true })).toHaveCount(0);
    await nav.getByRole('button', { name: 'Xóa tìm chức năng' }).click();
    await nav.getByLabel('Tìm chức năng cửa hàng').fill('nap hoa');
    await expect(nav.getByRole('link', { name: 'Hoa tại tủ', exact: true })).toBeVisible();
    await nav.getByRole('button', { name: 'Xóa tìm chức năng' }).click();
    await nav.getByLabel('Tìm chức năng cửa hàng').fill('zzzz');
    await expect(nav.getByRole('status')).toContainText('Không tìm thấy');
    await nav.getByRole('button', { name: 'Xóa tìm chức năng' }).click();
    await nav.getByRole('link', { name: 'Mẫu hoa', exact: true }).click();
    await expect(page).toHaveURL(/seller\/products$/);
    if (width === 390) {
      await page.getByRole('button', { name: 'Mở danh mục quản lý', exact: true }).click();
      await page.getByLabel('Tìm chức năng cửa hàng').press('Escape');
      await expect(
        page.getByRole('button', { name: 'Mở danh mục quản lý', exact: true }),
      ).toBeFocused();
    }
    expect(model.writes).toEqual([]);
  });
test('Seller overview opens and focuses the exact request on its correct API page', async ({
  page,
}) => {
  const model = await setupSellerUsability(page);
  model.pagedOrders = true;
  await page.goto('/seller');
  const link = page.locator(`a[href*="requestId=${sampleRequest.id}"]`);
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute('href', `/seller/orders?page=2&requestId=${sampleRequest.id}`);
  await link.click();
  await expect(page.locator(`#preorder-${sampleRequest.id}`)).toHaveAttribute('open', '');
  await expect(page.locator(`#preorder-${sampleRequest.id} > summary`)).toBeFocused();
  expect(model.reads).toContain('/sellers/' + sampleRequest.sellerId + '/preorders?page=2');
  expect(model.writes).toEqual([]);
});
test('Seller can reset order filters and only one set of product status filters is shown', async ({
  page,
}) => {
  const model = await setupSellerUsability(page);
  await page.goto('/seller/orders');
  await page.getByLabel('Tìm đơn trong trang').fill('khongco');
  await expect(page.getByRole('heading', { name: 'Không tìm thấy yêu cầu phù hợp' })).toBeVisible();
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
  await expect(page.getByLabel('Tìm đơn trong trang')).toHaveValue('');
  await expect(page.locator('.web-orders summary')).toHaveCount(1);
  await page.goto('/seller/products');
  await expect(page.locator('.product-summary button')).toHaveCount(4);
  await expect(page.locator('.product-tabs')).toHaveCount(0);
  expect(model.writes).toEqual([]);
});
for (const width of [390, 1440])
  test(`Seller creates a draft with the same API contract and can close the form at ${width}`, async ({
    page,
  }) => {
    const model = await setupSellerUsability(page);
    model.allowCreate = true;
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/seller/products');
    const add = page.getByRole('button', { name: 'Thêm mẫu hoa', exact: true });
    await add.click();
    const modal = page.getByRole('dialog', { name: 'Thêm mẫu hoa', exact: true });
    await expect(modal).toBeVisible();
    const box = await modal.boundingBox();
    expect(box!.width).toBeLessThanOrEqual(width);
    expect(box!.height).toBeLessThanOrEqual(1000);
    await expect(modal).toContainText('Chưa có bó hoa nào được nạp');
    await modal.press('Escape');
    await expect(add).toBeFocused();
    await add.click();
    const form = page.getByRole('form', { name: 'Thêm mẫu hoa giả mới' });
    await form.getByRole('button', { name: 'Tạo mẫu hoa', exact: true }).click();
    expect(model.writes).toEqual([]);
    await form.getByLabel('Tên mẫu hoa', { exact: true }).fill('Mẫu mới kiểm thử');
    await form.getByLabel('Giá bán niêm yết (VNĐ)', { exact: true }).fill('280000');
    await form.getByLabel('Dài (cm)', { exact: true }).fill('25');
    await form.getByLabel('Rộng (cm)', { exact: true }).fill('15');
    await form.getByLabel('Cao (cm)', { exact: true }).fill('35');
    await form.getByRole('button', { name: 'Tạo mẫu hoa', exact: true }).click();
    await expect(modal).toBeHidden();
    expect(model.writes).toEqual([
      {
        path: '/me/products',
        body: {
          kioskId,
          name: 'Mẫu mới kiểm thử',
          description: '',
          price: 280000,
          tags: [],
          lengthCm: 25,
          widthCm: 15,
          heightCm: 35,
        },
      },
    ]);
    await expect(page.locator('.product-order-list')).toContainText('Mẫu mới kiểm thử');
  });
test('Seller catalog errors do not claim the shop has no products and retry preserves data', async ({
  page,
}) => {
  const model = await setupSellerUsability(page);
  model.fail.add('/me/products');
  await page.goto('/seller/products');
  await expect(page.locator('.product-error-box')).toBeVisible();
  await expect(page.locator('.product-empty-state')).toHaveCount(0);
  model.fail.delete('/me/products');
  await page.getByRole('button', { name: 'Tải lại sản phẩm', exact: true }).click();
  await expect(page.locator('.product-order-list')).toContainText('Mẫu kiểm thử Seller');
  expect(model.writes).toEqual([]);
});
test('Seller guidance distinguishes empty catalog and physical stock without invented products', async ({
  page,
}) => {
  const model = await setupSellerUsability(page);
  model.empty = true;
  await page.goto('/seller');
  await expect(page.getByRole('link', { name: 'Tạo mẫu hoa đầu tiên', exact: true })).toBeVisible();
  await page.locator('.seller-guide summary').press('Enter');
  await expect(page.locator('.seller-guide-content')).toContainText('Tạo mẫu chưa có nghĩa');
  expect(model.writes).toEqual([]);
});
test('Seller overview failure isolates order data from wallet and avoids a fabricated zero', async ({
  page,
}) => {
  const model = await setupSellerUsability(page);
  model.fail.add('/sellers/' + sampleRequest.sellerId + '/preorders');
  await page.goto('/seller');
  await expect(page.locator('#main').getByRole('alert')).toContainText('Một số dữ liệu');
  await expect(page.getByText('1.250.000', { exact: false })).toBeVisible();
  await expect(page.getByRole('link', { name: /Chờ báo giá/ })).toContainText('—');
  expect(model.writes).toEqual([]);
});
test('Seller loading keeps counts pending until the API replies', async ({ page }) => {
  const model = await setupSellerUsability(page);
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/sellers/*/preorders?*', async (route) => {
    await gate;
    await route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  try {
    await page.goto('/seller');
    await expect(page.getByText('Đang tải đơn đặt hoa…', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Chờ báo giá/ })).toContainText('…');
  } finally {
    release();
  }
  expect(model.writes).toEqual([]);
});

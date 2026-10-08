import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**/wallet', (route) =>
    route.fulfill({
      json: {
        balance: null,
        entries: [],
        bankConfigured: false,
        minimumWithdrawal: 50000,
        withdrawals: [],
        hasMoreEntries: false,
        hasMoreWithdrawals: false,
      },
    }),
  );
  await page.route('**/api/**/slots', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/**/subscriptions', (route) =>
    route.fulfill({ json: { package: null, subscriptions: [] } }),
  );
});
const sellerId = '20000000-0000-0000-0000-000000000001';
const product = {
  id: '30000000-0000-0000-0000-000000000001',
  name: 'Hoa hồng dịu dàng',
  description: 'Bó hoa dành cho người thương.',
  price: 350000,
  tags: [],
  status: 'ACTIVE',
  shelfLifeHours: 48,
};
test('Product search, validation, price and status commands, accessible editor', async ({
  page,
}) => {
  let price = 350000;
  let status = 'ACTIVE';
  await page.setViewportSize({ width: 390, height: 950 });
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'user',
        name: 'Shop',
        role: 'SELLER',
        sellerId,
        sellerStatus: 'ACTIVE',
        packageExpiresAt: '2099-01-01',
      },
    }),
  );
  await page.route('**/api/**/products', (route) =>
    route.fulfill({ json: [{ ...product, price, status }] }),
  );
  await page.route('**/flows/update_product_price', (route) => {
    expect(route.request().postDataJSON()).toEqual({ p_product: product.id, p_price: 420000 });
    price = 420000;
    return route.fulfill({ json: { result: null } });
  });
  await page.route('**/flows/set_product_status', (route) => {
    expect(route.request().postDataJSON()).toEqual({ p_product: product.id, p_status: 'INACTIVE' });
    status = 'INACTIVE';
    return route.fulfill({ json: { result: null } });
  });
  await page.goto('/seller/products');
  await page.getByLabel('Tìm tên sản phẩm').fill('không tìm thấy');
  await expect(page.getByText('Không có sản phẩm phù hợp.', { exact: false })).toBeVisible();
  await page.getByLabel('Tìm tên sản phẩm').clear();
  await page.locator('.product-list summary').click();
  await page.getByLabel('Giá bán (đồng)').fill('0');
  await page.getByRole('button', { name: 'Lưu giá', exact: true }).click();
  await expect(page.getByText('Giá bán phải lớn hơn 0.')).toBeVisible();
  await page.getByLabel('Giá bán (đồng)').fill('420000');
  await page.getByRole('button', { name: 'Lưu giá', exact: true }).click();
  await expect(page.getByText('Đã lưu giá bán.')).toBeVisible();
  await expect(page.locator('.product-price')).toContainText('420.000');
  await page.getByLabel('Trạng thái sản phẩm', { exact: true }).selectOption('INACTIVE');
  await page.getByRole('button', { name: 'Lưu trạng thái' }).click();
  await expect(page.locator('.product-status')).toHaveText('Ngừng bán');
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.impeccable/review/portal-products-390.png', fullPage: true });
});

test('Expired shop can read products but editor is disabled', async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'user',
        name: 'Shop',
        role: 'SELLER',
        sellerId,
        sellerStatus: 'PAST_DUE',
        packageExpiresAt: '2026-01-01',
      },
    }),
  );
  await page.route('**/api/**/products', (route) => route.fulfill({ json: [product] }));
  await page.goto('/seller/products');
  await page.locator('.product-list summary').click();
  await expect(page.getByLabel('Giá bán (đồng)')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Lưu trạng thái' })).toBeDisabled();
});

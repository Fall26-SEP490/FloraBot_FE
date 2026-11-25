import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'user',
        name: 'Shop hoa',
        role: 'SELLER',
        sellerId: 'seller-a',
        sellerStatus: 'ACTIVE',
        packageExpiresAt: '2099-12-31',
      },
    }),
  );
  await page.route('**/api/**/products', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/**/subscriptions', (route) =>
    route.fulfill({ json: { package: null, subscriptions: [] } }),
  );
  await page.route('**/api/**/slots', (route) => route.fulfill({ json: [] }));
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
});

for (const width of [390, 1440]) {
  test(`Accessory restock confirms once and blocks uncertain resubmission ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    const item = {
      id: '30000000-0000-0000-0000-000000000099',
      name: 'Thiệp hoa',
      price: 25000,
      stockQuantity: 0,
      status: 'INACTIVE',
      kioskId: null,
      scope: 'SHOP',
    };
    let writes = 0;
    await page.route('**/api/sellers/seller-a/accessories?scope=SHOP', (route) =>
      route.fulfill({ json: [item] }),
    );
    await page.route('**/flows/restock_accessory', (route) => {
      writes++;
      expect(route.request().postDataJSON()).toEqual({ p_accessory: item.id, p_qty: 7 });
      item.stockQuantity += 7;
      return writes === 1 ? route.fulfill({ json: { result: null } }) : route.abort();
    });
    await page.goto('/seller/accessories');
    const section = page.getByRole('dialog', { name: 'Thiệp hoa', exact: true });
    await page.getByRole('button', { name: 'Xem phụ kiện Thiệp hoa', exact: true }).click();
    await expect(section.getByText('Phụ kiện đang tắt bán', { exact: true })).toBeVisible();
    await expect(section.getByRole('combobox')).toHaveCount(0);
    await section.getByRole('button', { name: 'Kiểm tra số lượng' }).click();
    await expect(section.getByLabel('Số lượng bổ sung cho Thiệp hoa')).toBeFocused();
    await expect(section.getByRole('alert')).toContainText('Nhập số lượng nguyên');
    await section.getByLabel('Số lượng bổ sung cho Thiệp hoa').fill('1.5');
    await section.getByRole('button', { name: 'Kiểm tra số lượng' }).click();
    expect(writes).toBe(0);
    await section.getByLabel('Số lượng bổ sung cho Thiệp hoa').fill('7');
    await section.getByRole('button', { name: 'Kiểm tra số lượng' }).click();
    expect(writes).toBe(0);
    await section.getByRole('button', { name: 'Sửa số lượng' }).click();
    await expect(section.getByLabel('Số lượng bổ sung cho Thiệp hoa')).toBeFocused();
    await section.getByRole('button', { name: 'Kiểm tra số lượng' }).click();
    expect(
      (
        await new AxeBuilder({ page })
          .include('[role="dialog"]')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await section.screenshot({ path: `.impeccable/review/seller-accessories-${width}.png` });
    await section.getByRole('button', { name: 'Xác nhận bổ sung' }).click();
    await expect(section.getByRole('status').filter({ hasText: 'Đã bổ sung 7' })).toBeFocused();
    await expect(section.getByText('Số lượng trong kho:', { exact: false })).toContainText('7');
    await section.getByLabel('Số lượng bổ sung cho Thiệp hoa').fill('7');
    await section.getByRole('button', { name: 'Kiểm tra số lượng' }).click();
    await section.getByRole('button', { name: 'Xác nhận bổ sung' }).click();
    await expect(section.getByRole('alert')).toContainText('Không gửi lại cùng số lượng');
    await expect(section.getByRole('button', { name: 'Kiểm tra số lượng' })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(section).toBeHidden();
    await page.getByRole('button', { name: 'Xem phụ kiện Thiệp hoa', exact: true }).click();
    await expect(section.getByRole('button', { name: 'Kiểm tra số lượng' })).toBeDisabled();
    await expect(section.getByText('Số lượng trong kho:', { exact: false })).toContainText('14');
    expect(writes).toBe(2);
  });
}

test('Accessory inventory handles empty state and retry after failure', async ({ page }) => {
  let reads = 0;
  await page.route('**/api/**/accessories?scope=SHOP', (route) =>
    ++reads === 1 ? route.fulfill({ status: 503, json: {} }) : route.fulfill({ json: [] }),
  );
  await page.goto('/seller/accessories');
  const section = page.getByRole('region', { name: 'Kho phụ kiện', exact: true });
  await expect(section.getByRole('alert')).toContainText('Chưa tải được tồn mới nhất');
  await section.getByRole('button', { name: 'Thử lại' }).click();
  await expect(section.getByText('Chưa có phụ kiện')).toBeVisible();
});

test('Seller automatically sees a created accessory after reloading', async ({ page }) => {
  const item = {
    id: 'accessory-new',
    name: 'Nơ lụa',
    price: 15000,
    stockQuantity: 0,
    status: 'ACTIVE',
    kioskId: null,
    scope: 'SHOP',
  };
  let writes = 0;
  await page.route(/\/api\/sellers\/seller-a\/accessories(?:\?scope=SHOP)?$/, (route) => {
    if (route.request().method() === 'POST') {
      expect(route.request().postDataJSON()).toEqual({
        name: item.name,
        price: item.price,
      });
      writes++;
      return route.fulfill({ status: 201, json: { id: item.id } });
    }
    expect(new URL(route.request().url()).searchParams.get('scope')).toBe('SHOP');
    return route.fulfill({ json: writes ? [item] : [] });
  });

  await page.goto('/seller/accessories');
  const section = page.getByRole('region', { name: 'Kho phụ kiện', exact: true });
  await expect(section.getByText('Chưa có phụ kiện')).toBeVisible();
  await section.getByRole('button', { name: 'Thêm phụ kiện', exact: true }).click();
  const create = page.getByRole('dialog', { name: 'Thêm phụ kiện', exact: true });
  await expect(create.getByRole('combobox')).toHaveCount(0);
  await create.getByLabel('Tên phụ kiện', { exact: true }).fill(item.name);
  await create.getByLabel('Giá bán (VND)').fill(String(item.price));
  await create.getByRole('button', { name: 'Tạo phụ kiện' }).click();
  await expect(
    section.getByRole('button', { name: `Xem phụ kiện ${item.name}`, exact: true }),
  ).toBeVisible();

  await page.reload();
  await expect(
    section.getByRole('button', { name: `Xem phụ kiện ${item.name}`, exact: true }),
  ).toBeVisible();
  await expect(
    section.getByRole('button', { name: `Xem phụ kiện ${item.name}`, exact: true }),
  ).toContainText('0');
  expect(writes).toBe(1);
});

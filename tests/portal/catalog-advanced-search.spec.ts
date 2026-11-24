import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function mockCatalog(page: Page) {
  const products = [
    {
      name: 'Bó lụa An Nhiên',
      tags: ['Hoa hồng', 'color:pink', 'occasion:birthday', 'material:fabric', 'Dáng vintage'],
      price: 90000,
      preorderAvailable: true,
    },
    {
      name: 'Bó lụa Thanh Hà',
      tags: ['flower:rose', 'color:white'],
      occasion: 'Sinh nhật',
      price: 200000,
      preorderAvailable: false,
    },
    {
      name: 'Bó len Vườn Nhỏ',
      tags: ['flower:tulip', 'color:pink', 'occasion:GRADUATION'],
      price: 222222,
      preorderAvailable: true,
    },
  ].map((product, index) => ({
    ...product,
    productId: 'product-' + index,
    sellerId: 'seller-a',
    shopName: 'Shop Hoa',
    kioskId: 'kiosk-a',
    kioskName: 'Kiosk HCM 09',
    address: '',
    description: 'Hoa giả',
    photo: null,
    bouquets: [],
    zone: 'PREORDER',
  }));
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: {} }));
  await page.route('**/api/shop/catalog?*', (route) =>
    route.fulfill({ json: { items: products, page: 1, hasMore: false } }),
  );
}

for (const width of [390, 1440]) {
  test(`Quick purchase, budget and occasion filters work together at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockCatalog(page);
    await page.goto('/dat-hoa');
    const cards = page.locator('.flower-card');
    await expect(cards).toHaveCount(3);

    const sidebar = page.getByRole('complementary', { name: 'Bộ lọc sản phẩm' });
    if (width <= 960) await page.getByRole('button', { name: 'Bộ lọc', exact: true }).click();
    const available = sidebar.getByRole('checkbox', { name: 'Còn nhận đặt trước', exact: true });
    const prices = sidebar.getByRole('group', { name: 'Khoảng giá', exact: true });
    const occasions = sidebar.getByRole('group', { name: 'Dịp tặng', exact: true });
    await expect(available).not.toBeChecked();
    await expect(prices.getByRole('radio')).toHaveCount(4);
    await expect(occasions.getByRole('checkbox')).toHaveCount(2);
    await available.click();
    await expect(page).toHaveURL(/preorder=1/);
    await expect(available).toBeChecked();
    await expect(cards).toHaveCount(2);

    await prices.getByRole('radio', { name: /^100\.000 – 200\.000 đ/ }).click();
    await expect(cards).toHaveCount(0);
    await prices.getByRole('radio', { name: /^Dưới 100\.000 đ/ }).click();
    await expect(page).toHaveURL(/price=under100/);
    await occasions.getByRole('checkbox', { name: /Sinh nhật/ }).click();
    await expect(page).toHaveURL(/tag=occasion%3Abirthday/);
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Bó lụa An Nhiên');

    if (width <= 960) await page.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
    const advanced = page.locator('details.catalog-advanced-search');
    await advanced.getByText('Tìm kiếm nâng cao', { exact: true }).click();
    await expect(advanced.getByRole('checkbox', { name: 'Sinh nhật', exact: true })).toBeChecked();
    await page.reload();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Bó lụa An Nhiên');

    if (width <= 960) await page.getByRole('button', { name: 'Bộ lọc', exact: true }).click();
    await sidebar.getByRole('button', { name: 'Đặt lại bộ lọc' }).click();
    await expect(available).not.toBeChecked();
    await expect(cards).toHaveCount(3);
    await expect(page).toHaveURL(/\/dat-hoa$/);
  });

  test(`Advanced tag filters open on demand at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockCatalog(page);

    await page.goto('/dat-hoa');
    await expect(page.locator('.flower-card')).toHaveCount(3);
    const advanced = page.locator('details.catalog-advanced-search');
    const trigger = advanced.getByText('Tìm kiếm nâng cao', { exact: true });
    const flowerTypes = advanced.getByRole('group', { name: 'Loại hoa', exact: true });
    await expect(trigger).toBeVisible();
    await expect(flowerTypes).toBeHidden();

    const basic = page.getByRole('complementary', { name: 'Bộ lọc sản phẩm' });
    if (width <= 960) {
      await page.getByRole('button', { name: 'Bộ lọc', exact: true }).click();
    }
    await expect(basic.getByRole('combobox', { name: 'Loại hoa' })).toBeVisible();
    await expect(basic.getByRole('group', { name: 'Hình thức nhận hoa', exact: true })).toHaveCount(
      0,
    );
    if (width <= 960) await page.keyboard.press('Escape');

    const search = page.getByRole('searchbox');
    const submitSearch = () =>
      width <= 960
        ? page.getByRole('button', { name: 'Tìm hoa', exact: true }).click()
        : search.press('Enter');

    await submitSearch();
    await expect(flowerTypes).toBeHidden();
    await trigger.press('Enter');
    await expect(flowerTypes).toBeVisible();
    await submitSearch();
    await expect(flowerTypes).toBeHidden();
    await trigger.click();
    await expect(flowerTypes).toBeVisible();

    await flowerTypes.getByRole('checkbox', { name: 'Hoa hồng', exact: true }).check();
    await advanced.getByRole('button', { name: 'Tìm theo tag đã chọn' }).click();
    await expect(page).toHaveURL(/tag=flower%3Arose/);
    await expect(search).toHaveValue('');
    await expect(page.locator('.flower-card')).toHaveCount(2);
    await expect(flowerTypes).toBeHidden();

    await page.goto('/dat-hoa');
    await expect(page.locator('.flower-card')).toHaveCount(3);
    await search.fill('Bó lụa');
    await expect(trigger).toBeVisible();
    await expect(flowerTypes).toBeHidden();
    await search.press('Enter');
    await expect(page.locator('.flower-card')).toHaveCount(2);
    await expect(advanced).toBeVisible();
    await expect(advanced.getByRole('group', { name: 'Màu sắc' })).toBeHidden();

    await trigger.click();
    await advanced.getByRole('checkbox', { name: 'Hồng', exact: true }).check();
    await advanced.getByRole('button', { name: 'Tìm theo tag đã chọn' }).click();
    await expect(page.locator('.flower-card')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Bó lụa An Nhiên' })).toBeVisible();
    await expect(search).toHaveValue('Bó lụa');
    await expect(advanced).toBeVisible();
    await page.getByRole('button', { name: 'Bỏ tag Hồng', exact: true }).click();
    await expect(page.locator('.flower-card')).toHaveCount(2);

    await page.getByRole('button', { name: 'Xóa nội dung tìm kiếm' }).click();
    await expect(trigger).toBeVisible();
    await expect(flowerTypes).toBeHidden();
    await expect(page.locator('.flower-card')).toHaveCount(3);

    await search.fill('mau-khong-ton-tai');
    await search.press('Enter');
    await expect(page.getByRole('heading', { name: /Không tìm thấy/ })).toBeVisible();
    await expect(advanced.getByRole('group', { name: 'Màu sắc' })).toBeHidden();
    await trigger.click();
    for (const label of ['Loại hoa', 'Màu sắc', 'Dịp tặng', 'Chất liệu', 'Tag khác']) {
      await expect(advanced.getByRole('group', { name: label, exact: true })).toBeVisible();
    }
    await expect(advanced.getByRole('checkbox', { name: 'Hoa ly', exact: true })).toBeVisible();
    await expect(
      advanced.getByRole('checkbox', { name: 'Ngày Nhà giáo', exact: true }),
    ).toBeVisible();
    await expect(
      advanced.getByRole('checkbox', { name: 'Dáng vintage', exact: true }),
    ).toBeVisible();
    const axe = await new AxeBuilder({ page }).include('.catalog-advanced-search').analyze();
    expect(axe.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    for (const tag of ['Hoa hồng', 'Hồng', 'Sinh nhật']) {
      await advanced.getByRole('checkbox', { name: tag, exact: true }).check();
    }
    await advanced.getByRole('button', { name: 'Tìm theo tag đã chọn' }).click();
    await expect(page).toHaveURL(/tag=occasion%3Abirthday/);
    await expect(page).not.toHaveURL(/search=/);
    await expect(search).toHaveValue('');
    await expect(page.locator('.flower-card')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Bó lụa An Nhiên' })).toBeVisible();
    await expect(advanced).toBeVisible();

    await page.reload();
    await expect(page.locator('.flower-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Bỏ tag Hồng', exact: true }).click();
    await expect(page.locator('.flower-card')).toHaveCount(2);
  });
}

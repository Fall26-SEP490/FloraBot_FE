import { expect, test, type Page } from '@playwright/test';

const sellerId = '20000000-0000-0000-0000-000000000001';
const otherSeller = '20000000-0000-0000-0000-000000000002';
const kioskId = '40000000-0000-0000-0000-000000000001';
const shopPath = `/dat-hoa/cua-hang/${sellerId}`;
const flowers = Array.from({ length: 14 }, (_, index) => {
  const number = String(index + 1).padStart(2, '0');
  return {
    productId: '30000000-0000-0000-0000-0000000000' + number,
    sellerId,
    shopName: 'Tiệm Hoa An Nhiên',
    kioskId,
    kioskName: 'Kiosk A',
    address: '',
    description: '',
    name: 'Mẫu hoa ' + number,
    price: 100000,
    photo: null,
    bouquets: [],
    zone: 'PREORDER',
    preorderAvailable: index !== 0,
  };
});

async function mockCatalog(page: Page) {
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/me') return route.fulfill({ status: 401, json: {} });
    if (url.pathname === '/api/shop/catalog') {
      const pageNumber = Number(url.searchParams.get('page'));
      return route.fulfill({
        json: {
          items:
            pageNumber === 1
              ? [
                  flowers[0],
                  { ...flowers[0], kioskId: '40000000-0000-0000-0000-000000000002' },
                  {
                    ...flowers[0],
                    productId: '30000000-0000-0000-0000-000000000099',
                    sellerId: otherSeller,
                    name: 'Sản phẩm shop trùng tên',
                  },
                ]
              : flowers.slice(1),
          hasMore: pageNumber === 1,
          page: pageNumber,
        },
      });
    }
    if (url.pathname.endsWith('/reviews')) {
      return route.fulfill({
        json: {
          productAverage: 4,
          productCount: 1,
          shopAverage: 5,
          shopCount: 8,
          items: [],
          hasMore: false,
        },
      });
    }
    return route.fulfill({ json: null });
  });
}

for (const width of [390, 1440]) {
  test(`guests can open a shop from a product and browse only that seller at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 900 });
    await mockCatalog(page);
    await page.goto(`/dat-hoa/${flowers[0].productId}/${kioskId}?zone=PREORDER`);
    const alternate = page.getByRole('link', { name: 'Xem mẫu còn nhận đặt của shop' });
    await expect(alternate).toHaveAttribute('href', shopPath + '?preorder=1');
    await expect(page.getByRole('button', { name: 'Chat với shop', exact: true })).toBeVisible();
    if (width === 390) {
      await expect(
        page.locator('.site-support-label').filter({ hasText: 'Tư vấn FloraBot' }),
      ).toBeHidden();
      await expect(
        page.getByRole('button', { name: 'Tư vấn FloraBot', exact: true }),
      ).toBeVisible();
    }
    await alternate.click();
    await expect(page).toHaveURL(shopPath + '?preorder=1', { timeout: 20_000 });
    await expect(page.locator('.flower-card').first()).toContainText('Mẫu hoa 02');
    await expect(page.getByText('Hết hàng', { exact: true })).toHaveCount(0);
    await page.goBack();
    await page.getByRole('link', { name: 'Xem cửa hàng Tiệm Hoa An Nhiên' }).click();
    await expect(page).toHaveURL(shopPath, { timeout: 20_000 });
    const header = page.locator('.catalog-store-header');
    await expect(header.getByRole('heading', { name: 'Tiệm Hoa An Nhiên' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(header.getByText('14 mẫu hoa')).toBeVisible();
    await expect(header.getByRole('img', { name: '5 trên 5 sao' })).toBeVisible();
    await expect(header.getByText('8 đánh giá')).toBeVisible();
    const cards = page.locator('.flower-card');
    await expect(cards).toHaveCount(12);
    await expect(cards.first()).toContainText('Mẫu hoa 02');
    if (width === 390) {
      const filter = (await page
        .getByRole('button', { name: 'Bộ lọc', exact: true })
        .boundingBox())!;
      const sort = (await page.getByRole('combobox', { name: 'Sắp xếp sản phẩm' }).boundingBox())!;
      expect(Math.abs(filter.y - sort.y)).toBeLessThan(4);
      const first = (await cards.first().boundingBox())!;
      const second = (await cards.nth(1).boundingBox())!;
      expect(first.y).toBe(second.y);
      expect(second.x).toBeGreaterThan(first.x);
    }
    await expect(page.getByText('Sản phẩm shop trùng tên')).toHaveCount(0);

    await page.getByRole('button', { name: 'Trang sau' }).click();
    await expect(page).toHaveURL(shopPath + '?page=2');
    await expect(cards).toHaveCount(2);
    await expect(cards.first()).toContainText('Mẫu hoa 14');
    await expect(cards.last()).toContainText('Hết hàng');

    const search = page.getByRole('searchbox', { name: 'Tìm mẫu hoa trong shop' });
    await search.fill('Mẫu hoa 13');
    await search.press('Enter');
    await expect(cards).toHaveCount(1);
    const filteredUrl = page.url();
    await expect(page).toHaveURL(/cua-hang\/[^?]+\?search=/);
    await cards.getByRole('link', { name: 'Mẫu hoa 13', exact: true }).click();
    await page.getByRole('link', { name: 'Quay lại cửa hàng', exact: true }).click();
    await expect(page).toHaveURL(filteredUrl);
    await expect(cards).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('a shop without public products shows a path back to the catalog', async ({ page }) => {
  await mockCatalog(page);
  await page.goto('/dat-hoa/cua-hang/20000000-0000-0000-0000-000000000003');
  await expect(page.getByRole('heading', { name: 'Chưa có mẫu hoa công khai' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Xem danh mục hoa' })).toHaveAttribute(
    'href',
    '/dat-hoa',
  );
  await expect(page.locator('.flower-card')).toHaveCount(0);
});

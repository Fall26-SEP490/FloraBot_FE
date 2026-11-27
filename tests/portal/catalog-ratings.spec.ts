import { expect, test, type Page } from '@playwright/test';
import { chooseSelect } from '../fixtures/select';

const products = Array.from({ length: 17 }, (_, index) => {
  const id = index + 1;
  const seller = id === 13 || id === 16 ? 'b' : id === 15 ? 'c' : id === 17 ? 'd' : 'a';
  const name = `Mẫu hoa ${String(id).padStart(2, '0')}`;
  return {
    productId: `product-${id}`,
    sellerId: `seller-${seller}`,
    shopName: `Shop ${seller.toUpperCase()}`,
    kioskId: 'kiosk-a',
    kioskName: 'Tủ A',
    address: '',
    description: null,
    price: 100000,
    photo: null,
    bouquets: [],
    zone: 'PREORDER',
    preorderAvailable: true,
    name,
  };
});

async function mockCatalog(page: Page, isUnavailable?: (id: string) => boolean) {
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: {} }));
  await page.route('**/api/shop/catalog?*', (route) => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get('page'));
    return route.fulfill({
      json: {
        items: pageNumber === 1 ? products.slice(0, 12) : products.slice(12),
        page: pageNumber,
        hasMore: pageNumber === 1,
      },
    });
  });
  await page.route('**/api/shop/products/*/reviews?*', (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-2)!;
    const product = products.find(({ productId }) => id === productId)!;
    if (isUnavailable?.(id)) return route.fulfill({ status: 503, json: {} });
    const productAverage = { 'product-13': 3, 'product-14': 4, 'product-15': 5 }[id] ?? null;
    const shopAverage =
      { 'seller-a': 4.75, 'seller-b': 5, 'seller-c': 3 }[product.sellerId] ?? null;
    return route.fulfill({
      json: {
        productAverage,
        productCount: productAverage === null ? 0 : 2,
        shopAverage,
        shopCount: shopAverage === null ? 0 : 8,
        items: [],
        hasMore: false,
      },
    });
  });
}

for (const width of [390, 1440]) {
  test(`catalog filters all pages by independent product and shop ratings at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await mockCatalog(page);
    await page.goto('/dat-hoa');
    const cards = page.locator('.flower-card-title');
    const sidebar = page.getByRole('complementary', { name: 'Bộ lọc sản phẩm' });
    await expect(cards).toHaveCount(12);
    if (width === 390) await page.getByRole('button', { name: 'Bộ lọc', exact: true }).click();

    await chooseSelect(sidebar, 'Đánh giá shop', '5');
    await expect(cards).toHaveText(['Mẫu hoa 13', 'Mẫu hoa 16']);
    await expect(page.locator('.flower-card-shop-rating')).toHaveCount(0);
    await expect(page.locator('.flower-card-price-label')).toHaveCount(0);
    await expect(page.locator('.flower-card-title').first()).toHaveCSS('-webkit-line-clamp', '2');
    await expect(page.locator('.flower-card-rating').last()).toHaveText('Chưa có đánh giá');

    await chooseSelect(sidebar, 'Đánh giá sản phẩm', '3');
    await expect(cards).toHaveText(['Mẫu hoa 13']);
    await chooseSelect(sidebar, 'Đánh giá shop', 'all');
    await expect(cards).toHaveText(['Mẫu hoa 13', 'Mẫu hoa 14', 'Mẫu hoa 15']);
    await chooseSelect(sidebar, 'Đánh giá sản phẩm', '4');
    await expect(cards).toHaveText(['Mẫu hoa 14', 'Mẫu hoa 15']);
    await chooseSelect(sidebar, 'Đánh giá shop', '4');
    await expect(cards).toHaveText(['Mẫu hoa 14']);
    if (width === 390) await page.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();

    await page.reload();
    await expect(cards).toHaveText(['Mẫu hoa 14']);
    await page.getByRole('button', { name: 'Bỏ lọc Shop · Từ 4 sao' }).click();
    await expect(cards).toHaveText(['Mẫu hoa 14', 'Mẫu hoa 15']);
    if (width === 390) await page.getByRole('button', { name: 'Bộ lọc', exact: true }).click();
    await chooseSelect(sidebar, 'Đánh giá sản phẩm', '5');
    await expect(cards).toHaveText(['Mẫu hoa 15']);
    await sidebar.getByRole('button', { name: 'Đặt lại bộ lọc' }).click();
    await expect(cards).toHaveCount(12);
    await expect(page).toHaveURL(/\/dat-hoa$/);
  });
}

test('catalog can retry a missing rating lookup without showing an empty result', async ({
  page,
}) => {
  let available = false;
  await mockCatalog(page, (id) => id === 'product-15' && !available);
  await page.goto('/dat-hoa?productRating=5');
  await expect(page.getByRole('heading', { name: 'Chưa tải được đánh giá' })).toBeVisible();
  available = true;
  await page.getByRole('button', { name: 'Tải lại đánh giá' }).click();
  await expect(page.locator('.flower-card-title')).toHaveText(['Mẫu hoa 15']);
});

import { chooseOption } from '../fixtures/select';
import { expect, test } from '@playwright/test';

const farKiosk = '40000000-0000-0000-0000-000000000001';
const nearKiosk = '40000000-0000-0000-0000-000000000002';
const unknownKiosk = '40000000-0000-0000-0000-000000000003';
const fullKiosk = '40000000-0000-0000-0000-000000000004';

function product(index: number, kioskId = farKiosk, sellerId = 'far-shop') {
  return {
    productId: `product-${index}`,
    sellerId,
    kioskId,
    name: `Hoa ${String(index).padStart(2, '0')}`,
    shopName: sellerId === 'near-shop' ? 'Shop gần' : 'Shop xa',
    kioskName: kioskId,
    address: 'Địa chỉ kiểm thử',
    description: null,
    photo: null,
    price: 100000 + index,
    bouquets: [],
    zone: 'PREORDER',
    preorderAvailable: true,
  };
}

for (const denied of [false, true]) {
  test(`catalog sorts eligible kiosks across shops before pagination, location denied=${denied}`, async ({
    page,
  }) => {
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 10.77, longitude: 106.68 });
    if (denied) {
      await page.addInitScript(() => {
        Object.defineProperty(navigator, 'geolocation', {
          value: {
            getCurrentPosition: (_ok: unknown, fail: (error: { code: number }) => void) =>
              fail({ code: 1 }),
          },
          configurable: true,
        });
      });
    }
    await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
    const first = Array.from({ length: 12 }, (_, i) => product(i));
    const later = [
      product(12, nearKiosk, 'near-shop'),
      product(13, nearKiosk, 'near-shop'),
      product(14, unknownKiosk),
    ];
    const pages: number[] = [];
    await page.route('**/api/**', (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/auth/me') return route.fulfill({ json: null });
      if (url.pathname === '/api/kiosks') {
        return route.fulfill({
          json: [
            { id: farKiosk, name: 'Tủ xa', latitude: 11.5, longitude: 107.5 },
            { id: nearKiosk, name: 'Tủ gần', latitude: 10.771, longitude: 106.681 },
            { id: unknownKiosk, name: 'Tủ chưa có tọa độ', latitude: null, longitude: null },
            { id: fullKiosk, name: 'Tủ đầy', latitude: 10.77, longitude: 106.68 },
          ],
        });
      }
      if (url.pathname === '/api/shop/catalog') {
        expect(url.searchParams.has('availablePreorderOnly')).toBe(false);
        const current = Number(url.searchParams.get('page'));
        pages.push(current);
        return route.fulfill({
          json: {
            items: current === 1 ? first : later,
            page: current,
            hasMore: current === 1,
          },
        });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto('/dat-hoa');
    const cards = page.locator('.flower-card');
    await expect(cards).toHaveCount(12);
    expect(pages).toContain(2);
    await expect(cards.first()).toContainText('Hoa 00');
    await expect(cards.locator('.flower-card-distance')).toHaveCount(0);
    const sort = page.getByRole('combobox', { name: 'Sắp xếp sản phẩm' });
    await page.getByRole('button', { name: 'Xếp hoa gần tôi', exact: true }).click();
    if (denied) {
      await expect(page.getByText(/Chưa lấy được vị trí hoặc tọa độ kiosk/)).toBeVisible();
      await expect(cards.first()).toContainText('Hoa 00');
      await expect(cards.locator('.flower-card-distance')).toHaveCount(0);
      await chooseOption(sort, 'price-desc');
      await expect(cards.first()).toContainText('Hoa 14');
    } else {
      await expect(sort).toContainText('Khoảng cách: Gần nhất');
      await expect(cards.nth(0)).toContainText('Shop gần');
      await expect(cards.nth(1)).toContainText('Shop gần');
      await expect(cards.nth(2)).toContainText('Shop xa');
      await expect(cards.first().locator('.flower-card-distance')).toContainText('156 m');
      await expect(cards.nth(2).locator('.flower-card-distance')).toContainText(/\d+(,\d+)? km/);
      await expect(page.getByText('Tủ đầy', { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
      await expect(cards).toHaveCount(3);
      await expect(cards.last()).toContainText('Hoa 14');
      await expect(cards.last().locator('.flower-card-distance')).toHaveCount(0);
      await chooseOption(sort, 'price-desc');
      await expect(cards.locator('.flower-card-distance')).toHaveCount(0);
    }
  });
}

test('catalog shows product reviews for preorder and keeps only a chip for a kiosk deep link', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 950 });
  const reviewed = { ...product(1, nearKiosk), kioskName: 'Tủ gần' };
  const walkIn = { ...reviewed, name: 'Mẫu bán tại tủ', zone: 'WALK_IN' };
  const noReviews = { ...product(2), kioskName: 'Tủ xa' };
  const reviewRequests: string[] = [];
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/shop/catalog') {
      return route.fulfill({
        json: { items: [reviewed, walkIn, noReviews], page: 1, hasMore: false },
      });
    }
    if (url.pathname.endsWith('/reviews')) {
      const productId = url.pathname.split('/').at(-2)!;
      reviewRequests.push(productId);
      return route.fulfill({
        json: {
          productAverage: productId === reviewed.productId ? '4.25' : null,
          productCount: productId === reviewed.productId ? '7' : 0,
          shopAverage: 5,
          shopCount: 45,
          items: [],
          hasMore: false,
        },
      });
    }
    return route.fulfill({ json: null });
  });

  await page.goto('/dat-hoa?kiosk=T%E1%BB%A7+g%E1%BA%A7n');
  const cards = page.locator('.flower-card');
  await expect(cards).toHaveCount(2);
  await expect(page.getByRole('group', { name: 'Tủ nhận hoa', exact: true })).toHaveCount(0);
  const fulfillment = page.getByRole('group', { name: 'Hình thức nhận hoa', exact: true });
  await expect(fulfillment.getByRole('radio', { name: /Mua trực tiếp tại tủ/ })).toBeVisible();
  await expect(fulfillment.getByRole('radio', { name: /Đặt trước qua web/ })).toBeVisible();
  const score = cards.first().locator('.flower-card-rating');
  await expect(score).toHaveText(/4,25\/5\s*\(7 đánh giá\)/);
  await expect(
    cards.filter({ hasText: 'Mẫu bán tại tủ' }).locator('.flower-card-rating'),
  ).toHaveCount(0);
  expect(reviewRequests).toEqual([reviewed.productId]);

  await page.getByRole('button', { name: 'Bỏ lọc theo tủ Tủ gần', exact: true }).click();
  await expect(cards).toHaveCount(3);
  await expect(cards.filter({ hasText: noReviews.name }).locator('.flower-card-rating')).toHaveText(
    'Chưa có đánh giá',
  );
  expect(reviewRequests).toEqual([reviewed.productId, noReviews.productId]);
});

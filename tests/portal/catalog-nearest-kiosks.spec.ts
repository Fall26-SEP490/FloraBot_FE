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
        expect(url.searchParams.get('availablePreorderOnly')).toBe('true');
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
    await page.getByRole('button', { name: 'Xếp hoa gần tôi', exact: true }).click();
    if (denied) {
      await expect(page.getByText(/Chưa lấy được vị trí hoặc tọa độ kiosk/)).toBeVisible();
      await expect(cards.first()).toContainText('Hoa 00');
      await page.getByLabel('Sắp xếp sản phẩm').selectOption('price-desc');
      await expect(cards.first()).toContainText('Hoa 14');
    } else {
      await expect(page.getByLabel('Sắp xếp sản phẩm')).toHaveValue('nearest');
      await expect(cards.nth(0)).toContainText('Shop gần');
      await expect(cards.nth(1)).toContainText('Shop gần');
      await expect(cards.nth(2)).toContainText('Shop xa');
      await expect(page.getByText('Tủ đầy', { exact: true })).toHaveCount(0);
      await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
      await expect(cards).toHaveCount(3);
      await expect(cards.last()).toContainText('Hoa 14');
    }
  });
}

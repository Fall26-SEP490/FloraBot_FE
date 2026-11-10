import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const flower = {
  productId: '30000000-0000-0000-0000-000000000001',
  sellerId: '20000000-0000-0000-0000-000000000001',
  kioskId: '40000000-0000-0000-0000-000000000001',
  name: 'Mẫu API hồng pastel',
  shopName: 'Shop API An Nhiên',
  kioskName: 'Tủ API Nguyễn Huệ',
  address: '12 Nguyễn Huệ',
  description: 'Mô tả chỉ cần xem ở chi tiết sản phẩm.',
  price: 245000,
  photo: '/images/floral-white-online.webp',
  bouquets: [],
  zone: 'PREORDER',
};
async function setup(page: Page) {
  const state = { status: 200, empty: false, pages: [] as number[], writes: [] as string[] };
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() !== 'GET') {
      state.writes.push(url.pathname);
      return route.abort();
    }
    if (url.pathname === '/api/auth/me')
      return route.fulfill({
        json: { id: 'customer-storefront-test', name: 'Khách test', role: 'CUSTOMER' },
      });
    if (url.pathname === '/api/shop/catalog') {
      const pageNumber = Number(url.searchParams.get('page') || 1);
      state.pages.push(pageNumber);
      const items = state.empty
        ? []
        : pageNumber === 1
          ? [
              flower,
              {
                ...flower,
                productId: '30000000-0000-0000-0000-000000000002',
                name: 'Mẫu API chưa có ảnh',
                photo: null,
              },
            ]
          : [
              {
                ...flower,
                zone: 'WALK_IN',
                price: 250000,
              },
            ];
      return route.fulfill({
        status: state.status,
        json:
          state.status === 200
            ? { items, page: pageNumber, hasMore: !state.empty && pageNumber === 1 }
            : { detail: 'Service unavailable' },
      });
    }
    if (url.pathname === '/api/kiosk-packages' || url.pathname === '/api/kiosk-locations')
      return route.fulfill({ json: [] });
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  return state;
}
for (const width of [390, 1440]) {
  test(`Customer discovers API flowers before partner content and continues to the complete catalog at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await setup(page);
    await page.goto('/');
    const preview = page.getByRole('region', { name: 'Mẫu hoa từ các shop', exact: true });
    await expect(preview.locator('.storefront-flower')).toHaveCount(3);
    await expect(page.locator('.gift-tool, .gift-demo')).toHaveCount(0);
    await expect(preview).toContainText(flower.name);
    await expect(preview).toContainText('245.000');
    await expect(preview).toContainText(flower.shopName);
    await expect(preview).toContainText('Giá mẫu');
    await expect(preview).toContainText('Giá tại tủ');
    await expect(preview.locator('.storefront-flower-illustration')).toHaveText('Ảnh minh họa');
    await expect(preview.getByAltText('Ảnh hoa minh họa, chưa có ảnh sản phẩm')).toHaveAttribute(
      'src',
      '/images/floral-white-online.webp',
    );
    await expect(preview).not.toContainText('Bán chạy');
    const previewPosition = await preview.boundingBox();
    const partnerPosition = await page.locator('#danh-cho-shop').boundingBox();
    expect(previewPosition!.y).toBeLessThan(partnerPosition!.y);
    await expect(
      preview.getByRole('link', {
        name: `${flower.name} · Đặt trước · ${flower.kioskName}`,
        exact: true,
      }),
    ).toHaveAttribute('href', `/dat-hoa/${flower.productId}/${flower.kioskId}?zone=PREORDER`);
    const walkInCard = preview.getByRole('link', {
      name: `${flower.name} · Chỉ mua tại kiosk · ${flower.kioskName}`,
      exact: true,
    });
    await expect(walkInCard).toContainText('250.000');
    await walkInCard.click();
    await expect(page.getByRole('link', { name: 'Xem tủ để mua trực tiếp' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Yêu cầu báo giá' })).toHaveCount(0);
    await page.goBack();
    await expect(
      preview.getByRole('link', { name: 'Xem tất cả mẫu', exact: true }),
    ).toHaveAttribute('href', '/dat-hoa');
    expect(
      (
        await new AxeBuilder({ page })
          .include('#main')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: test.info().outputPath(`home-${width}.png`), fullPage: true });
    await preview.getByRole('link', { name: 'Xem tất cả mẫu', exact: true }).click();
    await expect(page).toHaveURL(/\/dat-hoa$/);
    await expect(page.locator('.flower-card')).toHaveCount(3);
    await expect(page.locator('.flower-card').first()).toContainText(flower.kioskName);
    expect(state.pages).toContain(2);
    await expect(page.getByRole('heading', { name: flower.name, exact: true })).toHaveCount(2);
    await expect(page.locator('.flower-card-desc')).toHaveCount(0);
    const card = page.locator('.flower-card').first();
    const imageBox = await card.locator('.flower-card-media').boundingBox();
    const contentBox = await card.locator('.flower-card-body').boundingBox();
    expect(contentBox!.y).toBeGreaterThanOrEqual(imageBox!.y + imageBox!.height - 1);
    if (width === 390) {
      const cards = await page.locator('.flower-card').evaluateAll((elements) =>
        elements.slice(0, 2).map((element) => ({
          x: element.getBoundingClientRect().x,
          y: element.getBoundingClientRect().y,
        })),
      );
      await page.mouse.move(0, 0);
      await expect
        .poll(async () =>
          page
            .locator('.flower-card')
            .evaluateAll((elements) =>
              Math.abs(
                elements[0].getBoundingClientRect().y - elements[1].getBoundingClientRect().y,
              ),
            ),
        )
        .toBeLessThan(1);
      expect(cards[1].x).toBeGreaterThan(cards[0].x);
    }
    expect(
      (
        await new AxeBuilder({ page })
          .include('#main')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({
      path: test.info().outputPath(`catalog-${width}.png`),
      fullPage: false,
    });
    expect(state.writes).toEqual([]);
  });
}
test('Homepage catalog failure can be retried without losing the rest of the page', async ({
  page,
}) => {
  const state = await setup(page);
  state.status = 503;
  await page.goto('/');
  const preview = page.getByRole('region', { name: 'Mẫu hoa từ các shop', exact: true });
  await expect(preview.getByRole('alert')).toContainText('Chưa tải được mẫu hoa');
  await expect(preview.locator('.storefront-flower')).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Tìm kiosk nhận hoa', exact: true })).toBeVisible();
  state.status = 200;
  await preview
    .getByRole('button', { name: 'Tải lại mẫu hoa trên trang chủ', exact: true })
    .click();
  await expect(preview.locator('.storefront-flower')).toHaveCount(3);
  expect(state.writes).toEqual([]);
});
test('Empty catalog never falls back to inspiration photos or fabricated products', async ({
  page,
}) => {
  const state = await setup(page);
  state.empty = true;
  await page.goto('/');
  const preview = page.getByRole('region', { name: 'Mẫu hoa từ các shop', exact: true });
  await expect(preview.getByRole('status')).toContainText('Hiện chưa có mẫu hoa');
  await expect(preview.locator('.storefront-flower')).toHaveCount(0);
  await expect(preview.locator('img')).toHaveCount(0);
  await expect(page.locator('#danh-cho-shop')).toBeVisible();
});
test('Loading and broken images are explicit without blocking navigation', async ({ page }) => {
  await setup(page);
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/shop/catalog?*', async (route) => {
    await gate;
    await route.fulfill({
      json: {
        items: [{ ...flower, photo: '/missing-storefront-photo-test.png' }],
        page: 1,
        hasMore: false,
      },
    });
  });
  await page.route('**/missing-storefront-photo-test.png', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await page.goto('/');
  const preview = page.getByRole('region', { name: 'Mẫu hoa từ các shop', exact: true });
  await expect(preview.getByRole('status')).toContainText('Đang tải mẫu hoa');
  await expect(preview.getByRole('link', { name: 'Xem tất cả mẫu', exact: true })).toBeVisible();
  release();
  await expect(preview.locator('.storefront-flower-illustration')).toHaveText('Ảnh minh họa');
  const fallback = preview.getByAltText('Ảnh hoa minh họa, chưa có ảnh sản phẩm');
  await expect(fallback).toHaveAttribute('src', '/images/floral-white-online.webp');
  await expect
    .poll(() => fallback.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  await expect(preview).toContainText('245.000');
});

const rentalPricing = {
  walkInAnnualPrice: 100000,
  preorderAnnualPrice: 120000,
  version: 1,
  configured: true,
  updatedAt: '2026-11-04T03:00:00Z',
  termMonths: 12,
  minSlots: 1,
  maxSlots: 50,
};
for (const status of [200, 503]) {
  test(`Missing slot pricing (${status}) keeps flowers available without inventing a price`, async ({
    page,
  }) => {
    await setup(page);
    await page.route('**/api/kiosk-packages', (route) =>
      route.fulfill({
        status,
        json:
          status === 200
            ? {
                ...rentalPricing,
                configured: false,
                walkInAnnualPrice: null,
                preorderAnnualPrice: null,
                version: 0,
                updatedAt: null,
              }
            : { detail: 'Unavailable' },
      }),
    );
    await page.goto('/');
    await expect(page.locator('#mau-hoa .storefront-flower')).toHaveCount(3);
    await expect(page.locator('#goi-thue')).toContainText(
      status === 200 ? 'Chưa có bảng giá' : 'Chưa tải được bảng giá',
    );
    await expect(
      page.locator('#goi-thue').getByRole('link', { name: 'Đăng ký thuê kiosk →' }),
    ).toHaveCount(0);
  });
}
for (const width of [390, 1440]) {
  test(`Public rental calculator shows live per-slot prices at ${width}px`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await setup(page);
    await page.route('**/api/kiosk-packages', (route) => route.fulfill({ json: rentalPricing }));
    await page.goto('/');
    const pricing = page.locator('#goi-thue');
    await expect(pricing.locator('.pricing-card')).toHaveCount(2);
    await expect(pricing).toContainText('Ô bán sẵn');
    await expect(pricing).toContainText('Ô đặt trước');
    await expect(pricing.getByRole('link', { name: 'Đăng ký thuê kiosk →' })).toHaveAttribute(
      'href',
      '/thue-kiosk',
    );
    expect(state.writes).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await pricing.scrollIntoViewIfNeeded();
    await page.screenshot({ path: info.outputPath(`slot-calculator-${width}.png`) });
  });
}

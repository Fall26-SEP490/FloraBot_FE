import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const sellerId = '20000000-0000-0000-0000-000000000001';
const productId = '30000000-0000-0000-0000-000000000001';
const shopPath = `/dat-hoa/cua-hang/${sellerId}`;
const shopName = 'Tiệm Hoa An Nhiên';
const productPhoto = `/api/shop/products/${productId}/reviews/review-1/photo`;
const reviews = Array.from({ length: 13 }, (_, index) => ({
  id: `review-${index + 1}`,
  productId,
  productName: index === 12 ? 'Mẫu hoa trước đây' : 'Bó hồng lụa',
  stars: 5,
  comment:
    index === 1
      ? null
      : index === 12
        ? 'Mình đã đặt mẫu này hồi tháng trước.'
        : 'Hoa đẹp và được gói kỹ.',
  photoUrl: index === 0 ? productPhoto : null,
  createdAt: '2026-11-20T08:00:00Z',
  reviewerName: index === 0 ? 'Nguyễn Minh Anh' : `Khách hàng ${index + 1}`,
}));

async function mockReviews(page: Page, empty = false) {
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/me') return route.fulfill({ status: 401, json: {} });
    if (url.pathname === '/api/shop/catalog') {
      return route.fulfill({
        json: {
          page: 1,
          hasMore: false,
          items: [
            {
              productId,
              sellerId,
              shopName,
              name: 'Bó hồng lụa',
              zone: 'PREORDER',
              preorderAvailable: true,
              price: 150000,
              kioskId: '40000000-0000-0000-0000-000000000001',
              kioskName: 'Tủ A',
              address: '',
              photo: null,
              description: '',
              bouquets: [],
            },
          ],
        },
      });
    }
    if (url.pathname === productPhoto) {
      return route.fulfill({
        contentType: 'image/png',
        body: Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aCfUAAAAASUVORK5CYII=',
          'base64',
        ),
      });
    }
    if (url.pathname === `/api/shop/sellers/${sellerId}/reviews`) {
      const pageNumber = Number(url.searchParams.get('page'));
      return route.fulfill({
        json: {
          sellerId,
          shopName,
          shopAverage: empty ? null : 5,
          shopCount: empty ? 0 : reviews.length,
          page: pageNumber,
          hasMore: !empty && pageNumber === 1,
          items: empty ? [] : reviews.slice((pageNumber - 1) * 12, pageNumber * 12),
        },
      });
    }
    if (url.pathname.endsWith('/reviews')) {
      return route.fulfill({
        json: { shopAverage: 5, shopCount: 13, productAverage: 5, productCount: 12, items: [] },
      });
    }
    return route.fulfill({ json: null });
  });
}

for (const width of [390, 1440]) {
  test(`store rating opens a public review grid and preserves the shop view at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 900 });
    await mockReviews(page);
    const from = shopPath + '?preorder=1';
    await page.goto(from);
    await page.getByRole('link', { name: 'Xem 13 đánh giá của cửa hàng' }).click();
    await expect(page.getByRole('heading', { name: 'Đánh giá cửa hàng' })).toBeVisible({
      timeout: 20_000,
    });
    const back = page.getByRole('link', { name: 'Quay lại cửa hàng' });
    await expect(back).toHaveAttribute('href', from);
    await expect(page.locator('.shop-reviews-summary')).toContainText('13 lượt đánh giá');
    const grid = page.getByRole('list', { name: 'Đánh giá của khách hàng' });
    const cards = grid.getByRole('article');
    await expect(cards).toHaveCount(12);
    await expect(cards.first()).toContainText('Nguyễn Minh Anh');
    await expect(cards.first().getByRole('link')).toHaveAttribute('href', productPhoto);
    if (width === 1440) {
      const card = (await cards.first().boundingBox())!;
      expect(Math.abs(card.width - card.height)).toBeLessThan(6);
    } else {
      const shortCard = (await cards.nth(1).boundingBox())!;
      expect(shortCard.height).toBeLessThan(200);
    }
    const axe = await new AxeBuilder({ page }).include('.shop-reviews-page').analyze();
    expect(axe.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('link', { name: 'Trang sau', exact: true }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('Mẫu hoa trước đây');
    await expect(page.getByRole('link', { name: 'Trang trước', exact: true })).toBeVisible();
    await back.click();
    await expect(page).toHaveURL(from);
  });
}

test('the shop review page can show a store with no reviews', async ({ page }) => {
  await mockReviews(page, true);
  await page.goto(shopPath + '/danh-gia');
  await expect(page.getByText('Cửa hàng chưa có đánh giá.', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Quay lại cửa hàng' })).toHaveAttribute(
    'href',
    shopPath,
  );
});

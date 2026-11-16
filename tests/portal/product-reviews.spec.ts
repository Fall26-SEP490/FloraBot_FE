import { expect, test } from '@playwright/test';

const productId = '30000000-0000-0000-0000-000000000001';
const kioskId = '40000000-0000-0000-0000-000000000001';
const image =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aCfUAAAAASUVORK5CYII=';

for (const zone of ['WALK_IN', 'PREORDER']) {
  test(`product detail shows tags and only PREORDER can be reviewed (${zone})`, async ({
    page,
  }) => {
    let posted = false;
    let refreshed = false;
    const path = `/api/shop/products/${productId}`;
    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/auth/me') {
        return zone === 'WALK_IN'
          ? route.fulfill({ status: 401, json: {} })
          : route.fulfill({ json: { id: 'buyer', role: 'CUSTOMER', name: 'Khách thử' } });
      }
      if (url.pathname === '/api/auth/refresh') {
        refreshed = true;
        return route.fulfill({ status: 204 });
      }
      if (url.pathname === '/api/shop/catalog') {
        return route.fulfill({
          json: {
            items: [
              {
                productId,
                kioskId,
                sellerId: 'shop',
                shopName: 'Shop test',
                name: 'Bó hồng lụa',
                description: 'Bó hồng lụa màu hồng.',
                price: 250000,
                kioskName: 'Kiosk test',
                address: 'TP. HCM',
                photo: null,
                bouquets: [],
                zone,
                preorderAvailable: true,
                tags: ['flower:rose', 'color:pink', 'Sinh nhật'],
              },
            ],
            hasMore: false,
            page: 1,
          },
        });
      }
      if (url.pathname === path + '/review-eligibility') {
        return route.fulfill({ json: { eligible: !posted } });
      }
      if (url.pathname === path + '/reviews' && route.request().method() === 'POST') {
        if (!refreshed) return route.fulfill({ status: 401, json: {} });
        expect(route.request().postDataJSON()).toEqual({
          stars: 5,
          comment: 'Màu đẹp.',
          photoBase64: image,
        });
        posted = true;
        return route.fulfill({ status: 201, json: { id: 'new' } });
      }
      if (url.pathname === path + '/reviews') {
        return route.fulfill({
          json: {
            productAverage: posted ? 5 : null,
            productCount: posted ? 1 : 0,
            shopAverage: posted ? 4 : 3,
            shopCount: posted ? 2 : 1,
            items: posted
              ? [
                  {
                    id: 'new',
                    stars: 5,
                    comment: 'Màu đẹp.',
                    photoUrl: path + '/reviews/new/photo',
                    createdAt: '2026-11-17T00:00:00Z',
                  },
                ]
              : [],
            hasMore: false,
          },
        });
      }
      if (url.pathname === path + '/reviews/new/photo') {
        return route.fulfill({ contentType: 'image/png', body: Buffer.from(image, 'base64') });
      }
      return route.fulfill({ json: [] });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/dat-hoa/${productId}/${kioskId}?zone=${zone}`);
    const tags = page.getByRole('list', { name: 'Đặc điểm mẫu hoa' });
    await expect(tags).toContainText('Hoa hồng');
    await expect(tags).toContainText('Sinh nhật');
    await expect(page.getByText('Bó hồng lụa màu hồng.')).toBeVisible();
    const section = page.getByRole('region', { name: 'Đánh giá sản phẩm' });
    if (zone === 'WALK_IN') {
      await expect(section).toHaveCount(0);
      return;
    }
    const button = section.getByRole('button', { name: 'Gửi đánh giá' });
    await expect(button).toBeDisabled();
    await section.getByRole('radio', { name: '5 sao' }).check();
    await section.getByLabel('Bình luận').fill('Màu đẹp.');
    await section.getByLabel('Ảnh hoa đã nhận').setInputFiles({
      name: 'hoa.png',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from(image, 'base64'),
    });
    await button.click();
    await expect(section.getByRole('status')).toContainText('Đã gửi đánh giá');
    await expect(section.getByText('4/5 sao · 2 lượt')).toBeVisible();
    await expect(section.getByText('Màu đẹp.')).toBeVisible();
    await expect(section.getByRole('img', { name: '5 trên 5 sao' })).toBeVisible();
    await expect(section.getByRole('img', { name: 'Ảnh hoa khách nhận' })).toBeVisible();
    await expect(button).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

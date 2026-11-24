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
    let reviewReads = 0;
    let rejectNextReview = true;
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
                description: zone === 'WALK_IN' ? '' : 'Bó hồng lụa màu hồng.',
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
        if (rejectNextReview) {
          rejectNextReview = false;
          return route.fulfill({ status: 400, json: { message: 'Chưa lưu được đánh giá.' } });
        }
        posted = true;
        return route.fulfill({ status: 201, json: { id: 'new' } });
      }
      if (url.pathname === path + '/reviews') {
        reviewReads++;
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
                    reviewerName: 'Nguyễn Minh Anh',
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
    const section = page.getByRole('region', { name: 'Đánh giá sản phẩm' });
    const thankYou = page.getByRole('dialog', { name: 'Cảm ơn bạn đã đánh giá!' });
    await expect(thankYou).toHaveCount(0);
    if (zone === 'WALK_IN') {
      await expect(page.getByRole('heading', { name: 'Mô tả sản phẩm' })).toHaveCount(0);
      await expect(section).toHaveCount(0);
      expect(reviewReads).toBe(0);
      return;
    }
    await expect(page.getByText('Bó hồng lụa màu hồng.')).toBeVisible();
    await expect(section.getByText('Chưa có đánh giá cho mẫu hoa này.')).toHaveCount(1);
    await expect(section.getByText('Chưa có đánh giá', { exact: true })).toHaveCount(0);
    await expect.poll(() => reviewReads).toBe(1);
    await expect(page.locator('.flower-detail-rating')).toHaveText('Chưa có đánh giá');
    await expect(page.locator('.flower-detail-shop-rating')).toHaveAccessibleName(
      'Điểm shop: 3 trên 5 sao, 1 lượt',
    );
    const button = section.getByRole('button', { name: 'Gửi đánh giá' });
    await expect(button).toBeDisabled();
    await expect(section.getByText('Chọn số sao để gửi đánh giá.')).toBeVisible();
    const scorePicker = section.getByRole('radiogroup', { name: 'Chọn số sao đánh giá' });
    await scorePicker.getByRole('radio', { name: '3 sao' }).check();
    await scorePicker.getByRole('radio', { name: '3 sao' }).press('Tab');
    await page.mouse.move(0, 0);
    await expect(scorePicker.locator('label.is-filled')).toHaveCount(3);
    await scorePicker.getByRole('radio', { name: '3 sao' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(scorePicker.getByRole('radio', { name: '4 sao' })).toBeChecked();
    await expect(scorePicker.locator('label.is-filled')).toHaveCount(4);
    await expect(section.getByText('Hài lòng', { exact: true })).toBeVisible();
    await section.getByRole('radio', { name: '5 sao' }).check();
    await section.getByLabel('Bình luận').fill('Màu đẹp.');
    const photoInput = section.getByLabel('Ảnh hoa đã nhận');
    await photoInput.setInputFiles({
      name: 'khong-phai-anh.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('text'),
    });
    await expect(section.getByRole('alert')).toContainText('tối đa 2 MB');
    await expect(button).toBeDisabled();
    await section.getByRole('button', { name: 'Bỏ ảnh đã chọn' }).click();
    await expect(section.getByRole('alert')).toHaveCount(0);
    await expect(photoInput).toHaveValue('');
    await expect(photoInput).toBeFocused();
    await photoInput.setInputFiles({
      name: 'xem-truoc.png',
      mimeType: 'image/png',
      buffer: Buffer.from(image, 'base64'),
    });
    await expect(section.getByRole('img', { name: 'Ảnh đã chọn để đánh giá' })).toBeVisible();
    await section.getByRole('button', { name: 'Bỏ ảnh đã chọn' }).click();
    await expect(section.getByRole('img', { name: 'Ảnh đã chọn để đánh giá' })).toHaveCount(0);
    await expect(photoInput).toHaveValue('');
    await section.getByLabel('Ảnh hoa đã nhận').setInputFiles({
      name: 'hoa.png',
      mimeType: 'application/octet-stream',
      buffer: Buffer.from(image, 'base64'),
    });
    await button.click();
    await expect(section.getByRole('alert')).toBeVisible();
    await expect(thankYou).toHaveCount(0);
    await expect(button).toBeEnabled();
    await button.click();
    await expect(section.getByRole('status')).toContainText('Đã gửi đánh giá');
    await expect(thankYou).toHaveCount(0);
    await expect(page.locator('.flower-detail-rating')).toContainText('1 đánh giá');
    await expect(
      page.locator('.flower-detail-rating').getByRole('img', { name: '5 trên 5 sao' }),
    ).toBeVisible();
    await expect(page.locator('.flower-detail-shop-rating')).toHaveAccessibleName(
      'Điểm shop: 4 trên 5 sao, 2 lượt',
    );
    await expect(section.getByText('Màu đẹp.')).toBeVisible();
    await expect(section.locator('.flower-review-author')).toHaveText('Nguyễn Minh Anh');
    await expect(
      section.locator('.flower-review-list').getByRole('img', { name: '5 trên 5 sao' }),
    ).toBeVisible();
    await expect(
      page.locator('.flower-detail-rating').getByRole('img', { name: '5 trên 5 sao' }),
    ).toBeVisible();
    await expect(section).not.toContainText('/5');
    await expect(page.locator('.flower-detail-content')).not.toContainText('/5');
    await expect(page.locator('.flower-detail-rating')).toContainText('1 đánh giá');
    await page.locator('.flower-detail-rating').click();
    await expect(page).toHaveURL(/#flower-reviews-title$/);
    await expect(page.getByRole('heading', { name: 'Đánh giá sản phẩm' })).toBeInViewport();
    await expect(section.getByRole('img', { name: 'Ảnh hoa khách nhận' })).toBeVisible();
    await expect(button).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

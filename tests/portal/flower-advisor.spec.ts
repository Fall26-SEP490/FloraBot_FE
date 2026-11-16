import { expect, test } from '@playwright/test';

test('FloraBot offers quick prompts and redirects an unrelated typed question', async ({
  page,
}) => {
  await page.route('**/api/kiosks', (route) =>
    route.fulfill({ json: [{ id: 'kiosk', name: 'Kiosk mẫu' }] }),
  );
  await page.route('**/api/shop/flower-chat', (route) => {
    const input = route.request().postDataJSON();
    if (input.mode === 'WALK_IN') {
      expect(input.budget).toBe(400000);
      expect(input.kioskId).toBe('kiosk');
      return route.fulfill({
        json: {
          message: 'Có bó hoa phù hợp.',
          suggestions: [
            {
              id: 'sample',
              productId: 'rose',
              kioskId: 'kiosk',
              name: 'Hồng lụa',
              price: 250000,
              mode: 'WALK_IN',
              reason: 'Hợp để tặng sinh nhật.',
            },
          ],
        },
      });
    }
    if (input.mode === 'PREORDER') {
      return route.fulfill({
        json: {
          message: 'Có mẫu nhận đặt trước.',
          suggestions: [
            {
              id: 'sample-preorder',
              productId: 'tulip',
              kioskId: 'kiosk',
              name: 'Tulip len',
              price: 350000,
              mode: 'PREORDER',
              photo: '/favicon.ico',
              productRating: 4.5,
              productReviews: 2,
              shopRating: 4,
              shopReviews: 8,
              reason: 'Phù hợp với dịp tốt nghiệp.',
            },
          ],
        },
      });
    }
    expect(input.question).toBe('Ai vô địch bóng đá?');
    return route.fulfill({
      json: { message: 'Bạn muốn FloraBot gợi ý hoa cho dịp nào ạ?', suggestions: [] },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Tư vấn FloraBot' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tư vấn FloraBot' });
  await expect(
    dialog.getByText('FloraBot xin chào, chúng tôi có thể giúp gì cho bạn ạ?'),
  ).toBeVisible();
  await dialog.getByLabel('Kiosk mua tại tủ').selectOption('kiosk');
  await dialog.getByRole('button', { name: /sinh nhật dưới/ }).click();
  await expect(dialog.getByRole('link', { name: 'Hồng lụa' })).toHaveAttribute(
    'href',
    '/tim-kiosk?kiosk=kiosk',
  );
  await dialog.getByRole('button', { name: /đặt trước bó hoa/ }).click();
  await expect(dialog.getByRole('link', { name: 'Tulip len' })).toHaveAttribute(
    'href',
    '/dat-hoa/tulip/kiosk?zone=PREORDER',
  );
  await expect(dialog.locator('img.flower-advisor-photo')).toHaveAttribute('src', '/favicon.ico');
  await expect(dialog.getByText('Shop 4/5 (8 lượt)')).toBeVisible();
  await dialog.getByRole('textbox', { name: 'Câu hỏi cho FloraBot' }).fill('Ai vô địch bóng đá?');
  await dialog.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect(dialog.getByText('Bạn muốn FloraBot gợi ý hoa cho dịp nào ạ?')).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng tư vấn' }).click();
  await expect(dialog).toBeHidden();

  await page.goto('/dat-hoa');
  await page.getByRole('button', { name: 'Tư vấn FloraBot' }).click();
  await expect(dialog.getByRole('button', { name: /đặt trước bó hoa/ })).toBeVisible();
});

test('Seller sees shop-specific quick questions', async ({ page }) => {
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') {
      return route.fulfill({
        json: {
          id: 'seller-user',
          name: 'Shop',
          role: 'SELLER',
          sellerId: '20000000-0000-0000-0000-000000000001',
          sellerStatus: 'ACTIVE',
          packageExpiresAt: '2099-01-01',
        },
      });
    }
    if (path === '/api/shop/flower-chat') {
      expect(route.request().postDataJSON().question).toContain('gắn tag');
      return route.fulfill({ json: { message: 'Chọn loại hoa và màu chủ đạo.', suggestions: [] } });
    }
    if (/\/(products|kiosks|slots)$/.test(path)) return route.fulfill({ json: [] });
    return route.fulfill({ json: { items: [], hasMore: false } });
  });
  await page.goto('/seller/products');
  await page.getByRole('button', { name: 'Tư vấn FloraBot' }).click();
  const dialog = page.getByRole('dialog', { name: 'Tư vấn FloraBot' });
  await dialog.getByRole('button', { name: /gắn tag/ }).click();
  await expect(dialog.getByText('Chọn loại hoa và màu chủ đạo.')).toBeVisible();
});

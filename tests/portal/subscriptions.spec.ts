import { expect, test } from '@playwright/test';
for (const width of [390, 1440]) {
  test(`Seller rental screen shows saved fee and avoids unsupported renewal at ${width}`, async ({
    page,
  }) => {
    const writes: string[] = [];
    await page.route('**/hub/**', (route) => route.abort());
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (route.request().method() !== 'GET') {
        writes.push(path);
        return route.abort();
      }
      if (path === '/api/auth/me')
        return route.fulfill({
          json: {
            id: 'user',
            name: 'Shop',
            role: 'SELLER',
            sellerId: 'seller',
            sellerStatus: 'ACTIVE',
          },
        });
      if (path === '/api/member/kiosk-applications/current')
        return route.fulfill({
          json: {
            id: 'app',
            pricingMode: 'SLOT_PRICING',
            walkInSlots: 3,
            preorderSlots: 2,
            totalSlots: 5,
            annualFee: 540000,
            walkInAnnualPrice: 100000,
            preorderAnnualPrice: 120000,
          },
        });
      return route.fulfill({ json: [] });
    });
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/seller/subscriptions');
    await expect(page.locator('#subscriptions')).toContainText('540.000');
    await expect(page.locator('#subscriptions')).toContainText('3 ô Walk-in · 2 ô Pre-order');
    await expect(
      page.getByRole('link', { name: 'Xem hồ sơ hoặc thuê thêm kiosk' }),
    ).toHaveAttribute('href', '/thue-kiosk');
    await expect(page.getByRole('button', { name: /gia hạn|Đăng ký kỳ thuê/i })).toHaveCount(0);
    expect(writes).toEqual([]);
  });
}

import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const sellerId = '20000000-0000-0000-0000-000000000099';

for (const width of [390, 1440]) {
  test(`Admin configures and verifies a shop payment channel at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: {
          id: 'admin-user',
          name: 'Admin',
          role: 'ADMIN',
          sellerId: null,
          sellerStatus: null,
          packageExpiresAt: null,
        },
      }),
    );
    let channels: unknown[] = [];
    await page.route('**/api/admin/payment-channels', (route) => route.fulfill({ json: channels }));
    let bound = 0;
    await page.route(`**/api/sellers/${sellerId}/payment-channel`, (route) => {
      expect(route.request().method()).toBe('PUT');
      expect(route.request().postDataJSON()).toEqual({ secretRef: 'seller_demo' });
      bound++;
      channels = [
        {
          sellerId,
          shopName: 'Shop thử nghiệm',
          currentVersion: 1,
          state: 'PENDING_VERIFICATION',
          expectedBankBin: '9704',
          expectedBankAccountMasked: '***1234',
          expectedBankName: 'Ngân hàng thử nghiệm',
          verifiedAt: null,
          updatedAt: '2026-11-05T00:00:00Z',
        },
      ];
      return route.fulfill({ json: channels[0] });
    });
    await page.route(`**/api/sellers/${sellerId}/payment-channel/verify`, (route) => {
      expect(route.request().method()).toBe('POST');
      channels = [{ ...(channels[0] as Record<string, unknown>), state: 'ACTIVE' }];
      return route.fulfill({ json: { verified: true, message: 'Đã xác thực kênh.' } });
    });
    await page.goto('/admin/payment-channels');
    await page.getByLabel('Seller ID').fill(sellerId);
    await page.getByLabel('Mã tham chiếu cấu hình').fill('seller_demo');
    await page.getByRole('button', { name: 'Gắn kênh thanh toán' }).click();
    await expect(page.getByText('Shop thử nghiệm')).toBeVisible();
    await expect(page.getByText('Chờ xác thực')).toBeVisible();
    expect(bound).toBe(1);
    const verify = page.getByRole('button', { name: 'Xác thực kênh của Shop thử nghiệm' });
    await expect(verify).toBeVisible();
    const bounds = await verify.boundingBox();
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include('#main')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await verify.click();
    await expect(page.getByText('Đã kích hoạt', { exact: true })).toBeVisible();
    await expect(verify).toBeHidden();
  });
}

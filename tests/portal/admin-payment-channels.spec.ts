import { expect, test } from '@playwright/test';

const sellerId = '20000000-0000-0000-0000-000000000099';

test('Admin binds only a server secret reference, then sees pending verification', async ({
  page,
}) => {
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
  await page.goto('/admin/payment-channels');
  await page.getByLabel('Seller ID').fill(sellerId);
  await page.getByLabel('Mã tham chiếu cấu hình').fill('seller_demo');
  await page.getByRole('button', { name: 'Gắn kênh thanh toán' }).click();
  await expect(page.getByText('Shop thử nghiệm')).toBeVisible();
  await expect(page.getByText('Chờ xác thực')).toBeVisible();
  expect(bound).toBe(1);
});

import { expect, test } from '@playwright/test';

for (const succeeds of [true, false]) {
  test(`Saving shop bank is separate from rental submission (${succeeds ? 'success' : 'failure'})`, async ({
    page,
  }) => {
    let bankReady = false;
    const saves: Record<string, unknown>[] = [];
    let rentalWrites = 0;
    await page.route('**/hub/**', (r) => r.abort());
    await page.route('**/api/**', (r) => {
      const path = new URL(r.request().url()).pathname;
      if (path === '/api/auth/me')
        return r.fulfill({
          json: {
            id: 'test-bank-user',
            name: 'Test Seller',
            role: 'SELLER',
            sellerId: 'test-bank-shop',
          },
        });
      if (path === '/api/member/kiosk-applications/current')
        return r.fulfill({ status: 404, json: {} });
      if (path === '/api/kiosk-packages')
        return r.fulfill({
          json: {
            annualSlotPrice: 10000,
            configured: true,
            version: 1,
            updatedAt: null,
            termMonths: 12,
            minSlots: 1,
            maxSlots: 50,
          },
        });
      if (path.endsWith('/bank'))
        return r.fulfill({
          json: bankReady
            ? { status: 'READY', bankName: 'MB Bank', holder: 'TEST HOLDER', accountSuffix: '5678' }
            : { status: 'MISSING', bankName: null, holder: null, accountSuffix: null },
        });
      if (path.endsWith('/set_seller_bank')) {
        saves.push(r.request().postDataJSON());
        bankReady = succeeds;
        return r.fulfill(
          succeeds
            ? { json: { result: null } }
            : { status: 503, json: { detail: 'Test bank save unavailable' } },
        );
      }
      if (path === '/api/me/kiosk-applications') rentalWrites++;
      return r.fulfill({ json: {} });
    });
    await page.goto('/thue-kiosk');
    await expect(page.locator('form form')).toHaveCount(0);
    await page.getByLabel('Tên ngân hàng nhận hoàn phí').fill('MB Bank');
    await page.getByLabel('Tên chủ tài khoản (Viết hoa').fill('TEST HOLDER');
    await page.getByLabel('Số tài khoản ngân hàng').fill('0012345678');
    await page.getByRole('checkbox', { name: /Tôi đã kiểm tra/ }).check();
    await page.getByRole('button', { name: 'Lưu tài khoản ngân hàng shop' }).click();
    await expect.poll(() => saves.length).toBe(1);
    expect(saves[0]).toEqual({
      p_bank: 'MB Bank',
      p_holder: 'TEST HOLDER',
      p_account_enc: '0012345678',
    });
    expect(rentalWrites).toBe(0);
    await expect(page.locator('.kiosk-field-error-banner')).toHaveCount(0);
    if (succeeds) {
      await expect(page.locator('.lease-seller-bank-row')).toContainText('5678');
      await expect(page.getByLabel('Số tài khoản ngân hàng')).toHaveCount(0);
    } else {
      await expect(page.getByText('Test bank save unavailable')).toBeVisible();
      await expect(page.getByLabel('Số tài khoản ngân hàng')).toHaveValue('');
    }
  });
}

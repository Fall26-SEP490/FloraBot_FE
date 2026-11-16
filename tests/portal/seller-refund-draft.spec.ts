import { expect, test } from '@playwright/test';

test('Seller keeps refund proof while bank details are hidden on a tab switch', async ({
  page,
}) => {
  const refund = {
    id: 'refund-test',
    orderCode: 'FB-REFUND-TEST',
    amount: 120000,
    status: 'APPROVED',
    canAccessBank: true,
    canSubmitTransfer: true,
    submission: null,
  };
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me')
      return route.fulfill({
        json: {
          id: 'seller-user',
          name: 'Shop',
          role: 'SELLER',
          sellerId: 'shop',
          sellerStatus: 'ACTIVE',
        },
      });
    if (path === '/api/sellers/shop/refunds')
      return route.fulfill({ json: { items: [refund], hasMore: false } });
    if (path === '/api/sellers/shop/refunds/refund-test') return route.fulfill({ json: refund });
    if (path.endsWith('/bank-details'))
      return route.fulfill({
        json: { bankName: 'Ngân hàng thử', holder: 'Người nhận thử', account: '100200300' },
      });
    return route.fulfill({ json: { items: [], hasMore: false } });
  });
  await page.goto('/seller/refunds');
  await page.locator('.refund-summary-head').click();
  await page.getByLabel('Lý do xem tài khoản nhận hoàn').fill('Đối chiếu giao dịch hoàn tiền');
  await page.getByRole('button', { name: 'Xem tài khoản nhận tiền' }).click();
  const reference = page.getByLabel('Mã giao dịch ngân hàng');
  await reference.fill('REF-TEST-123');
  await page.getByLabel('Thời điểm chuyển khoản').fill('2026-11-16T10:15');
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'chung-tu.png', mimeType: 'image/png', buffer: Buffer.from('mock') });
  await expect(page.getByText('100200300')).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByText('100200300')).toHaveCount(0);
  await expect(reference).toHaveValue('REF-TEST-123');
  await expect(page.getByLabel('Thời điểm chuyển khoản')).toHaveValue('2026-11-16T10:15');
  await expect(page.getByText('chung-tu.png')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gửi xác nhận chuyển khoản' })).toBeDisabled();
  const revealAgain = page.getByRole('button', { name: 'Hiện lại tài khoản nhận tiền' }).last();
  await revealAgain.scrollIntoViewIfNeeded();
  await expect(revealAgain).toBeInViewport();
  await revealAgain.click();
  await expect(page.getByText('100200300')).toBeVisible();
  await expect(page.getByText('chung-tu.png')).toBeVisible();
});

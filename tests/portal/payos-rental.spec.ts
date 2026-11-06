import { expect, test } from '@playwright/test';
import { mockPayos } from './payos.fixture';

for (const role of ['CUSTOMER', 'SELLER']) {
  for (const width of [390, 1440]) {
    test(`${role} rental opens PayOS once and updates only after BE confirms at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 900 });
      await mockPayos(page);
      const application = {
        id: '70000000-0000-0000-0000-000000000001',
        shopName: 'Shop kiểm thử',
        status: 'AWAITING_PAYMENT',
        annualFee: 40000,
        totalSlots: 3,
        walkInSlots: 1,
        preorderSlots: 2,
        walkInAnnualPrice: 10000,
        preorderAnnualPrice: 15000,
        pricingMode: 'SLOT_PRICING',
        pricingVersion: 1,
        termMonths: 12,
        createdAt: '2026-11-06T00:00:00Z',
        installationAddress: 'Địa điểm kiểm thử',
        latitude: 10.8,
        longitude: 106.7,
        canVoluntaryCancel: true,
      };
      let links = 0;
      let reconciles = 0;
      await page.route('**/hub/**', (route) => route.abort());
      await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/auth/me')
          return route.fulfill({
            json: {
              id: 'test-user',
              name: 'Tài khoản thử nghiệm',
              role,
              sellerId: role === 'SELLER' ? 'seller-1' : null,
              sellerStatus: 'ACTIVE',
            },
          });
        if (path.endsWith('/payment-link')) {
          links++;
          await new Promise((resolve) => setTimeout(resolve, 250));
          return route.fulfill({
            json: { checkoutUrl: 'https://pay.payos.vn/web/rental-test', orderCode: 123456 },
          });
        }
        if (path.endsWith('/reconcile')) {
          reconciles++;
          return route.fulfill({ json: application });
        }
        if (path === '/api/member/kiosk-applications/current')
          return route.fulfill({ json: application });
        if (path === '/api/kiosk-packages')
          return route.fulfill({
            json: {
              walkInAnnualPrice: 10000,
              preorderAnnualPrice: 15000,
              configured: true,
              version: 1,
              termMonths: 12,
              minSlots: 1,
              maxSlots: 50,
            },
          });
        return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
      });
      await page.goto('/thue-kiosk');
      await page.getByRole('button', { name: 'Thanh toán phí thuê', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Thanh toán phí thuê kiosk' });
      await expect(dialog.getByTitle('Thanh toán bảo mật qua PayOS')).toBeVisible();
      await expect(dialog).toContainText(/40\.000\s*[đ₫]/);
      expect(links).toBe(1);
      expect(page.context().pages()).toHaveLength(1);
      await expect(page).toHaveURL(/thue-kiosk$/);
      await dialog.getByRole('button', { name: 'Kiểm tra thanh toán', exact: true }).click();
      expect(reconciles).toBe(1);
      await expect(page.getByRole('heading', { name: 'Đã thanh toán thành công' })).toHaveCount(0);
      application.status = 'PAID_REVIEW';
      await page.evaluate(() =>
        (
          window as unknown as { payosTestConfig: { onSuccess: () => void } }
        ).payosTestConfig.onSuccess(),
      );
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole('heading', { name: 'Đã thanh toán thành công' })).toBeVisible();
      expect(links).toBe(1);
    });
  }
}

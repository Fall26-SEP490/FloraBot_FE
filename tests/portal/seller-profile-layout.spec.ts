import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1440]) {
  test(`seller profile layout at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.route('**/hub/**', (route) => route.abort());
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me')
        return route.fulfill({
          json: {
            id: 'seller-profile',
            name: 'Tạ Minh Hoàng',
            role: 'SELLER',
            sellerId: 'shop-profile',
            sellerStatus: 'ACTIVE',
            packageExpiresAt: '2030-01-01',
          },
        });
      if (path === '/api/account/profile')
        return route.fulfill({
          json: {
            id: 'seller-profile',
            fullName: 'Tạ Minh Hoàng',
            loginEmail: 'hoang@example.test',
            contactEmail: 'hoang@example.test',
            contactEmailIsDefault: true,
            contactEmailVerified: false,
            phone: '0901234567',
            address: 'Quận 12',
            bank: {
              bankName: 'MB Bank',
              accountHolder: 'TA MINH HOANG',
              accountLast4: '2288',
              hasAccount: true,
              status: 'READY',
            },
          },
        });
      if (path === '/api/me/shop')
        return route.fulfill({
          json: {
            id: 'shop-profile',
            shopName: 'Shop Hoa Của Tâm',
            phone: '0901234567',
            contactEmail: '',
            address: '12 Lê Lợi, Quận 1, TP.HCM',
            status: 'ACTIVE',
          },
        });
      return route.fulfill({ json: [] });
    });
    await page.goto('/ho-so');
    await expect(page.getByLabel('Họ và tên *')).toHaveValue('Tạ Minh Hoàng');
    const nav = page.getByRole('navigation', { name: 'Mục hồ sơ' });
    const tab = nav.getByRole('link', { name: 'Thông tin cá nhân', exact: true });
    await expect(tab).toHaveAttribute('aria-current', 'location');
    expect(await tab.evaluate((el) => getComputedStyle(el).borderBottomWidth)).toBe('2px');
    await page.getByText('Xem và cập nhật thông tin cửa hàng', { exact: true }).click();
    await expect(page.getByLabel('Tên cửa hàng *')).toHaveValue('Shop Hoa Của Tâm');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  });
}

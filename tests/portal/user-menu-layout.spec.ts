import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const role of ['SELLER', 'CUSTOMER']) {
  for (const width of [390, 1440]) {
    test(`account dropdown ${role} at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 960 });
      let profileReads = 0;
      await page.route('**/hub/**', (route) => route.abort());
      await page.route('**/api/**', (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/auth/me')
          return route.fulfill({
            json: {
              id: 'menu-user',
              name: 'Phong Trần Đình',
              role,
              sellerId: role === 'SELLER' ? 'shop-menu' : null,
              sellerStatus: 'ACTIVE',
              packageExpiresAt: '2030-01-01',
            },
          });
        if (path === '/api/account/profile') {
          profileReads++;
          return route.fulfill({
            json: {
              id: 'menu-user',
              fullName: 'Phong Trần Đình',
              loginEmail: 'phingtran93@example.test',
              contactEmail: null,
              phone: null,
              address: null,
              bank: null,
              contactEmailVerified: false,
              contactEmailIsDefault: true,
            },
          });
        }
        if (path === '/api/me/shop')
          return route.fulfill({ json: { shopName: 'Shop Hoa Của Tâm' } });
        return route.fulfill({
          json: path.endsWith('/chats') ? { items: [], page: 1, hasMore: false } : [],
        });
      });
      await page.goto(role === 'SELLER' ? '/seller/staff-chats' : '/tai-khoan#member-chats');
      const trigger = page.locator('.user-menu-trigger').first();
      await expect(trigger).toBeVisible();
      await expect(trigger.locator('.user-menu-name')).toBeVisible();
      await expect(trigger.locator('.user-menu-caption')).toBeVisible();
      if (role === 'SELLER') expect(profileReads).toBe(0);
      expect(await trigger.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe(
        '0px',
      );
      await trigger.click();
      const menu = page.locator('.user-menu-popover');
      await expect(menu.locator('.user-menu-profile')).toContainText('Phong Trần Đình');
      await expect(menu.locator('.user-menu-profile')).toContainText('phingtran93@example.test');
      await expect(menu.getByRole('button', { name: 'Đăng xuất', exact: true })).toBeVisible();
      await expect(
        menu.getByRole('link', {
          name: role === 'SELLER' ? 'Hồ sơ cá nhân' : 'Hồ sơ',
          exact: true,
        }),
      ).toHaveAttribute('href', '/ho-so');
      const bounds = await menu.boundingBox();
      expect(bounds!.x).toBeGreaterThanOrEqual(0);
      expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        (await new AxeBuilder({ page }).include('.user-menu-account').analyze()).violations,
      ).toEqual([]);
      await page.keyboard.press('Escape');
      await expect(menu).toBeHidden();
      await expect(trigger).toBeFocused();
      await trigger.click();
      await page.mouse.click(8, 500);
      await expect(menu).toBeHidden();
    });
  }
}

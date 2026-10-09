import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const role of ['ADMIN', 'SELLER'] as const)
  for (const width of [390, 1440]) {
    test(`${role} workspace navigation and overview ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      const base = role === 'ADMIN' ? '/admin' : '/seller';
      const section = role === 'ADMIN' ? 'shops' : 'products';
      const title = role === 'ADMIN' ? 'Shop hoa' : 'Mẫu hoa';
      const businessReads: string[] = [];
      await page.route('**/api/**', (route) => {
        if (route.request().url().endsWith('/auth/me'))
          return route.fulfill({
            json: {
              id: 'workspace-user',
              name: 'Thảo',
              role,
              sellerId: role === 'SELLER' ? 'shop' : null,
              sellerStatus: 'ACTIVE',
              packageExpiresAt: '2030-01-01',
            },
          });
        const path = new URL(route.request().url()).pathname;
        businessReads.push(path);
        if (path.endsWith('/wallet'))
          return route.fulfill({
            json: {
              balance: { availableBalance: 450000, pendingBalance: 150000 },
              bankConfigured: true,
              entries: [],
              withdrawals: [],
            },
          });
        if (path.endsWith('/products'))
          return route.fulfill({
            json: [{ id: 'flower', name: 'Hoa hồng', status: 'ACTIVE', price: 250000 }],
          });
        return route.fulfill({
          json:
            path.endsWith('/shops') || path.endsWith('/sellers')
              ? []
              : { items: [], hasMore: false, page: 1 },
        });
      });
      await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
      await page.goto(base);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chào Thảo,');
      await expect(page.getByRole('heading', { name: 'Yêu cầu đặt hoa gần đây' })).toBeVisible();
      await expect.poll(() => businessReads.length).toBeGreaterThanOrEqual(3);
      expect(
        businessReads.every((path) =>
          path.startsWith(role === 'ADMIN' ? '/api/admin/' : '/api/sellers/shop/'),
        ),
      ).toBe(true);
      const nav = page.getByRole('navigation', { name: 'Điều hướng quản lý' });
      if (width < 900) {
        await expect(nav).toBeHidden();
        await page.getByRole('button', { name: 'Mở danh mục quản lý' }).click();
      }
      await expect(nav.getByRole('link', { name: 'Tổng quan', exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await nav.getByRole('link', { name: title, exact: true }).click();
      await expect(page).toHaveURL(`${base}/${section}`);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      if (width < 900) await page.getByRole('button', { name: 'Mở danh mục quản lý' }).click();
      await expect(nav.getByRole('link', { name: title, exact: true })).toHaveAttribute(
        'aria-current',
        'page',
      );
      await page.goBack();
      await expect(page).toHaveURL(base);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText('Chào Thảo,');
      await expect(page.locator('body')).toHaveJSProperty('scrollWidth', width);
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
      await page.screenshot({
        path: `artifacts/workspace-${role.toLowerCase()}-${width}.png`,
        fullPage: true,
      });
    });
  }

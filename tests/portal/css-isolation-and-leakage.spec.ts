import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('CSS Ownership, Loading Boundaries & Leakage Protection', () => {
  test('Client-navigation sequence does not leak styles between routes', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: {} }));
    await page.route('**/api/shop/catalog?*', (route) =>
      route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
    );
    await page.route('https://tile.openstreetmap.org/**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: '' }),
    );

    // Step 1: Direct load Marketing Landing page
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);

    // Verify Marketing specific styles
    const hero = page.locator('.hero');
    await expect(hero).toBeVisible();
    await expect(hero).toHaveCSS('display', 'grid');

    const activeHomeLink = page
      .getByRole('banner')
      .getByRole('link', { name: 'Trang chủ', exact: true });
    await expect(activeHomeLink).toHaveCSS('background-color', 'rgb(23, 75, 53)');
    await expect(activeHomeLink).toHaveCSS('color', 'rgb(255, 255, 255)');
    await expect(activeHomeLink).toHaveCSS('border-radius', '9999px');

    const bodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
    expect(bodyBg).toContain('florabot-pattern.webp');

    // Step 2: Client navigation to /dang-nhap via Header Login Link
    const loginLink = page
      .getByRole('banner')
      .getByRole('link', { name: 'Đăng nhập', exact: true });
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    await expect(page).toHaveURL('/dang-nhap');
    await page.waitForSelector('.auth-page');

    // Verify Auth specific styles
    const authForm = page.locator('.auth-form-panel');
    await expect(authForm).toBeVisible();

    // Verify that landing body background pattern is NOT applied to body on /dang-nhap
    const authBodyBg = await page.evaluate(() => getComputedStyle(document.body).backgroundImage);
    expect(authBodyBg).not.toContain('florabot-pattern.webp');

    const marketingSectionPadding = await page.evaluate(() => {
      const probe = document.createElement('div');
      probe.className = 'section';
      document.body.append(probe);
      const paddingTop = getComputedStyle(probe).paddingTop;
      probe.remove();
      return paddingTop;
    });
    expect(marketingSectionPadding).not.toBe('72px');

    // Step 3: Client navigation to /dat-hoa via Header Navigation
    const catalogLink = page
      .getByRole('banner')
      .getByRole('link', { name: 'Sản phẩm hoa', exact: true });
    await catalogLink.click();
    await expect(page).toHaveURL('/dat-hoa');
    await page.waitForSelector('.flower-shop-page');

    // Verify FlowerShop styles loaded dynamically
    const searchInput = page.getByRole('searchbox', { name: 'Tìm mẫu hoa, shop hoặc tủ nhận' });
    await expect(searchInput).toBeVisible();
    // Verify search input has its scoped style
    const searchInputBorderRadius = await searchInput.evaluate(
      (el) => getComputedStyle(el).borderRadius,
    );
    expect(searchInputBorderRadius).toBe('8px');

    // Step 4: Client navigation to /tim-kiosk via Header Navigation
    const kioskLink = page
      .getByRole('banner')
      .getByRole('link', { name: 'Vị trí tủ', exact: true });
    await kioskLink.click();
    await expect(page).toHaveURL('/tim-kiosk');
    await page.waitForSelector('.customer-kiosk-page');

    // Verify Kiosk styles loaded properly without horizontal overflow
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(
      true,
    );
  });

  test('Seller Overview preserves computed styles from dashboard-overview.css without operations.css', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me') {
        return route.fulfill({
          json: {
            id: 'seller-1',
            name: 'Shop Hoa Mẫu',
            role: 'SELLER',
            sellerId: 'shop-1',
            sellerStatus: 'ACTIVE',
            packageExpiresAt: '2030-01-01',
          },
        });
      }
      if (path.endsWith('/wallet')) {
        return route.fulfill({
          json: {
            balance: { availableBalance: 1250000, pendingBalance: 350000 },
            entries: [],
            bankConfigured: true,
            withdrawals: [],
          },
        });
      }
      if (path.endsWith('/products')) {
        return route.fulfill({
          json: [{ id: 'p1', name: 'Bó hoa hồng', status: 'ACTIVE', price: 250000 }],
        });
      }
      if (path.endsWith('/preorders')) {
        return route.fulfill({
          json: {
            items: [
              {
                id: 'order-1',
                productName: 'Bó hồng pastel',
                kioskName: 'Tủ Đại học FPT',
                pickupAt: '2026-10-12T09:00:00Z',
                state: 'REQUESTED',
                orderStatus: null,
                ready: false,
              },
            ],
            page: 1,
            hasMore: false,
          },
        });
      }
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    });

    await page.goto('/seller');
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);

    // Verify regression assertions
    const welcome = page.locator('.operations-welcome');
    await expect(welcome).toBeVisible();
    await expect(welcome).toHaveCSS('display', 'flex');

    const metrics = page.locator('.operations-metrics');
    await expect(metrics).toBeVisible();
    await expect(metrics).toHaveCSS('display', 'grid');

    const surface = page.locator('.operations-surface').first();
    await expect(surface).toBeVisible();
    await expect(surface).toHaveCSS('border-radius', '16px');
    await expect(surface).toHaveCSS('background-color', 'rgb(255, 255, 255)');

    // Verify a11y & no horizontal scroll
    const a11y = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(a11y.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
});

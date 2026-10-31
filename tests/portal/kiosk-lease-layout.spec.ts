import { expect, test } from '@playwright/test';

for (const width of [390, 1440]) {
  test(`Lease page supports current packages and keyboard selection at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me') {
        return route.fulfill({ json: { id: 'lease-customer', name: 'Lan', role: 'CUSTOMER' } });
      }
      if (path === '/api/member/kiosk-applications/current') {
        return route.fulfill({ status: 404, json: {} });
      }
      if (path === '/api/kiosk-packages') {
        return route.fulfill({
          json: [
            {
              id: 'lease-small',
              name: 'Khởi đầu',
              annualFee: 12000000,
              totalSlots: 6,
              termMonths: 12,
              status: 'ACTIVE',
              description: '',
            },
            {
              id: 'lease-large',
              name: 'Phát triển',
              annualFee: 18000000,
              totalSlots: 12,
              termMonths: 12,
              status: 'ACTIVE',
              description: '',
            },
          ],
        });
      }
      return route.fulfill({ json: {} });
    });
    await page.goto('/thue-kiosk');
    await expect(page.getByRole('heading', { name: 'Mở điểm bán hoa của bạn' })).toBeVisible();
    const first = page.getByRole('radio', { name: 'Khởi đầu', exact: true });
    const second = page.getByRole('radio', { name: 'Phát triển', exact: true });
    await first.focus();
    await page.keyboard.press('Space');
    await expect(first).toBeChecked();
    await page.keyboard.press('ArrowRight');
    await expect(second).toBeChecked();
    await expect(page.locator('.slot-item').first()).toContainText('6 ô tủ');
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: `test-results/lease-${width}.png`, fullPage: true });
  });
}

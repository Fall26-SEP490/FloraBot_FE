import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const role of ['CUSTOMER', 'SELLER']) {
  for (const width of [390, 820, 1440]) {
    test(`Rental layout, pricing and consent for ${role} at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.route('**/api/**', async (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/auth/me')
          return route.fulfill({
            json: {
              id: 'lease-user',
              name: 'Lan',
              role,
              sellerId: role === 'SELLER' ? 'lease-shop' : null,
            },
          });
        if (path === '/api/member/kiosk-applications/current')
          return route.fulfill({ status: 404, json: {} });
        if (path === '/api/kiosk-packages')
          return route.fulfill({
            json: {
              annualSlotPrice: 10000,
              version: 1,
              configured: true,
              updatedAt: null,
              termMonths: 12,
              minSlots: 1,
              maxSlots: 50,
            },
          });
        return route.fulfill({ json: {} });
      });
      await page.goto('/thue-kiosk');
      await expect(page.getByRole('heading', { name: 'Cấu hình kiosk của bạn' })).toBeVisible();
      await expect(
        page.getByRole('heading', {
          name: role === 'SELLER' ? 'Kiosk mới sẽ đặt ở đâu?' : 'Thông tin đăng ký',
          exact: true,
        }),
      ).toBeVisible();
      const submit = page.getByRole('button', { name: 'Nộp hồ sơ thuê kiosk' });
      const consent = page.getByRole('checkbox', { name: /Tôi đã kiểm tra/ });
      await expect(submit).toBeDisabled();
      await page.getByRole('button', { name: 'Tăng ô Pre-order', exact: true }).click();
      await expect(page.locator('.kiosk-rental-review')).toContainText(
        '1 ô bán sẵn · 1 ô đặt trước',
      );
      await expect(page.locator('.lease-review-price')).toContainText(/20[.,]000/);
      await consent.check();
      await expect(submit).toBeEnabled();
      await page.getByRole('button', { name: 'Tăng ô Walk-in', exact: true }).click();
      await expect(consent).not.toBeChecked();
      await expect(submit).toBeDisabled();
      const walk = page.getByRole('spinbutton', { name: 'Ô bán sẵn (Walk-in)', exact: true });
      await walk.fill('49');
      await expect(
        page.getByRole('button', { name: 'Tăng ô Pre-order', exact: true }),
      ).toBeDisabled();
      await walk.fill('2');
      if (role === 'CUSTOMER')
        await expect(
          page.getByText('Tài khoản nhận hoàn phí thuê kiosk', { exact: true }),
        ).toBeVisible();
      else await expect(page.locator('.lease-profile-note')).toBeVisible();
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
      ).toBe(true);
      const accessibility = await new AxeBuilder({ page })
        .include('.kiosk-registration-layout')
        .analyze();
      expect(accessibility.violations).toEqual([]);
      await page.evaluate(async () => {
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
        window.scrollTo({ top: 0, behavior: 'instant' });
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        );
      });
      await page.screenshot({
        path: `test-results/lease-${role.toLowerCase()}-${width}.png`,
        fullPage: true,
      });
    });
  }
}

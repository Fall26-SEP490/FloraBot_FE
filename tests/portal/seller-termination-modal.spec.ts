import { test, expect } from '@playwright/test';
import { setupSellerUsability } from '../fixtures/seller-usability';

for (const status of ['ACCEPTED', 'CANCELLED', 'REQUESTED']) {
  for (const width of [390, 1366]) {
    test(`termination ${status} details stay aligned at ${width}`, async ({ page }) => {
      await setupSellerUsability(page);
      await page.setViewportSize({ width, height: 900 });
      await page.route('**/termination-requests/current', (route) =>
        route.fulfill({
          json: {
            id: 'termination-1',
            status,
            reason: 'Lý do kiểm tra bố cục',
            reviewReason: status === 'ACCEPTED' ? 'Đã duyệt yêu cầu' : null,
            lifecycleStatus: status === 'ACCEPTED' ? 'AWAITING_MANAGER_CONFIRMATION' : 'NORMAL',
            version: 1,
          },
        }),
      );
      await page.goto('/seller/terminations');
      await page.locator('.rental-data-row').first().click();
      const dialog = page.getByRole('dialog');
      await expect(dialog).toBeVisible();
      await expect(dialog.locator('.seller-termination-info-row').first()).toHaveCSS(
        'display',
        'grid',
      );
      await expect(dialog.locator('.seller-termination-info-box')).toHaveCSS('row-gap', '12px');
      await expect(dialog.locator('.seller-termination-kiosk-name')).toBeHidden();
      if (status === 'CANCELLED') {
        await expect(dialog.getByText('Tiến độ xử lý:', { exact: true })).toHaveCount(0);
      } else {
        await expect(dialog.getByText('Tiến độ xử lý:', { exact: true })).toBeVisible();
      }
      expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
      if (status === 'REQUESTED') {
        await dialog.getByRole('button', { name: 'Rút yêu cầu chấm dứt', exact: true }).click();
        const reason = dialog.getByRole('textbox', { name: 'Lý do rút yêu cầu' });
        await expect(reason).toBeVisible();
        await expect(reason).toHaveCSS('border-top-width', '1px');
        await expect(reason).toHaveCSS('border-top-style', 'solid');
        await expect(dialog.locator('.seller-termination-notice')).toHaveCount(0);
        await expect(dialog.getByRole('button', { name: 'Xác nhận rút yêu cầu' })).toBeDisabled();
      }
    });
  }
}

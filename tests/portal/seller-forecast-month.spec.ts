import { test, expect } from '@playwright/test';
import { setupSellerUsability, shopId } from '../fixtures/seller-usability';
import { chooseVietnamDate } from '../fixtures/vietnam-date';

test('Forecast month follows applied history and excludes today shortcut', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-20T05:00:00Z'));
  await setupSellerUsability(page);
  const payloads: Record<string, unknown>[] = [];
  await page.route(`**/api/sellers/${shopId}/ai/seasonal-forecast`, (route) => {
    payloads.push(route.request().postDataJSON());
    return route.fulfill({
      json: { forecastStart: '2026-12-01', forecastEnd: '2026-12-31', warnings: [], products: [] },
    });
  });
  await page.goto('/seller/seasonal');
  const month = page.getByRole('combobox', { name: 'Tháng dự báo', exact: true });
  await expect(month).toContainText('12/2026');
  await month.click();
  const popup = page.locator('[data-vietnam-calendar]');
  await expect(popup.getByRole('button', { name: 'Tháng 11', exact: true })).toBeDisabled();
  await expect(popup.getByRole('button', { name: 'Tháng 12', exact: true })).toBeEnabled();
  await expect(popup.getByRole('button', { name: /Hôm nay|Tháng này|Xóa/ })).toHaveCount(0);
  await popup.getByRole('button', { name: 'Xong', exact: true }).click();
  await page.getByRole('button', { name: 'Xem dự báo', exact: true }).click();
  await expect.poll(() => payloads.length).toBe(1);
  expect(payloads[0]).toMatchObject({ year: 2026, month: 12, historyTo: '2026-11-20' });
  await chooseVietnamDate(page, 'Đến ngày', '2026-10-31');
  await page.getByRole('button', { name: 'Xem số liệu', exact: true }).click();
  await chooseVietnamDate(page, 'Tháng dự báo', '2026-11', 'month');
  await expect(month).toContainText('11/2026');
  await page.getByRole('button', { name: 'Xem dự báo', exact: true }).click();
  await expect.poll(() => payloads.length).toBe(2);
  expect(payloads[1]).toMatchObject({ year: 2026, month: 11, historyTo: '2026-10-31' });
  await chooseVietnamDate(page, 'Đến ngày', '2026-11-20');
  await page.getByRole('button', { name: 'Xem số liệu', exact: true }).click();
  await expect(month).toContainText('12/2026');
});

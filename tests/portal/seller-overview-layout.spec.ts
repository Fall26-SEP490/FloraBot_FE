import { test, expect } from '@playwright/test';
import { setupSellerUsability, sampleRequest, shopId } from '../fixtures/seller-usability';

for (const width of [1440, 768, 390]) {
  test(`seller overview keeps orders and receipts readable at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 1000 });
    const model = await setupSellerUsability(page);
    await page.route(`**/api/sellers/${shopId}/preorders?*`, (route) =>
      route.fulfill({
        json: {
          items: [{ ...sampleRequest, state: 'QUOTED', quotedPrice: 350000 }],
          page: 1,
          hasMore: false,
        },
      }),
    );
    await page.goto('/seller');
    const progress = page.getByRole('region', { name: 'Tiến độ đơn hàng', exact: true });
    const orders = page.getByRole('region', { name: 'Đơn cần theo dõi', exact: true });
    const payments = page.getByRole('region', { name: 'Tổng doanh thu', exact: true });
    await expect(progress).toHaveCount(0);
    await expect(page.getByText('Không có việc đang chờ', { exact: true })).toHaveCount(0);
    await expect(orders.getByText('Không có đơn cần xử lý', { exact: true })).toBeVisible();
    await orders.getByRole('button', { name: 'Gần đây', exact: true }).click();
    const sheet = orders.getByRole('table');
    await expect(sheet.getByRole('columnheader')).toHaveText([
      'Mã đơn',
      'Mẫu hoa',
      'Kiosk',
      'Lịch nhận',
      'Giá',
      'Trạng thái',
      'Thao tác',
    ]);
    await expect(sheet.getByRole('row').nth(1).getByRole('cell')).toHaveCount(7);
    await expect(sheet.getByRole('cell', { name: '350.000 ₫', exact: true })).toBeVisible();
    await expect(orders.getByRole('link', { name: /Mẫu kiểm thử Seller/ })).toHaveAttribute(
      'href',
      /requestId=/,
    );
    await expect(page.getByRole('region', { name: 'Thao tác nhanh' })).toHaveCount(0);
    await expect(page.locator('#main').getByText('Vận hành cửa hàng', { exact: true })).toHaveCount(
      0,
    );
    await expect(page.getByText('Hướng dẫn nhanh', { exact: true })).toHaveCount(0);
    await expect(payments.getByText('Đã thanh toán', { exact: true })).toHaveCount(0);
    await expect(payments.getByText('Thực nhận', { exact: true })).toHaveCount(0);
    await expect(payments.getByText(/1\.250\.000/)).toHaveCount(0);
    const amount = payments.getByLabel('Doanh thu toàn thời gian', { exact: true });
    await expect(amount).toContainText('1.350.000');
    await expect(amount).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(await amount.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    expect(model.writes).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`seller-overview-${width}.png`),
      fullPage: true,
    });
  });
}

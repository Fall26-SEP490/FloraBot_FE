import { test, expect } from '@playwright/test';
import { setupSellerUsability, shopId } from '../fixtures/seller-usability';

for (const width of [1440, 390]) {
  test(`seller revenue switches total, months, days and kiosks at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 1000 });
    const model = await setupSellerUsability(page);
    const reads: URLSearchParams[] = [];
    let failDays = false;
    await page.route(`**/api/sellers/${shopId}/reports/sales*`, (route) => {
      const params = new URL(route.request().url()).searchParams;
      reads.push(params);
      if (failDays && params.has('from') && params.get('from')!.includes('2024-02-'))
        return route.fulfill({ status: 503, json: {} });
      const amount = params.has('month')
        ? 600000
        : params.has('from') && !params.get('from')!.includes('-01-01')
          ? 10000
          : 1350000;
      return route.fulfill({
        json: {
          sellerId: shopId,
          grossPaid: amount,
          totalRefunded: 0,
          netReceipts: amount,
          paidOrders: 2,
          byKiosk: [
            {
              kioskId: 'kiosk-a',
              kioskCode: 'K01',
              kioskName: 'Kiosk A',
              grossPaid: amount * 0.6,
              orderCount: 1,
            },
            {
              kioskId: 'kiosk-b',
              kioskCode: 'K02',
              kioskName: 'Kiosk B',
              grossPaid: amount * 0.4,
              orderCount: 1,
            },
          ],
        },
      });
    });
    await page.goto('/seller');
    const revenue = page.getByRole('region', { name: 'Tổng doanh thu', exact: true });
    await expect(revenue.getByLabel('Doanh thu toàn thời gian', { exact: true })).toContainText(
      '1.350.000',
    );
    expect((await revenue.boundingBox())!.y).toBeLessThan(
      (await page.getByRole('region', { name: 'Đơn cần theo dõi', exact: true }).boundingBox())!.y,
    );
    await expect(revenue.getByRole('button', { name: 'Tổng', exact: true })).toHaveCount(0);
    await revenue.getByRole('button', { name: 'Theo tháng', exact: true }).click();
    await expect(revenue.getByRole('button', { name: /Tháng 1:/ })).toBeVisible();
    const year = revenue.getByRole('combobox', { name: 'Năm', exact: true });
    const checkPeriodAlignment = async () => {
      for (const picker of await revenue.getByRole('combobox').all()) {
        const label = revenue.locator(`label[for="${await picker.getAttribute('id')}"]`);
        const controlBox = (await picker.boundingBox())!;
        const labelBox = (await label.boundingBox())!;
        expect(
          Math.abs(controlBox.y + controlBox.height / 2 - labelBox.y - labelBox.height / 2),
        ).toBeLessThan(1);
      }
    };
    await checkPeriodAlignment();
    await year.click();
    await page.getByRole('option', { name: '2024', exact: true }).click();
    await expect(revenue.getByRole('button', { name: /Tháng 12:/ })).toBeVisible();
    await revenue.getByRole('button', { name: /Tháng 2:/ }).hover();
    const tooltip = page.getByRole('tooltip');
    await expect(tooltip).toBeVisible();
    await expect(tooltip.getByText('600.000 ₫', { exact: true })).toBeVisible();
    await expect(tooltip.getByText('2 đơn', { exact: true })).toBeVisible();
    await expect(tooltip).not.toContainText('·');
    await page.keyboard.press('Escape');
    await expect(tooltip).toHaveCount(0);
    await revenue.getByRole('button', { name: /Tháng 2:/ }).click();
    await expect(tooltip).toBeVisible();
    const tooltipBox = (await tooltip.boundingBox())!;
    expect(tooltipBox.x).toBeGreaterThanOrEqual(0);
    expect(tooltipBox.x + tooltipBox.width).toBeLessThanOrEqual(width);
    await tooltip.screenshot({ path: testInfo.outputPath(`tooltip-${width}.png`) });
    await expect(revenue.getByRole('button', { name: /Tháng 2:/ })).not.toHaveAttribute('title');
    await expect(revenue.getByRole('button', { name: /Tháng 2:/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(reads.some((params) => params.get('month') === '2024-12')).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`revenue-month-${width}.png`),
      fullPage: true,
    });
    failDays = true;
    await revenue.getByRole('button', { name: 'Theo ngày', exact: true }).click();
    await revenue.getByRole('combobox', { name: 'Năm', exact: true }).click();
    await page.getByRole('option', { name: '2024', exact: true }).click();
    await revenue.getByRole('combobox', { name: 'Tháng', exact: true }).click();
    await page.getByRole('option', { name: '2', exact: true }).click();
    await expect(revenue.getByRole('alert')).toContainText('Chưa tải được biểu đồ');
    await expect(revenue.getByText('Chưa có doanh thu trong kỳ.', { exact: true })).toHaveCount(0);
    failDays = false;
    await revenue.getByRole('button', { name: 'Thử lại', exact: true }).click();
    await expect(revenue.getByRole('button', { name: /29\/02:/ })).toBeVisible();
    await checkPeriodAlignment();
    expect(
      await revenue
        .getByRole('button', { name: /29\/02:/ })
        .locator(':scope > span')
        .last()
        .evaluate((el) => el.scrollHeight <= el.clientHeight),
    ).toBe(true);
    expect(
      reads.some(
        (params) =>
          params.get('from') === '2024-02-29T00:00:00+07:00' &&
          params.get('to') === '2024-02-29T23:59:59.999999+07:00',
      ),
    ).toBe(true);
    await page.screenshot({
      path: testInfo.outputPath(`revenue-day-${width}.png`),
      fullPage: true,
    });
    await revenue.getByRole('button', { name: 'Theo kiosk', exact: true }).click();
    await checkPeriodAlignment();
    await expect(revenue.getByRole('button', { name: /Kiosk A/ })).toContainText('360.000');
    await revenue.getByRole('button', { name: /Kiosk A/ }).click();
    await expect(page.getByRole('tooltip').getByText('1 đơn', { exact: true })).toBeVisible();
    await expect(revenue.getByLabel('Doanh thu tháng 02/2024', { exact: true })).toContainText(
      '600.000',
    );
    await revenue.getByRole('button', { name: 'Theo tháng', exact: true }).click();
    await expect(revenue.getByLabel('Doanh thu toàn thời gian', { exact: true })).toContainText(
      '1.350.000',
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(model.writes).toEqual([]);
    await page.screenshot({
      path: testInfo.outputPath(`revenue-total-${width}.png`),
      fullPage: true,
    });
  });
}

import { test, expect } from '@playwright/test';
import { setupSellerUsability, shopId } from '../fixtures/seller-usability';

for (const width of [1920, 1366, 768, 390]) {
  test(`seller finance layout and actions at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setupSellerUsability(page);
    let channelReads = 0;
    let forecastPayload: Record<string, unknown> | undefined;
    await page.route(`**/api/sellers/${shopId}/**`, async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path.endsWith('/bank'))
        return route.fulfill({
          json: {
            status: 'READY',
            bankName: 'MB Bank',
            holder: 'TEST HOLDER',
            accountSuffix: '1234',
          },
        });
      if (path.endsWith('/payment-channel')) {
        channelReads++;
        return route.fulfill({
          json: {
            state: 'ACTIVE',
            expectedBankName: 'TA MINH HOANG',
            expectedBankAccountMasked: '***1234',
            version: 1,
          },
        });
      }
      if (path.endsWith('/reports/sales'))
        return route.fulfill({
          json: { grossPaid: 250000, totalRefunded: 50000, netReceipts: 200000, paidOrders: 2 },
        });
      if (path.endsWith('/payments'))
        return route.fulfill({
          json: {
            payments: [
              {
                id: 'p1',
                orderCode: 'FB-2026-001',
                amount: 250000,
                status: 'SUCCEEDED',
                createdAt: '2026-11-19T04:00:00Z',
                paidAt: null,
                receiverAccountMasked: '***1234',
              },
            ],
            totalCount: 1,
          },
        });
      if (path.endsWith('/loyalty-settings'))
        return route.fulfill({ json: { enabled: true, earnRatePercent: 1 } });
      if (path.endsWith('/refunds'))
        return route.fulfill({
          json: {
            items: [{ id: 'refund-1', orderCode: 'FB-2026-001', amount: 50000, status: 'PENDING' }],
            hasMore: false,
          },
        });
      if (path.endsWith('/refunds/refund-1'))
        return route.fulfill({
          json: {
            id: 'refund-1',
            orderCode: 'FB-2026-001',
            amount: 50000,
            status: 'PENDING',
            isApproved: false,
            canAccessBank: false,
            canSubmitTransfer: false,
            reason: 'Hoa không đúng mẫu',
            submission: null,
          },
        });
      if (path.endsWith('/ai/seasonal-sales'))
        return route.fulfill({
          json: {
            from: '2025-11-20',
            to: '2026-11-20',
            totalInvoices: 12,
            totalUnits: 18,
            products: [
              { productId: 'flower-1', name: 'Bó hồng pastel', totalInvoices: 12, totalUnits: 18 },
            ],
          },
        });
      if (path.endsWith('/ai/seasonal-forecast')) {
        forecastPayload = route.request().postDataJSON();
        return route.fulfill({
          json: {
            forecastStart: '2026-12-01',
            forecastEnd: '2026-12-31',
            warnings: [
              'Forecasts represent observed sales/invoice frequency, not unconstrained true demand or guaranteed stocking quantity; unobserved stockouts may cause downward bias.',
              'Annual seasonality is not validated (14-day holdout does not validate multi-year seasonal demand; no annual rolling backtest exists). Historical coverage available for reference only.',
              'Some products have insufficient history (< 70 covered days or < 10 invoice observations) and return null forecasts.',
            ],
            products: [
              {
                productId: 'flower-1',
                name: 'Bó hồng pastel',
                observedUnits: 18,
                observedInvoiceCount: 12,
                forecastUnits: 25,
                explanation: 'Ước tính theo dữ liệu đã thanh toán.',
              },
              {
                productId: 'flower-2',
                name: 'Hoa mới',
                observedUnits: 2,
                observedInvoiceCount: 1,
                forecastUnits: null,
                modelStatus: 'INSUFFICIENT_HISTORY',
                explanation: 'Sản phẩm chưa có đủ lịch sử để dự báo.',
              },
            ],
          },
        });
      }
      return route.fallback();
    });
    const noPageOverflow = async () =>
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    await page.goto('/seller/commerce');
    await expect(page.locator('.seller-stage-tabs a')).toHaveCount(2);
    await expect(page.locator('.seller-stage-tabs a[href="/seller/seasonal"]')).toHaveCount(0);
    await expect(page.getByText('Đã kích hoạt', { exact: true })).toBeVisible();
    await expect(page.locator('.channel-bank-facts > div').first()).toHaveText(
      'Chủ tài khoảnTA MINH HOANG',
    );
    await expect(page.getByText('Đã thanh toán', { exact: true }).last()).toBeVisible();
    await expect(page.getByText('SUCCEEDED', { exact: true })).toHaveCount(0);
    const bank = page.locator('.shop-bank-section');
    await bank.getByRole('button', { name: 'Thay đổi tài khoản', exact: true }).click();
    await bank.getByRole('combobox', { name: 'Tên ngân hàng nhận hoàn phí' }).click();
    await page.getByRole('option', { name: 'Ngân hàng Kbank Việt Nam', exact: true }).click();
    await expect(bank.getByRole('combobox')).toHaveValue('Ngân hàng Kbank Việt Nam');
    await bank.getByRole('button', { name: 'Hủy', exact: true }).click();
    await expect(page.locator('.shop-bank-distinction-card')).toHaveCount(0);
    await expect(page.locator('.business-pagination')).toHaveCount(0);
    await noPageOverflow();
    const before = channelReads;
    await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
    await expect.poll(() => channelReads).toBeGreaterThan(before);
    await page.goto('/seller/refunds');
    await page.getByText('FB-2026-001', { exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Chi tiết khoản hoàn' });
    await expect(panel.getByText('Hoa không đúng mẫu')).toBeVisible();
    await expect(panel.getByRole('button', { name: 'Xem tài khoản nhận tiền' })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(panel).not.toBeVisible();
    await noPageOverflow();
    await page.goto('/seller/seasonal');
    await expect(
      page.getByRole('heading', { name: 'Phân tích doanh số', exact: true }),
    ).toBeVisible();
    await expect(page.locator('.seller-stage-tabs')).toHaveCount(0);
    await expect(page.locator('.workspace-nav-group a[href="/seller/seasonal"]')).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(
      page.locator('.workspace-nav-group a[href="/seller/commerce"]'),
    ).not.toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('cell', { name: 'Bó hồng pastel', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Xem dự báo', exact: true }).click();
    await expect(page.getByRole('cell', { name: '25', exact: true })).toBeVisible();
    const seasonalLayout = await page.locator('.seller-seasonal').evaluate((element) => {
      const panels = element.querySelectorAll(':scope > section');
      const left = panels[0].getBoundingClientRect();
      const right = panels[1].getBoundingClientRect();
      return {
        available: element.clientWidth,
        left: { x: left.x, y: left.y },
        right: { x: right.x, y: right.y },
      };
    });
    if (seasonalLayout.available >= 1180) {
      expect(seasonalLayout.left.y).toBe(seasonalLayout.right.y);
      expect(seasonalLayout.right.x).toBeGreaterThan(seasonalLayout.left.x);
    } else expect(seasonalLayout.right.y).toBeGreaterThan(seasonalLayout.left.y);
    await expect(page.locator('.seasonal-forecast-notes')).not.toContainText('Forecasts represent');
    await expect(page.locator('.seasonal-forecast-notes')).toContainText(
      '70 ngày dữ liệu và 10 ngày có đơn',
    );
    const missingHistory = page.getByRole('row').filter({ hasText: 'Hoa mới' });
    await expect(missingHistory.getByText('Chưa đủ dữ liệu', { exact: true })).toBeVisible();
    await expect(
      missingHistory.getByText('Sản phẩm chưa có đủ lịch sử để dự báo.', { exact: true }),
    ).not.toBeVisible();
    await missingHistory.locator('summary').focus();
    await page.keyboard.press('Enter');
    await expect(
      missingHistory.getByText('Sản phẩm chưa có đủ lịch sử để dự báo.', { exact: true }),
    ).toBeVisible();
    expect(forecastPayload?.historyFrom).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(forecastPayload?.historyTo).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await noPageOverflow();
  });
}

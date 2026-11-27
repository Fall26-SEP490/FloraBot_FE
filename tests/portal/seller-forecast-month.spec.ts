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

const christmasSuggestion = {
  occasion: 'Giáng sinh',
  date: '2026-12-25',
  offer: 'Thử bó hồng phối đỏ và kem.',
  nextStep: 'Mở đặt trước rồi theo dõi lượt hỏi.',
};

test('A shop with no products sees advice before the forecast and during a forecast outage', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-20T05:00:00Z'));
  await setupSellerUsability(page);
  await page.route('**/api/sellers/' + shopId + '/ai/seasonal-advice?*', (route) => {
    const query = new URL(route.request().url()).searchParams;
    expect(query.get('year')).toBe('2026');
    expect(query.get('month')).toBe('12');
    expect(query.get('historyTo')).toBe('2026-11-20');
    return route.fulfill({ json: [{ ...christmasSuggestion, matchingProducts: [] }] });
  });

  let sendForecast: () => void = () => {};
  const forecastReply = new Promise<void>((resolve) => {
    sendForecast = resolve;
  });
  let forecastRequested = false;
  await page.route('**/api/sellers/' + shopId + '/ai/seasonal-forecast', async (route) => {
    forecastRequested = true;
    await forecastReply;
    return route.fulfill({ status: 503, json: { detail: 'Dự báo đang tạm gián đoạn.' } });
  });

  await page.goto('/seller/seasonal');
  const advice = page.getByRole('region', { name: 'Gợi ý bán theo dịp' });
  await expect(advice.getByRole('heading', { name: /Giáng sinh/ })).toBeVisible();
  await expect(advice.getByText('25/12/2026')).toBeVisible();
  await expect(advice.getByText('Mẫu phù hợp trong shop')).toHaveCount(0);
  expect(forecastRequested).toBe(false);

  try {
    await page.getByRole('button', { name: 'Xem dự báo', exact: true }).click();
    await expect.poll(() => forecastRequested).toBe(true);
    await expect(page.getByText('Đang tạo dự báo…')).toBeVisible();
    await expect(advice.getByText('Mở đặt trước rồi theo dõi lượt hỏi.')).toBeVisible();
  } finally {
    sendForecast();
  }
  await expect(
    page.getByRole('alert').filter({ hasText: 'Dự báo đang tạm gián đoạn.' }),
  ).toBeVisible();
  await expect(advice.getByText('Mở đặt trước rồi theo dõi lượt hỏi.')).toBeVisible();
});

test('A shop with little history can retry advice and still sees null forecast units', async ({
  page,
}) => {
  await page.clock.setFixedTime(new Date('2026-11-20T05:00:00Z'));
  await setupSellerUsability(page);
  let firstRequest = true;
  await page.route('**/api/sellers/' + shopId + '/ai/seasonal-advice?*', (route) => {
    if (firstRequest) {
      firstRequest = false;
      return route.fulfill({ status: 503, json: {} });
    }
    return route.fulfill({
      json: [{ ...christmasSuggestion, matchingProducts: ['Bó hồng của shop'] }],
    });
  });
  await page.route('**/api/sellers/' + shopId + '/ai/seasonal-forecast', (route) =>
    route.fulfill({
      json: {
        forecastStart: '2026-12-01',
        forecastEnd: '2026-12-31',
        warnings: [],
        products: [
          {
            productId: 'rose',
            name: 'Bó hồng của shop',
            observedUnits: 0,
            observedInvoiceCount: 0,
            forecastUnits: null,
          },
        ],
      },
    }),
  );

  await page.goto('/seller/seasonal');
  const advice = page.getByRole('region', { name: 'Gợi ý bán theo dịp' });
  await expect(advice.getByText(/Thử đăng một bó gọn/)).toBeVisible();
  await advice.getByRole('button', { name: 'Thử lại gợi ý theo tháng' }).click();
  await expect(advice.getByText('Mẫu phù hợp trong shop')).toBeVisible();
  await page.getByRole('button', { name: 'Xem dự báo', exact: true }).click();
  await expect(page.getByText('Chưa đủ dữ liệu')).toBeVisible();
  await expect(advice.getByText('Bó hồng của shop', { exact: false })).toBeVisible();
});

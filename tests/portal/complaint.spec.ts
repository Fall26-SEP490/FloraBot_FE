import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { components } from '../../packages/contracts/src/generated/api';

const id = '30000000-0000-0000-0000-000000000088';
const token = 'ABCD2345';
const receipt: components['schemas']['ReceiptResponse'] = {
  orderId: id,
  orderCode: 'FB-COMPLAINT-001',
  status: 'COMPLETED',
  createdAt: '2026-10-07T10:00:00Z',
  subtotal: 350000,
  discount: 0,
  total: 350000,
  completedAt: '2026-10-07T10:05:00Z',
  disputeDeadline: '2026-10-08T10:05:00Z',
  hasComplaint: false,
  canComplain: true,
  refundInformationProvided: false,
  refunds: { pendingAmount: 0, paidAmount: 0 },
  items: [{ name: 'Bó hoa cúc', quantity: 1, unitPrice: 350000, total: 350000, status: 'ACTIVE' }],
};
test.beforeEach(async ({ page }) => {
  await page.route('**/api/receipts/*/evidence', (route) => {
    expect(route.request().headers()['cookie']).toBeUndefined();
    return route.fulfill({ json: { reference: 'evidence:v1:test-reference' } });
  });
  await page.route('**/api/receipts/lookup', (route) => route.fulfill({ json: receipt }));
  await page.goto(`/receipt#order=${id}&token=${token}`);
  await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
});

for (const width of [390, 1440])
  test(`Complaint validation, review, correction and submission at ${width}`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await context.addCookies([
      { name: 'portal-session', value: 'expired-fixture', domain: '127.0.0.1', path: '/' },
    ]);
    let attempts = 0;
    await page.route('**/flows/open_dispute', (route) => {
      attempts++;
      expect(route.request().headers()['cookie']).toBeUndefined();
      expect(route.request().postDataJSON()).toEqual({
        p_order: id,
        p_tracking: token,
        p_reason: 'Hoa bị dập khi nhận tại tủ.',
        p_photo: 'evidence:v1:test-reference',
      });
      return route.fulfill({ json: { result: 'dispute-id' } });
    });
    await page.getByRole('button', { name: 'Gửi phản ánh về hoa' }).click();
    await page.getByRole('button', { name: 'Kiểm tra phản ánh', exact: true }).click();
    await expect(page.getByLabel('Vấn đề với bó hoa')).toBeFocused();
    await page.getByLabel('Vấn đề với bó hoa').fill('Hoa bị dập khi nhận tại tủ.');
    await page.getByRole('button', { name: 'Kiểm tra phản ánh', exact: true }).click();
    await expect(page.locator('#complaint-photo-error')).toContainText('Tải ảnh minh chứng');
    await page
      .getByLabel('Ảnh minh chứng', { exact: true })
      .setInputFiles({
        name: 'evidence.png',
        mimeType: 'image/png',
        buffer: Buffer.from('fixture'),
      });
    await page.getByRole('button', { name: 'Tải ảnh minh chứng', exact: true }).click();
    await expect(page.getByText(/Đã lưu ảnh evidence.png/)).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.getByRole('button', { name: 'Kiểm tra phản ánh', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Kiểm tra phản ánh trước khi gửi' }),
    ).toBeFocused();
    await page.getByRole('button', { name: 'Sửa phản ánh' }).click();
    await expect(page.getByLabel('Vấn đề với bó hoa')).toHaveValue('Hoa bị dập khi nhận tại tủ.');
    expect(attempts).toBe(0);
    await page.getByRole('button', { name: 'Kiểm tra phản ánh', exact: true }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `.impeccable/review/complaint-${width}.png`, fullPage: true });
    await page.getByRole('button', { name: 'Xác nhận gửi phản ánh' }).click();
    await expect(page.getByRole('status')).toHaveText('Đã ghi nhận phản ánh cho đơn này.');
    await expect(page.getByRole('button', { name: 'Gửi phản ánh về hoa' })).toHaveCount(0);
    expect(attempts).toBe(1);
  });

test('Lost complaint response blocks another submission until receipt is checked', async ({
  page,
}) => {
  let attempts = 0;
  await page.route('**/flows/open_dispute', (route) => {
    attempts++;
    return route.abort();
  });
  await page.getByRole('button', { name: 'Gửi phản ánh về hoa' }).click();
  await page.getByLabel('Vấn đề với bó hoa').fill('Hoa bị dập khi nhận tại tủ.');
  await page
    .getByLabel('Ảnh minh chứng', { exact: true })
    .setInputFiles({ name: 'evidence.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
  await page.getByRole('button', { name: 'Tải ảnh minh chứng', exact: true }).click();
  await expect(page.getByText(/Đã lưu ảnh evidence.png/)).toBeVisible();
  await page.getByRole('button', { name: 'Kiểm tra phản ánh', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận gửi phản ánh' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Chưa xác nhận được kết quả gửi' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gửi phản ánh về hoa' })).toHaveCount(0);
  await page.route('**/api/receipts/lookup', (route) =>
    route.fulfill({
      json: { ...receipt, status: 'DISPUTED', hasComplaint: true, canComplain: false },
    }),
  );
  await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('Đã ghi nhận phản ánh cho đơn này.');
  expect(attempts).toBe(1);
});

test('Server rejection and expired eligibility do not invite another complaint', async ({
  page,
}) => {
  await page.route('**/flows/open_dispute', (route) => route.fulfill({ status: 409 }));
  await page.getByRole('button', { name: 'Gửi phản ánh về hoa' }).click();
  await page.getByLabel('Vấn đề với bó hoa').fill('Hoa bị dập khi nhận tại tủ.');
  await page
    .getByLabel('Ảnh minh chứng', { exact: true })
    .setInputFiles({ name: 'evidence.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
  await page.getByRole('button', { name: 'Tải ảnh minh chứng', exact: true }).click();
  await expect(page.getByText(/Đã lưu ảnh evidence.png/)).toBeVisible();
  await page.getByRole('button', { name: 'Kiểm tra phản ánh', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận gửi phản ánh' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Trạng thái hoặc thời hạn' }),
  ).toBeVisible();
  await page.route('**/api/receipts/lookup', (route) =>
    route.fulfill({ json: { ...receipt, canComplain: false } }),
  );
  await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
  await expect(page.getByText('Đã hết thời hạn gửi phản ánh cho đơn này.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gửi phản ánh về hoa' })).toHaveCount(0);
});

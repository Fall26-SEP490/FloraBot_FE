import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { components } from '../../packages/contracts/src/generated/api';

const id = '30000000-0000-0000-0000-000000000099';
const token = 'ABCD2345';
const account = '001234567890';
const receipt: components['schemas']['ReceiptResponse'] = {
  orderId: id,
  orderCode: 'FB-REFUND-001',
  status: 'DISPENSE_FAILED',
  createdAt: '2026-10-07T10:00:00Z',
  subtotal: 350000,
  discount: 0,
  total: 350000,
  completedAt: null,
  disputeDeadline: null,
  hasComplaint: false,
  canComplain: false,
  refundInformationProvided: false,
  refunds: { pendingAmount: 350000, paidAmount: 0 },
  items: [
    {
      name: 'Bó hoa cúc dành tặng mẹ',
      quantity: 1,
      unitPrice: 350000,
      total: 350000,
      status: 'FAILED',
    },
  ],
};
test.beforeEach(async ({ page }) => {
  await page.route('**/api/receipts/lookup', (route) => route.fulfill({ json: receipt }));
  await page.goto(`/receipt#order=${id}&token=${token}`);
  await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
});

for (const width of [390, 1440])
  test(`Refund account review, privacy and accessibility at ${width}`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await context.addCookies([
      { name: 'portal-session', value: 'expired-fixture', domain: '127.0.0.1', path: '/' },
    ]);
    let writes = 0;
    await page.route('**/flows/submit_refund_info', async (route) => {
      writes++;
      expect(route.request().headers()['cookie']).toBeUndefined();
      expect(route.request().postDataJSON()).toEqual({
        p_order: id,
        p_tracking: token,
        p_bank: 'ACB',
        p_account_enc: account,
        p_holder: 'Nguyen Van A',
      });
      await route.fulfill({ json: { result: null } });
    });
    await page.getByRole('button', { name: 'Kiểm tra tài khoản', exact: true }).click();
    await expect(page.getByLabel('Tên ngân hàng', { exact: true })).toBeFocused();
    await expect(page.locator('#refund-bank-error')).toContainText('Nhập tên ngân hàng');
    await page.getByLabel('Tên ngân hàng', { exact: true }).fill('ACB');
    await page.getByLabel('Tên chủ tài khoản', { exact: true }).fill('Nguyen Van A');
    await page.getByLabel('Số tài khoản ngân hàng', { exact: true }).fill(account);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.getByRole('button', { name: 'Kiểm tra tài khoản', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Kiểm tra trước khi gửi' })).toBeFocused();
    await expect(page.getByText('Số tài khoản đã che, kết thúc bằng 7890.')).toBeVisible();
    expect(writes).toBe(0);
    await page.getByRole('button', { name: 'Sửa thông tin', exact: true }).click();
    await expect(page.getByLabel('Tên ngân hàng', { exact: true })).toBeFocused();
    await expect(page.getByLabel('Số tài khoản ngân hàng', { exact: true })).toHaveValue(account);
    expect(writes).toBe(0);
    await page.getByRole('button', { name: 'Kiểm tra tài khoản', exact: true }).click();
    expect(await page.locator('body').innerText()).not.toContain(account);
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
    ).not.toContain(account);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `.impeccable/review/refund-account-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Xác nhận gửi tài khoản' }).click();
    await expect(page.getByRole('status')).toContainText('Đã gửi tài khoản nhận hoàn');
    expect(writes).toBe(1);
    await expect(
      page.getByText('Đã nhận thông tin tài khoản hoàn tiền. Khoản hoàn đang chờ được xử lý.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Đổi tài khoản nhận hoàn' }).click();
    await expect(page.getByLabel('Số tài khoản ngân hàng', { exact: true })).toHaveValue('');
    await page.getByLabel('Số tài khoản ngân hàng', { exact: true }).fill(account);
    await page.getByRole('button', { name: 'Hủy nhập' }).click();
    await page.getByRole('button', { name: 'Đổi tài khoản nhận hoàn' }).click();
    await expect(page.getByLabel('Số tài khoản ngân hàng', { exact: true })).toHaveValue('');
  });

test('Lost refund-account response clears inputs and never retries automatically', async ({
  page,
}) => {
  let writes = 0;
  await page.route('**/flows/submit_refund_info', (route) => {
    writes++;
    return route.abort();
  });
  await page.getByLabel('Tên ngân hàng', { exact: true }).fill('ACB');
  await page.getByLabel('Tên chủ tài khoản', { exact: true }).fill('Nguyen Van A');
  await page.getByLabel('Số tài khoản ngân hàng', { exact: true }).fill(account);
  await page.getByRole('button', { name: 'Kiểm tra tài khoản', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận gửi tài khoản' }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Chưa xác nhận được kết quả gửi' }),
  ).toBeVisible();
  await expect(page.getByLabel('Số tài khoản ngân hàng', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xác nhận gửi tài khoản' })).toHaveCount(0);
  expect(writes).toBe(1);
  await page.getByRole('button', { name: 'Xóa thông tin', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tài khoản nhận hoàn', exact: true })).toHaveCount(
    0,
  );
});

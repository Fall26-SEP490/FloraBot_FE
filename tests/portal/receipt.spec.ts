import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { components } from '../../packages/contracts/src/generated/api';

const id = '30000000-0000-0000-0000-000000000001';
const token = 'ABCD2345';
const receipt: components['schemas']['ReceiptResponse'] = {
  orderId: id,
  orderCode: 'FB-TEST-001',
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
  items: [
    {
      name: 'Bó hoa cúc dành tặng mẹ',
      quantity: 1,
      unitPrice: 350000,
      total: 350000,
      status: 'PICKED_UP',
    },
  ],
};

for (const width of [390, 1440]) {
  test(`Public receipt keeps capability private and accessible at ${width}`, async ({
    page,
    context,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    await context.addCookies([
      { name: 'portal-session', value: 'expired-session-fixture', domain: '127.0.0.1', path: '/' },
    ]);
    let calls = 0;
    await page.route('**/api/receipts/lookup', async (route) => {
      calls++;
      expect(route.request().postDataJSON()).toEqual({ orderId: id, trackingToken: token });
      expect(route.request().headers()['cookie']).toBeUndefined();
      expect(route.request().url()).not.toContain(token);
      await route.fulfill({ json: receipt });
    });
    await page.goto(`/receipt#order=${id}&token=${token}`);
    await expect(page).toHaveURL(/\/receipt$/);
    await expect(page.getByLabel('Mã tra cứu', { exact: true })).toHaveValue(token);
    await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Đơn FB-TEST-001' })).toBeFocused();
    await expect(page.getByText('Bó hoa cúc dành tặng mẹ')).toBeVisible();
    expect(calls).toBe(1);
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
    ).not.toContain(token);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `.impeccable/review/receipt-${width}.png`, fullPage: true });
    await page.reload();
    await expect(page.getByLabel('Mã tra cứu', { exact: true })).toHaveValue('');
    await expect(page.getByRole('heading', { name: 'Đơn FB-TEST-001' })).toHaveCount(0);
  });
}

test('Receipt validates input, handles denial and clears an in-flight lookup', async ({ page }) => {
  await page.goto('/receipt');
  await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Kiểm tra ID biên nhận');
  await page.getByLabel('ID biên nhận', { exact: true }).fill(id);
  await page.getByLabel('Mã tra cứu', { exact: true }).fill(token);
  await page.route('**/api/receipts/lookup', (route) => route.fulfill({ status: 404 }));
  await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Không tìm thấy biên nhận');
  await page.unroute('**/api/receipts/lookup');
  let release: (() => void) | undefined;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/receipts/lookup', async (route) => {
    await gate;
    await route.fulfill({ json: receipt });
  });
  await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đang tra cứu…' })).toBeDisabled();
  await page.getByRole('button', { name: 'Xóa thông tin' }).click();
  release?.();
  await expect(page.getByLabel('ID biên nhận', { exact: true })).toBeFocused();
  await expect(page.getByLabel('Mã tra cứu', { exact: true })).toHaveValue('');
  await expect(page.getByRole('heading', { name: 'Đơn FB-TEST-001' })).toHaveCount(0);
});

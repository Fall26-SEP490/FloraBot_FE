import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const id = '30000000-0000-0000-0000-000000000001';
const token = 'ABCD2345';
const storageKey = 'florabot-personal-receipts-v1';
const receipt = {
  orderId: id,
  orderCode: 'FB-GUEST-001',
  status: 'COMPLETED',
  createdAt: '2026-10-07T10:00:00Z',
  subtotal: 350000,
  discount: 0,
  total: 350000,
  completedAt: '2026-10-07T10:05:00Z',
  disputeDeadline: null,
  hasComplaint: false,
  canComplain: false,
  refundInformationProvided: false,
  refunds: { pendingAmount: 0, paidAmount: 0 },
  items: [],
};

for (const width of [390, 1440])
  test(`Guest saves completed purchase explicitly and removes local history ${width}`, async ({
    page,
    browser,
    baseURL,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    let lookups = 0;
    await page.route('**/api/receipts/lookup', (route) => {
      lookups++;
      expect(route.request().postDataJSON()).toEqual({ orderId: id, trackingToken: token });
      expect(route.request().headers().cookie).toBeUndefined();
      return route.fulfill({ json: receipt });
    });
    await page.goto(`/receipt#order=${id}&token=${token}`);
    await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
    const save = page.getByRole('button', { name: 'Lưu vào lịch sử trên thiết bị' });
    await expect(save).toBeDisabled();
    expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
    await page.getByRole('checkbox', { name: /Đây là thiết bị riêng/ }).check();
    await save.click();
    await save.click();
    expect(
      await page.evaluate(
        (key) => JSON.parse(localStorage.getItem(key) || '[]').length,
        storageKey,
      ),
    ).toBe(1);
    await page.getByRole('link', { name: 'Biên nhận đã lưu trên thiết bị này' }).click();
    await expect(page.getByRole('link', { name: 'Xem đơn FB-GUEST-001' })).toBeVisible();
    await page.reload();
    await expect(page.getByRole('link', { name: 'Xem đơn FB-GUEST-001' })).toBeVisible();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    const isolated = await browser.newContext({ baseURL });
    const other = await isolated.newPage();
    await other.goto('/lich-su-mua');
    await expect(other.getByRole('link', { name: 'Xem đơn FB-GUEST-001' })).toHaveCount(0);
    await isolated.close();
    await page.getByRole('link', { name: 'Xem đơn FB-GUEST-001' }).click();
    await expect(page).toHaveURL(/\/receipt$/);
    await expect(page.getByLabel('Mã tra cứu', { exact: true })).toHaveValue(token);
    await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Đơn FB-GUEST-001' })).toBeVisible();
    expect(lookups).toBe(2);
    await page.goto('/lich-su-mua');
    await page.getByRole('button', { name: 'Xóa bản lưu đơn FB-GUEST-001' }).click();
    await page.reload();
    await expect(page.getByRole('link', { name: 'Xem đơn FB-GUEST-001' })).toHaveCount(0);
    expect(lookups).toBe(2);
  });

test('Pending receipt cannot enter completed purchase history', async ({ page }) => {
  await page.route('**/api/receipts/lookup', (route) =>
    route.fulfill({ json: { ...receipt, status: 'AWAITING_PAYMENT', completedAt: null } }),
  );
  await page.goto(`/receipt#order=${id}&token=${token}`);
  await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
  await expect(page.getByText('Đang chờ thanh toán', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lưu vào lịch sử trên thiết bị' })).toHaveCount(0);
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
});

test('Corrupt local history can be cleared without sending a capability', async ({ page }) => {
  await page.goto('/lich-su-mua');
  await page.evaluate((key) => localStorage.setItem(key, 'invalid-json'), storageKey);
  await page.reload();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Chưa đọc được biên nhận');
  await page.getByRole('button', { name: 'Xóa tất cả bản lưu' }).click();
  await page.getByRole('button', { name: 'Xác nhận xóa danh sách' }).click();
  await expect(page.getByText(/Chưa có biên nhận đã lưu/)).toBeVisible();
  expect(await page.evaluate((key) => localStorage.getItem(key), storageKey)).toBeNull();
});

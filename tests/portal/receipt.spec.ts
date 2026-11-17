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
  subtotal: 390000,
  discount: 0,
  total: 390000,
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
    {
      name: 'Nơ trang trí',
      quantity: 2,
      unitPrice: 20000,
      total: 40000,
      status: 'PICKED_UP',
    },
  ],
};

test('An uncertain complaint keeps the draft and requires a receipt refresh before retry', async ({
  page,
}) => {
  let reads = 0;
  let sends = 0;
  await page.route('**/api/receipts/lookup', (route) => {
    reads++;
    return route.fulfill({ json: receipt });
  });
  await page.route(`**/api/receipts/${id}/evidence`, (route) =>
    route.fulfill({ json: { reference: 'evidence:v1:test-photo' } }),
  );
  await page.route('**/api/receipts/flows/open_dispute', (route) => {
    sends++;
    return route.fulfill({ status: 500, json: {} });
  });
  await page.goto(`/phan-anh#order=${id}&token=${token}`);
  const form = page.getByRole('form', { name: 'Phản ánh về hoa' });
  await form.getByLabel('Vấn đề với bó hoa').fill('Bó hoa bị dập khi nhận tại tủ.');
  await form
    .locator('input[type=file]')
    .setInputFiles({ name: 'hoa.png', mimeType: 'image/png', buffer: Buffer.from('mock') });
  await form.getByRole('button', { name: 'Tải ảnh minh chứng' }).click();
  await expect(form.getByRole('status')).toContainText('Đã lưu ảnh');
  await form.getByRole('button', { name: 'Kiểm tra phản ánh' }).click();
  await form.getByRole('button', { name: 'Xác nhận gửi phản ánh' }).click();
  const check = form.getByRole('button', { name: 'Kiểm tra trạng thái biên nhận' });
  await expect(check).toBeVisible();
  await expect(form.getByLabel('Vấn đề với bó hoa')).toHaveValue('Bó hoa bị dập khi nhận tại tủ.');
  await expect(form.getByRole('status')).toContainText('hoa.png');
  await expect(form.getByRole('button', { name: 'Hủy phản ánh' })).toBeEnabled();
  await page.getByRole('button', { name: 'Cập nhật trạng thái', exact: true }).click();
  await expect(form.getByRole('button', { name: 'Kiểm tra phản ánh' })).toBeEnabled();
  await expect(form.getByLabel('Vấn đề với bó hoa')).toHaveValue('Bó hoa bị dập khi nhận tại tủ.');
  expect(reads).toBe(2);
  expect(sends).toBe(1);
  await form.getByRole('button', { name: 'Kiểm tra phản ánh' }).click();
  await form.getByRole('button', { name: 'Xác nhận gửi phản ánh' }).click();
  await page.route('**/api/receipts/lookup', (route) =>
    route.fulfill({ json: { ...receipt, canComplain: false } }),
  );
  await page.getByRole('button', { name: 'Cập nhật trạng thái', exact: true }).click();
  await expect(form.getByLabel('Vấn đề với bó hoa')).toHaveValue('Bó hoa bị dập khi nhận tại tủ.');
  await expect(form.getByRole('button', { name: 'Hủy phản ánh' })).toBeEnabled();
  await form.getByRole('button', { name: 'Hủy phản ánh' }).click();
  await expect(form).toHaveCount(0);
});

for (const width of [375, 390, 1440]) {
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
    await expect(page.getByRole('heading', { name: 'Đơn FB-TEST-001' })).toBeFocused();
    await expect(page.getByLabel('Mã tra cứu', { exact: true })).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Lưu biên nhận trên thiết bị riêng' }),
    ).toHaveCount(0);
    await expect(page.getByRole('checkbox')).toHaveCount(0);
    await expect(page.getByRole('form', { name: 'Phản ánh về hoa' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Phản ánh về hoa', exact: true })).toHaveAttribute(
      'href',
      /^\/phan-anh#/,
    );
    await expect(page.getByText('Bó hoa cúc dành tặng mẹ')).toBeVisible();
    await expect(
      page.locator('.receipt-items li').filter({ hasText: 'Nơ trang trí' }),
    ).toContainText('40.000');
    await expect(page.locator('.receipt-totals dt')).toHaveText(['Tiền hàng', 'Tổng đơn']);
    if (width < 768) await expect(page.locator('.site-hotline-button')).toBeHidden();
    if (width < 580) {
      const idBox = await page.getByLabel('ID biên nhận', { exact: true }).boundingBox();
      const tokenBox = await page.getByLabel('Mã tra cứu', { exact: true }).boundingBox();
      expect(Math.abs(idBox!.width - tokenBox!.width)).toBeLessThan(1);
    }
    if (width >= 1000) {
      const formBox = await page.locator('.receipt-lookup').boundingBox();
      const paperBox = await page.locator('.receipt-paper').boundingBox();
      expect(formBox!.x + formBox!.width).toBeLessThan(paperBox!.x);
      expect(Math.abs(formBox!.y - paperBox!.y)).toBeLessThan(2);
    }
    await expect(page.getByRole('button', { name: 'Xóa thông tin', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Hủy tra cứu', exact: true })).toHaveCount(0);
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
    await expect(page.getByRole('heading', { name: 'Đơn FB-TEST-001' })).toBeVisible();
    await expect(page.getByLabel('Mã tra cứu', { exact: true })).toBeVisible();
    expect(calls).toBe(2);
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
    ).not.toContain(token);
  });
}

test('A failed receipt link leaves the codes available for manual retry', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/receipts/lookup', (route) => {
    calls++;
    return calls === 1 ? route.fulfill({ status: 500 }) : route.fulfill({ json: receipt });
  });
  await page.goto(`/receipt#order=${id}&token=${token}`);
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Chưa tải được biên nhận');
  await expect(page.getByLabel('Mã tra cứu', { exact: true })).toHaveValue(token);
  expect(calls).toBe(1);
  await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đơn FB-TEST-001' })).toBeVisible();
  expect(calls).toBe(2);
});

test('Receipt validates input, handles denial and cancels lookup without losing entered codes', async ({
  page,
}) => {
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
  await page.getByRole('button', { name: 'Hủy tra cứu', exact: true }).click();
  release?.();
  await expect(page.getByLabel('ID biên nhận', { exact: true })).toBeFocused();
  await expect(page.getByLabel('ID biên nhận', { exact: true })).toHaveValue(id);
  await expect(page.getByLabel('Mã tra cứu', { exact: true })).toHaveValue(token);
  await expect(page.getByRole('button', { name: 'Hủy tra cứu', exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Đơn FB-TEST-001' })).toHaveCount(0);
});

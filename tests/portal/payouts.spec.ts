import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const row = {
  id: 'withdrawal-1',
  sellerId: 'seller-1',
  shopName: 'Tiệm Hoa Ban Mai',
  amount: 100000,
  status: 'PENDING',
  createdAt: '2026-10-07T10:00:00Z',
  approvedBy: null,
  approvedAt: null,
  paidBy: null,
  paidAt: null,
  rejectReason: null,
};
const detail = {
  withdrawal: row,
  availableBalance: 200000,
  bankStatus: 'READY',
  bankName: 'Test Bank',
  holder: 'TEST HOLDER',
  accountSuffix: '5678',
  canAccessBank: false,
};
async function setup(page: Page) {
  await page.route('**/api/admin/evidence/*/*', (route) =>
    route.fulfill({
      json:
        route.request().method() === 'POST'
          ? { reference: 'evidence:v1:financial-proof', expiresAt: '2099-01-01T00:00:00Z' }
          : { items: [], hasMore: false },
    }),
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { id: 'admin', name: 'Quản trị', role: 'ADMIN' } }),
  );
  await page.route('**/api/admin/sellers?*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/admin/slots', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/packages', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/admin/incidents?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
}
for (const width of [390, 1440]) {
  test(`Withdrawal approval, rejection validation and accessibility ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(page);
    let status = 'PENDING';
    let attempts = 0;
    await page.route('**/api/admin/withdrawals?*', (route) =>
      route.fulfill({ json: { items: [{ ...row, status }], page: 1, hasMore: false } }),
    );
    await page.route('**/api/admin/withdrawals/withdrawal-1', (route) =>
      route.fulfill({ json: { ...detail, withdrawal: { ...row, status } } }),
    );
    await page.route('**/flows/approve_withdrawal', (route) => {
      attempts++;
      expect(route.request().postDataJSON()).toEqual({ p_w: row.id });
      status = 'APPROVED';
      return route.fulfill({ json: { result: null } });
    });
    await page.route('**/flows/reject_withdrawal', (route) => {
      attempts++;
      expect(route.request().postDataJSON()).toEqual({
        p_w: row.id,
        p_reason: 'Shop yêu cầu kiểm tra lại tài khoản.',
      });
      status = 'REJECTED';
      return route.fulfill({ json: { result: null } });
    });
    await page.goto('/admin');
    const section = page.locator('.admin-withdrawals');
    await section.locator('summary').click();
    await section.getByRole('button', { name: 'Duyệt yêu cầu', exact: true }).click();
    await section.getByRole('button', { name: 'Kiểm tra thao tác' }).click();
    await expect(section.getByRole('button', { name: 'Xác nhận thao tác' })).toBeFocused();
    expect(attempts).toBe(0);
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
    await section.screenshot({ path: `.impeccable/review/portal-payouts-${width}.png` });
    await section.getByRole('button', { name: 'Xác nhận thao tác' }).click();
    await expect(section.getByRole('status')).toContainText('Đã duyệt yêu cầu');
    await expect(
      section.getByText('Bước chi cần một admin khác người đã duyệt yêu cầu.'),
    ).toBeVisible();
    await expect(section.getByRole('button', { name: 'Xem tài khoản để chi' })).toHaveCount(0);
    await section.getByRole('button', { name: 'Từ chối yêu cầu' }).click();
    await section.getByRole('button', { name: 'Kiểm tra thao tác' }).click();
    await expect(section.getByLabel('Lý do từ chối yêu cầu')).toBeFocused();
    await section.getByLabel('Lý do từ chối yêu cầu').fill('Shop yêu cầu kiểm tra lại tài khoản.');
    await section.getByRole('button', { name: 'Kiểm tra thao tác' }).click();
    await section.getByRole('button', { name: 'Xác nhận thao tác' }).click();
    await expect(section.getByRole('status')).toContainText('Đã từ chối yêu cầu');
    expect(attempts).toBe(2);
  });
}

test('Distinct payer explicitly reveals snapshot, clears it, and records proof without repeating a transfer', async ({
  page,
}) => {
  await page.clock.install();
  await setup(page);
  let reveals = 0;
  let paid = false;
  let attempts = 0;
  const account = '000012345678';
  await page.route('**/api/admin/withdrawals?*', (route) =>
    route.fulfill({
      json: { items: [{ ...row, status: paid ? 'PAID' : 'APPROVED' }], page: 1, hasMore: false },
    }),
  );
  await page.route('**/api/admin/withdrawals/withdrawal-1', (route) =>
    route.fulfill({
      json: {
        ...detail,
        withdrawal: { ...row, status: paid ? 'PAID' : 'APPROVED' },
        canAccessBank: !paid,
      },
    }),
  );
  await page.route('**/bank-details', (route) => {
    reveals++;
    expect(route.request().method()).toBe('POST');
    return route.fulfill({ json: { bankName: 'Test Bank', holder: 'TEST HOLDER', account } });
  });
  await page.route('**/flows/pay_withdrawal', (route) => {
    attempts++;
    expect(route.request().postDataJSON()).toEqual({
      p_w: row.id,
      p_proof_url: 'evidence:v1:financial-proof',
    });
    paid = true;
    return route.abort();
  });
  await page.goto('/admin');
  const section = page.locator('.admin-withdrawals');
  await section.locator('summary').click();
  await expect(section.getByRole('button', { name: 'Ghi nhận đã chuyển khoản' })).toBeDisabled();
  await section.getByRole('button', { name: 'Xem tài khoản để chi' }).click();
  await expect(section.getByText(account, { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain(account);
  await page.clock.fastForward(61000);
  await expect(section.getByText(account, { exact: true })).toHaveCount(0);
  await section.getByRole('button', { name: 'Xem tài khoản để chi' }).click();
  await expect(section.getByText(account, { exact: true })).toBeVisible();
  await section.locator('summary').click();
  await section.locator('summary').click();
  await expect(section.getByText(account, { exact: true })).toHaveCount(0);
  await section.getByRole('button', { name: 'Xem tài khoản để chi' }).click();
  await section.getByRole('button', { name: 'Ghi nhận đã chuyển khoản' }).click();
  await section
    .getByLabel('Ảnh minh chứng')
    .setInputFiles({ name: 'proof.png', mimeType: 'image/png', buffer: Buffer.from('test image') });
  await section.getByRole('button', { name: 'Tải ảnh minh chứng', exact: true }).click();
  await expect(section.getByText(/Đã lưu ảnh proof.png/)).toBeVisible();
  await section.getByRole('button', { name: 'Kiểm tra thao tác' }).click();
  await expect(
    section.getByText('Chỉ xác nhận sau khi đã chuyển khoản và đối chiếu chứng từ.'),
  ).toBeVisible();
  await section.getByRole('checkbox').check();
  await section.getByRole('button', { name: 'Kiểm tra thao tác' }).click();
  await section.getByRole('button', { name: 'Xác nhận thao tác' }).click();
  await expect(
    section.getByRole('status').filter({ hasText: 'Không chuyển tiền lần nữa' }),
  ).toBeVisible();
  await expect(section.locator('summary')).toContainText('Đã ghi nhận chuyển tiền');
  await expect(section.getByText(account, { exact: true })).toHaveCount(0);
  expect(attempts).toBe(1);
  expect(reveals).toBe(3);
});

test('Background refresh during pointer activation preserves explicit bank reveal', async ({
  page,
}) => {
  await setup(page);
  let reads = 0;
  let reveals = 0;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/admin/withdrawals?*', (route) =>
    route.fulfill({ json: { items: [{ ...row, status: 'APPROVED' }], page: 1, hasMore: false } }),
  );
  await page.route('**/api/admin/withdrawals/withdrawal-1', async (route) => {
    reads++;
    if (reads > 1) await gate;
    await route.fulfill({
      json: { ...detail, withdrawal: { ...row, status: 'APPROVED' }, canAccessBank: true },
    });
  });
  await page.route('**/bank-details', (route) => {
    reveals++;
    return route.fulfill({
      json: { bankName: 'Test Bank', holder: 'TEST HOLDER', account: '000012345678' },
    });
  });
  await page.goto('/admin');
  const section = page.locator('.admin-withdrawals');
  await section.locator('summary').click();
  const reveal = section.getByRole('button', { name: 'Xem tài khoản để chi' });
  await reveal.hover();
  await page.mouse.down();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => reads).toBeGreaterThan(1);
  await page.mouse.up();
  release();
  await expect.poll(() => reveals).toBe(1);
  await expect(section.getByText('000012345678', { exact: true })).toBeVisible();
});

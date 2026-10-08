import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const row = {
  id: 'refund-1',
  orderId: 'order-1',
  orderCode: 'FB-REFUND-1',
  amount: 100000,
  status: 'PENDING',
  reason: 'Hoa bị dập khi nhận.',
  createdAt: '2026-10-08T00:00:00Z',
  approvedBy: 'other-admin',
  requiresApproval: false,
  paidBy: null,
  paidAt: null,
};
const bank = { bankName: 'Test Bank', holder: 'TEST HOLDER', account: '001234567890' };
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
  for (const name of ['incidents', 'withdrawals', 'complaints'])
    await page.route(`**/api/admin/${name}?*`, (route) =>
      route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
    );
}
for (const width of [390, 1440])
  test(`Refund proof, private bank reveal and payout recording ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(page);
    await page.clock.install();
    let paid = false;
    let attempts = 0;
    await page.route('**/api/admin/refunds?*', (route) =>
      route.fulfill({ json: { items: paid ? [] : [row], page: 1, hasMore: false } }),
    );
    await page.route('**/api/admin/refunds/refund-1', (route) =>
      route.fulfill({
        json: {
          refund: { ...row, status: paid ? 'SUCCEEDED' : 'PENDING' },
          bankStatus: 'READY',
          canApprove: false,
          canAccessBank: !paid,
        },
      }),
    );
    await page.route('**/api/admin/refunds/refund-1/bank-details', (route) =>
      route.fulfill({ json: bank }),
    );
    await page.route('**/flows/confirm_refund', (route) => {
      attempts++;
      expect(route.request().postDataJSON()).toEqual({
        p_refund: row.id,
        p_proof_url: 'evidence:v1:financial-proof',
      });
      paid = true;
      return route.fulfill({ json: { result: null } });
    });
    await page.goto('/admin/refunds');
    const section = page.locator('.admin-refunds');
    await section.locator('summary').click();
    await expect(
      section.getByRole('button', { name: 'Ghi nhận đã chi hoàn', exact: true }),
    ).toBeDisabled();
    await section.getByRole('button', { name: 'Xem tài khoản nhận hoàn', exact: true }).click();
    await expect(section.getByText(bank.account, { exact: true })).toBeVisible();
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
    ).not.toContain(bank.account);
    await page.clock.fastForward(61000);
    await expect(section.getByText(bank.account, { exact: true })).toHaveCount(0);
    await section.getByRole('button', { name: 'Xem tài khoản nhận hoàn', exact: true }).click();
    await section.getByRole('button', { name: 'Ghi nhận đã chi hoàn', exact: true }).click();
    await expect(section.getByLabel('Ảnh minh chứng')).toBeFocused();
    await section.getByRole('button', { name: 'Kiểm tra chứng từ hoàn' }).click();
    await expect(section.getByText('Vui lòng tải ảnh chứng từ trước khi xác nhận.')).toBeVisible();
    await section.getByLabel('Ảnh minh chứng').setInputFiles({
      name: 'proof.png',
      mimeType: 'image/png',
      buffer: Buffer.from('test image'),
    });
    await section.getByRole('button', { name: 'Tải ảnh minh chứng', exact: true }).click();
    await expect(section.getByText(/Đã lưu ảnh proof.png/)).toBeVisible();
    await section.screenshot({ path: `.impeccable/review/financial-upload-${width}.png` });
    expect(
      (
        await new AxeBuilder({ page })
          .include('.admin-refunds')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await section.getByRole('button', { name: 'Kiểm tra chứng từ hoàn' }).click();
    await expect(
      section.getByText('Chỉ xác nhận sau khi đã chuyển tiền và đối chiếu chứng từ.'),
    ).toBeVisible();
    await section.getByRole('checkbox').check();
    await section.getByRole('button', { name: 'Kiểm tra chứng từ hoàn' }).click();
    await expect(section.locator('h4')).toBeFocused();
    await section.getByRole('button', { name: 'Sửa chứng từ hoàn' }).click();
    await expect(section.getByLabel('Ảnh minh chứng')).toBeFocused();
    expect(attempts).toBe(0);
    await section.getByRole('button', { name: 'Kiểm tra chứng từ hoàn' }).click();
    expect(
      (
        await new AxeBuilder({ page })
          .include('.admin-refunds')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await section.screenshot({ path: `.impeccable/review/admin-refunds-${width}.png` });
    await section.getByRole('button', { name: 'Xác nhận khoản hoàn' }).click();
    await expect(section.getByRole('status')).toHaveText(
      'Đã ghi nhận chi hoàn và cập nhật sổ cái.',
    );
    await expect(section.getByText(bank.account, { exact: true })).toHaveCount(0);
    expect(attempts).toBe(1);
  });

test('Automatic refund approval does not allow the approver to pay', async ({ page }) => {
  await setup(page);
  let approved = false;
  await page.route('**/api/admin/refunds?*', (route) =>
    route.fulfill({
      json: { items: [{ ...row, requiresApproval: !approved }], page: 1, hasMore: false },
    }),
  );
  await page.route('**/api/admin/refunds/refund-1', (route) =>
    route.fulfill({
      json: {
        refund: { ...row, requiresApproval: !approved },
        bankStatus: 'READY',
        canApprove: !approved,
        canAccessBank: false,
      },
    }),
  );
  await page.route('**/flows/approve_refund', (route) => {
    expect(route.request().postDataJSON()).toEqual({ p_refund: row.id });
    approved = true;
    return route.fulfill({ json: { result: null } });
  });
  await page.goto('/admin/refunds');
  const section = page.locator('.admin-refunds');
  await section.locator('summary').click();
  await section.getByRole('button', { name: 'Duyệt khoản hoàn', exact: true }).click();
  await expect(section.locator('h4')).toBeFocused();
  expect(approved).toBe(false);
  await section.getByRole('button', { name: 'Xác nhận khoản hoàn' }).click();
  await expect(section.getByRole('status')).toHaveText(
    'Đã duyệt khoản hoàn. Bước chi cần một admin khác.',
  );
  await expect(
    section.getByRole('button', { name: 'Xem tài khoản nhận hoàn', exact: true }),
  ).toHaveCount(0);
  await expect(
    section.getByText('Khoản hoàn đã được duyệt. Cần admin khác người duyệt thực hiện bước chi.'),
  ).toBeVisible();
});

test('Lost payout response blocks repeat until explicit reload discovers payment', async ({
  page,
}) => {
  await setup(page);
  let paid = false;
  let attempts = 0;
  await page.route('**/api/admin/refunds?*', (route) =>
    route.fulfill({ json: { items: [row], page: 1, hasMore: false } }),
  );
  await page.route('**/api/admin/refunds/refund-1', (route) =>
    route.fulfill({
      json: {
        refund: {
          ...row,
          status: paid ? 'SUCCEEDED' : 'PENDING',
          paidAt: paid ? '2026-10-08T01:00:00Z' : null,
        },
        bankStatus: 'READY',
        canApprove: false,
        canAccessBank: !paid,
      },
    }),
  );
  await page.route('**/api/admin/refunds/refund-1/bank-details', (route) =>
    route.fulfill({ json: bank }),
  );
  await page.route('**/flows/confirm_refund', (route) => {
    attempts++;
    return route.abort();
  });
  await page.goto('/admin/refunds');
  const section = page.locator('.admin-refunds');
  await section.locator('summary').click();
  await section.getByRole('button', { name: 'Xem tài khoản nhận hoàn', exact: true }).click();
  await section.getByRole('button', { name: 'Ghi nhận đã chi hoàn', exact: true }).click();
  await section
    .getByLabel('Ảnh minh chứng')
    .setInputFiles({ name: 'proof.png', mimeType: 'image/png', buffer: Buffer.from('test image') });
  await section.getByRole('button', { name: 'Tải ảnh minh chứng', exact: true }).click();
  await expect(section.getByText(/Đã lưu ảnh proof.png/)).toBeVisible();
  await section.getByRole('checkbox').check();
  await section.getByRole('button', { name: 'Kiểm tra chứng từ hoàn' }).click();
  await section.getByRole('button', { name: 'Xác nhận khoản hoàn' }).click();
  await expect(section.getByRole('alert')).toContainText('Không chuyển tiền lần nữa');
  await expect(section.getByText(bank.account, { exact: true })).toHaveCount(0);
  await expect(
    section.getByRole('button', { name: 'Ghi nhận đã chi hoàn', exact: true }),
  ).toHaveCount(0);
  paid = true;
  await section.getByRole('button', { name: 'Tải lại khoản hoàn' }).click();
  await expect(section.getByText(/Đã ghi nhận chi lúc/)).toBeVisible();
  expect(attempts).toBe(1);
});

test('A bank response arriving after the tab is hidden is discarded', async ({ page }) => {
  await setup(page);
  await page.route('**/api/admin/refunds?*', (route) =>
    route.fulfill({ json: { items: [row], page: 1, hasMore: false } }),
  );
  await page.route('**/api/admin/refunds/refund-1', (route) =>
    route.fulfill({
      json: { refund: row, bankStatus: 'READY', canApprove: false, canAccessBank: true },
    }),
  );
  let release!: () => void;
  let started = false;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/admin/refunds/refund-1/bank-details', async (route) => {
    started = true;
    await held;
    await route.fulfill({ json: bank });
  });
  await page.goto('/admin/refunds');
  const section = page.locator('.admin-refunds');
  await section.locator('summary').click();
  await section.getByRole('button', { name: 'Xem tài khoản nhận hoàn', exact: true }).click();
  await expect.poll(() => started).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  release();
  await expect(
    section.getByRole('button', { name: 'Xem tài khoản nhận hoàn', exact: true }),
  ).toBeEnabled();
  await expect(section.getByText(bank.account, { exact: true })).toHaveCount(0);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await section.getByRole('button', { name: 'Xem tài khoản nhận hoàn', exact: true }).click();
  await expect(section.getByText(bank.account, { exact: true })).toBeVisible();
  await section.locator('summary').click();
  await section.locator('summary').click();
  await expect(section.getByText(bank.account, { exact: true })).toHaveCount(0);
});

test('Failed private proof upload cannot record a payout and retries explicitly', async ({
  page,
}) => {
  await setup(page);
  let uploads = 0;
  let payouts = 0;
  await page.route('**/api/admin/refunds?*', (route) =>
    route.fulfill({ json: { items: [row], page: 1, hasMore: false } }),
  );
  await page.route('**/api/admin/refunds/refund-1', (route) =>
    route.fulfill({
      json: { refund: row, bankStatus: 'READY', canApprove: false, canAccessBank: true },
    }),
  );
  await page.route('**/api/admin/refunds/refund-1/bank-details', (route) =>
    route.fulfill({ json: bank }),
  );
  await page.route('**/api/admin/evidence/confirm_refund/refund-1', (route) => {
    uploads++;
    return route.fulfill(
      uploads === 1
        ? { status: 503, json: { detail: 'Kho ảnh chưa sẵn sàng.' } }
        : { json: { reference: 'evidence:v1:financial-proof' } },
    );
  });
  await page.route('**/flows/confirm_refund', (route) => {
    payouts++;
    return route.fulfill({ json: { result: null } });
  });
  await page.goto('/admin/refunds');
  const section = page.locator('.admin-refunds');
  await section.locator('summary').click();
  await section.getByRole('button', { name: 'Xem tài khoản nhận hoàn', exact: true }).click();
  await section.getByRole('button', { name: 'Ghi nhận đã chi hoàn', exact: true }).click();
  await section
    .getByLabel('Ảnh minh chứng')
    .setInputFiles({ name: 'proof.png', mimeType: 'image/png', buffer: Buffer.from('test image') });
  await section.getByRole('button', { name: 'Tải ảnh minh chứng', exact: true }).click();
  await expect(section.getByText('Kho ảnh chưa sẵn sàng.')).toBeVisible();
  await section.getByRole('checkbox').check();
  await section.getByRole('button', { name: 'Kiểm tra chứng từ hoàn' }).click();
  await expect(section.getByText('Vui lòng tải ảnh chứng từ trước khi xác nhận.')).toBeVisible();
  expect(payouts).toBe(0);
  expect(uploads).toBe(1);
  await section.getByRole('button', { name: 'Tải ảnh minh chứng', exact: true }).click();
  await expect(section.getByText(/Đã lưu ảnh proof.png/)).toBeVisible();
  await section.getByRole('button', { name: 'Kiểm tra chứng từ hoàn' }).click();
  await expect(section.getByRole('button', { name: 'Xác nhận khoản hoàn' })).toBeVisible();
  expect(payouts).toBe(0);
  expect(uploads).toBe(2);
});

test('Completed refund exposes only the authorized proof reader', async ({ page }) => {
  await setup(page);
  const paidRow = { ...row, status: 'SUCCEEDED', paidAt: '2026-10-08T01:00:00Z' };
  await page.route('**/api/admin/refunds?*', (route) =>
    route.fulfill({ json: { items: [paidRow], page: 1, hasMore: false } }),
  );
  await page.route('**/api/admin/refunds/refund-1', (route) =>
    route.fulfill({
      json: {
        refund: paidRow,
        bankStatus: 'NOT_APPLICABLE',
        canApprove: false,
        canAccessBank: false,
      },
    }),
  );
  await page.route('**/api/admin/evidence/confirm_refund/refund-1', (route) =>
    route.fulfill({
      json: {
        items: [
          {
            id: '11111111-1111-4111-8111-111111111111',
            url: 'https://example.invalid/ignored',
            createdAt: paidRow.paidAt,
          },
        ],
        hasMore: false,
      },
    }),
  );
  await page.goto('/admin/refunds');
  const section = page.locator('.admin-refunds');
  await section.locator('summary').click();
  await expect(section.getByRole('link', { name: /Xem chứng từ 1/ })).toHaveAttribute(
    'href',
    '/api/admin/evidence/11111111-1111-4111-8111-111111111111',
  );
});

import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const row = {
  id: 'refund-1',
  payerRole: 'ADMIN',
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
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
  await page.route('**/api/**', (route) =>
    route.fulfill({ status: 501, json: { detail: 'API not mocked in this test' } }),
  );
  await page.route('**/api/admin/refunds/*/seller-submission', (route) =>
    route.fulfill({ status: 404 }),
  );
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
    await section.locator('.admin-shop-list summary').click();
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
  await section.locator('.admin-shop-list summary').click();
  await section.getByRole('button', { name: 'Duyệt khoản hoàn', exact: true }).click();
  await expect(section.locator('h4')).toBeFocused();
  expect(approved).toBe(false);
  await section.getByRole('button', { name: 'Xác nhận khoản hoàn' }).click();
  await expect(section.getByRole('status')).toHaveText(
    'Đã duyệt khoản hoàn giao dịch cũ. Một admin khác thực hiện chi và ghi nhận chứng từ.',
  );
  await expect(
    section.getByRole('button', { name: 'Xem tài khoản nhận hoàn', exact: true }),
  ).toHaveCount(0);
  await expect(
    section.getByText(
      'Khoản hoàn đã được duyệt. Cần admin khác người duyệt thực hiện bước tiếp theo.',
    ),
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
  await section.locator('.admin-shop-list summary').click();
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
  await section.locator('.admin-shop-list summary').click();
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
  await section.locator('.admin-shop-list summary').click();
  await section.locator('.admin-shop-list summary').click();
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
  await section.locator('.admin-shop-list summary').click();
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
  await section.locator('.admin-shop-list summary').click();
  await expect(section.getByRole('link', { name: /Xem chứng từ 1/ })).toHaveAttribute(
    'href',
    '/api/admin/evidence/11111111-1111-4111-8111-111111111111',
  );
});

for (const width of [390, 1440]) {
  test(`Seller-funded refund approval waits for the shop transfer at ${width}`, async ({
    page,
  }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 1000 });
    let approved = false;
    const writes: string[] = [];
    const directRow = { ...row, payerRole: 'SELLER' };
    await page.route('**/api/admin/refunds?*', (route) =>
      route.fulfill({
        json: { items: [{ ...directRow, requiresApproval: !approved }], page: 1, hasMore: false },
      }),
    );
    await page.route('**/api/admin/refunds/refund-1', (route) =>
      route.fulfill({
        json: {
          refund: { ...directRow, requiresApproval: !approved },
          bankStatus: 'NEEDS_UPDATE',
          canApprove: !approved,
          canAccessBank: false,
          canReviewSellerTransfer: false,
        },
      }),
    );
    await page.route('**/api/admin/flows/*', (route) => {
      writes.push(new URL(route.request().url()).pathname);
      expect(route.request().postDataJSON()).toEqual({ p_refund: row.id });
      approved = true;
      return route.fulfill({ json: { result: null } });
    });
    await page.goto('/admin/refunds');
    const section = page.locator('.admin-refunds');
    await section.locator('.admin-shop-list summary').click();
    await section.getByRole('button', { name: 'Duyệt khoản hoàn', exact: true }).click();
    await section.getByRole('button', { name: 'Xác nhận khoản hoàn', exact: true }).click();
    await expect(section.getByRole('status')).toContainText('Shop chuyển khoản cho khách');
    await expect(section.getByText(/Chờ shop mở Hoàn tiền trực tiếp/)).toBeVisible();
    await expect(section.getByText(/Khách cần bổ sung hoặc cập nhật/)).toBeVisible();
    await expect(
      section.getByRole('button', { name: /Xem tài khoản nhận hoàn|Ghi nhận đã chi hoàn/ }),
    ).toHaveCount(0);
    expect(writes).toEqual(['/api/admin/flows/approve_refund']);
    expect(
      (
        await new AxeBuilder({ page })
          .include('#main')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}

test('Admin reviews a Seller transfer without using the legacy bank payout', async ({ page }) => {
  await setup(page);
  let submissionStatus = 'PENDING_REVIEW';
  let bankReads = 0;
  let confirmations = 0;
  const directRow = { ...row, payerRole: undefined };
  await page.route('**/api/admin/refunds?*', (route) =>
    route.fulfill({ json: { items: [directRow], page: 1, hasMore: false } }),
  );
  await page.route('**/api/admin/refunds/refund-1', (route) =>
    route.fulfill({
      json: {
        refund: directRow,
        bankStatus: 'READY',
        canApprove: false,
        canAccessBank: true,
      },
    }),
  );
  await page.route('**/api/admin/refunds/refund-1/seller-submission', (route) =>
    route.fulfill({
      json: {
        id: 'seller-proof',
        shopName: 'Shop hoàn tiền',
        submitterName: 'Người bán',
        amount: 100000,
        currency: 'VND',
        receiverBankName: 'Test Bank',
        receiverBankHolder: 'TEST HOLDER',
        providerReference: 'SELLER-TRANSFER-1',
        transferredAt: '2026-11-10T01:00:00Z',
        evidenceAttachmentId: 'proof-1',
        status: submissionStatus,
      },
    }),
  );
  await page.route('**/api/admin/refunds/refund-1/bank-details', (route) => {
    bankReads++;
    return route.fulfill({ status: 409 });
  });
  await page.route('**/api/admin/flows/confirm_refund', (route) => {
    confirmations++;
    expect(route.request().postDataJSON()).toEqual({
      p_refund: row.id,
      p_proof_url: 'evidence:v1:financial-proof',
    });
    return route.fulfill({ json: { result: null } });
  });
  await page.goto('/admin/refunds');
  const section = page.locator('.admin-refunds');
  await section.locator('.admin-shop-list summary').click();
  await expect(section.getByText('SELLER-TRANSFER-1', { exact: false })).toBeVisible();
  await expect(
    section.getByRole('button', { name: /Xem tài khoản nhận hoàn|Ghi nhận đã chi hoàn/ }),
  ).toHaveCount(0);
  await section
    .getByRole('button', { name: 'Đối chiếu và xác nhận shop đã hoàn', exact: true })
    .click();
  await section.getByLabel('Ảnh minh chứng').setInputFiles({
    name: 'admin-check.png',
    mimeType: 'image/png',
    buffer: Buffer.from('test proof'),
  });
  await section.getByRole('button', { name: 'Tải ảnh minh chứng', exact: true }).click();
  await expect(section.getByText(/Đã lưu ảnh admin-check.png/)).toBeVisible();
  await section.getByRole('checkbox').check();
  await section.getByRole('button', { name: 'Kiểm tra chứng từ hoàn', exact: true }).click();
  await section.getByRole('button', { name: 'Xác nhận khoản hoàn', exact: true }).click();
  await expect(section.getByRole('status')).toHaveText(
    'Đã xác nhận khoản hoàn do shop chuyển khoản.',
  );
  expect(confirmations).toBe(1);
  expect(bankReads).toBe(0);
  submissionStatus = 'REJECTED';
  await section.getByRole('button', { name: 'Tải lại khoản hoàn', exact: true }).click();
  await expect(section.getByText(/Chứng từ đã bị từ chối/)).toBeVisible();
  await expect(
    section.getByRole('button', { name: 'Đối chiếu và xác nhận shop đã hoàn', exact: true }),
  ).toHaveCount(0);
});

test('An older API without refund payer metadata cannot expose an Admin payout', async ({
  page,
}) => {
  await setup(page);
  const oldRow = { ...row, payerRole: undefined };
  await page.route('**/api/admin/refunds?*', (route) =>
    route.fulfill({ json: { items: [oldRow], page: 1, hasMore: false } }),
  );
  await page.route('**/api/admin/refunds/refund-1', (route) =>
    route.fulfill({
      json: { refund: oldRow, bankStatus: 'READY', canApprove: false, canAccessBank: true },
    }),
  );
  await page.goto('/admin/refunds');
  const section = page.locator('.admin-refunds');
  await section.locator('.admin-shop-list summary').click();
  await expect(section.getByRole('alert')).toHaveCount(0);
  await expect(
    section.getByText(/Với đơn thanh toán trực tiếp cho shop, shop chuyển khoản/),
  ).toBeVisible();
  await expect(
    section.getByRole('button', { name: /Xem tài khoản nhận hoàn|Ghi nhận đã chi hoàn/ }),
  ).toHaveCount(0);
});

test('Retired withdrawals have no menu or refund link and the route returns 404', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/api/admin/refunds?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.goto('/admin/refunds');
  await expect(page.locator('a[href="/admin/withdrawals"]')).toHaveCount(0);
  const response = await page.goto('/admin/withdrawals');
  expect(response?.status()).toBe(404);
});

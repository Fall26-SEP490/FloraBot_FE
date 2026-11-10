import { expect, test } from '@playwright/test';

const sellerId = '20000000-0000-0000-0000-000000000099';
const unreadableBankMessage = 'Không đọc được số tài khoản đã lưu. Vui lòng nhập lại để cập nhật.';

for (const readableAfterSave of [true, false]) {
  test(`Shop bank preserves saved names and checks read-back after save (${readableAfterSave})`, async ({
    page,
  }) => {
    let saved = false;
    await page.route(`**/api/sellers/${sellerId}/payment-channel`, (route) =>
      route.fulfill({ status: 404, json: {} }),
    );
    await page.route(`**/api/sellers/${sellerId}/bank`, (route) =>
      route.fulfill({
        json: {
          status: saved && readableAfterSave ? 'READY' : 'NEEDS_UPDATE',
          bankName: 'MB Bank',
          holder: 'TEST HOLDER',
          accountSuffix: saved && readableAfterSave ? '5678' : null,
        },
      }),
    );
    await page.route(`**/api/sellers/${sellerId}/flows/set_seller_bank`, (route) => {
      expect(route.request().postDataJSON()).toEqual({
        p_bank: 'MB Bank',
        p_holder: 'TEST HOLDER',
        p_account_enc: '0012345678',
      });
      saved = true;
      return route.fulfill({ json: { result: null } });
    });
    await page.goto('/seller/commerce');
    const bank = page.locator('.shop-bank-section');
    await expect(bank.getByRole('status')).toHaveText(unreadableBankMessage);
    await expect(bank.getByLabel('Tên ngân hàng nhận hoàn phí')).toHaveValue('MB Bank');
    await expect(bank.getByLabel('Tên chủ tài khoản')).toHaveValue('TEST HOLDER');
    await expect(bank.getByLabel('Số tài khoản ngân hàng')).toHaveValue('');
    await page.reload();
    await expect(bank.getByLabel('Tên ngân hàng nhận hoàn phí')).toHaveValue('MB Bank');
    await expect(bank.getByLabel('Tên chủ tài khoản')).toHaveValue('TEST HOLDER');
    await bank.getByLabel('Số tài khoản ngân hàng').fill('0012345678');
    const saveButton = bank.getByRole('button', { name: 'Lưu tài khoản ngân hàng shop' });
    const bankReadBack = page.waitForResponse(
      (response) => saved && response.url().endsWith(`/sellers/${sellerId}/bank`),
    );
    await saveButton.click();
    await bankReadBack;
    if (readableAfterSave) {
      await expect(bank).toContainText('Đã lưu thông tin tài khoản ngân hàng của shop thành công.');
      await page.reload();
      await expect(bank).toContainText('5678');
      await expect(bank.getByLabel('Số tài khoản ngân hàng')).toHaveCount(0);
    } else {
      await expect(saveButton).toBeEnabled();
      await expect(bank.getByRole('status')).toHaveText(unreadableBankMessage);
      await expect(bank.getByRole('alert')).toHaveCount(0);
      await expect(bank).not.toContainText(
        'Đã lưu thông tin tài khoản ngân hàng của shop thành công.',
      );
      await expect(bank.getByLabel('Số tài khoản ngân hàng')).toHaveValue('');
    }
  });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'seller-user',
        name: 'Shop hoa',
        role: 'SELLER',
        sellerId,
        sellerStatus: 'ACTIVE',
        packageExpiresAt: '2099-12-31',
      },
    }),
  );
  await page.route(`**/api/sellers/${sellerId}/reports/sales`, (route) =>
    route.fulfill({
      json: {
        sellerId,
        from: null,
        to: null,
        grossPaid: 200000,
        totalRefunded: 0,
        netReceipts: 200000,
        paidOrders: 1,
        unclaimedOrders: 0,
        pendingAmount: 0,
        byKiosk: [],
      },
    }),
  );
  await page.route(`**/api/sellers/${sellerId}/payments?*`, (route) =>
    route.fulfill({
      json: {
        payments: [],
        totalCount: 0,
        page: 1,
        pageSize: 10,
      },
    }),
  );
  await page.route(`**/api/sellers/${sellerId}/loyalty-settings`, (route) =>
    route.fulfill({
      json: {
        sellerId,
        enabled: false,
        earnRatePercent: 1,
      },
    }),
  );
});

test('Old wallet URL opens direct seller receipts without withdrawal actions', async ({ page }) => {
  let walletCalls = 0;
  await page.route(`**/api/sellers/${sellerId}/wallet`, (route) => {
    walletCalls++;
    return route.abort();
  });
  await page.route(`**/api/sellers/${sellerId}/payment-channel`, (route) =>
    route.fulfill({ status: 404, json: { message: 'No channel' } }),
  );
  await page.goto('/seller/wallet');
  await expect(page).toHaveURL(/\/seller\/commerce$/);
  await expect(page.getByRole('heading', { name: 'Thanh toán & doanh số' })).toBeVisible();
  await expect(page.getByText('Chưa có kênh PayOS của shop.')).toBeVisible();
  await expect(page.getByText('200.000 đ').first()).toBeVisible();
  await expect(page.getByRole('button', { name: /rút tiền/i })).toHaveCount(0);
  expect(walletCalls).toBe(0);
});

test('Seller sees own active channel and shop receipts', async ({ page }) => {
  await page.route(`**/api/sellers/${sellerId}/payment-channel`, (route) =>
    route.fulfill({
      json: {
        sellerId,
        version: 1,
        state: 'ACTIVE',
        expectedBankBin: '9704',
        expectedBankAccountMasked: '***1234',
        expectedBankName: 'Ngân hàng thử nghiệm',
        verifiedAt: '2026-11-05T00:00:00Z',
        createdAt: '2026-11-05T00:00:00Z',
        updatedAt: '2026-11-05T00:00:00Z',
      },
    }),
  );
  await page.goto('/seller/commerce');
  await expect(page.getByText('Đã kích hoạt')).toBeVisible();
  await expect(page.getByText('***1234')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Tiền bán hoa nhận trực tiếp' })).toBeVisible();
  await expect(page.getByText('200.000 đ').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Ví giao dịch cũ' })).toHaveCount(0);
});

for (const waitingForCustomer of [true, false]) {
  test(`Seller refund explains the next action when waiting for customer=${waitingForCustomer}`, async ({
    page,
  }) => {
    await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
    await page.route(`**/api/sellers/${sellerId}/refunds?*`, (route) =>
      route.fulfill({
        json: {
          items: [{ id: 'refund-1', orderCode: 'FB-REFUND-1', amount: 100000, status: 'PENDING' }],
          page: 1,
          hasMore: false,
        },
      }),
    );
    await page.route(`**/api/sellers/${sellerId}/refunds/refund-1`, (route) =>
      route.fulfill({
        json: {
          id: 'refund-1',
          orderCode: 'FB-REFUND-1',
          amount: 100000,
          status: 'PENDING',
          isApproved: true,
          canAccessBank: false,
          canSubmitTransfer: false,
          submission: waitingForCustomer
            ? null
            : { providerReference: 'TRANSFER-1', status: 'PENDING_REVIEW' },
        },
      }),
    );
    await page.goto('/seller/refunds');
    const refunds = page.locator('.business-panel');
    await refunds.locator('.business-card summary').click();
    await expect(
      refunds.getByText(
        waitingForCustomer
          ? 'Khách cần bổ sung tài khoản nhận hoàn trên biên nhận. Sau đó tải lại hồ sơ để tiếp tục.'
          : 'Đã gửi chứng từ. Chờ Admin đối chiếu để hoàn tất khoản hoàn.',
        { exact: true },
      ),
    ).toBeVisible();
    await expect(refunds.getByRole('button', { name: 'Gửi xác nhận chuyển khoản' })).toHaveCount(0);
  });
}

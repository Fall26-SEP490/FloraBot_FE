import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { components } from '../../packages/contracts/src/generated/api';

const sellerId = '20000000-0000-0000-0000-000000000099';
const initial = (): components['schemas']['WalletResponse'] => ({
  balance: { sellerId, availableBalance: 200000, pendingBalance: 100000, debt: 0 },
  bankConfigured: true,
  minimumWithdrawal: 50000,
  hasMoreEntries: false,
  hasMoreWithdrawals: false,
  entries: [
    {
      id: 'entry',
      createdAt: '2026-10-07T10:00:00Z',
      account: 'SELLER_AVAILABLE',
      amount: -200000,
      refType: 'SETTLEMENT',
      memo: 'Tiền bán hoa đã đủ điều kiện',
    },
  ],
  withdrawals: [],
});
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'user',
        name: 'Shop hoa',
        role: 'SELLER',
        sellerId,
        sellerStatus: 'ACTIVE',
        packageExpiresAt: '2099-12-31',
      },
    }),
  );
  await page.route('**/products', (route) => route.fulfill({ json: [] }));
  await page.route('**/slots', (route) => route.fulfill({ json: [] }));
  await page.route('**/subscriptions', (route) =>
    route.fulfill({ json: { package: null, subscriptions: [] } }),
  );
});

for (const width of [390, 1440]) {
  test(`Wallet validates amount, confirms once and presents status at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    const wallet = initial();
    let sends = 0;
    await page.route('**/wallet', (route) => route.fulfill({ json: wallet }));
    await page.route('**/flows/request_withdrawal', async (route) => {
      sends++;
      expect(route.request().postDataJSON()).toEqual({ p_amount: 100000 });
      wallet.withdrawals = [
        {
          id: '50000000-0000-0000-0000-000000000099',
          amount: 100000,
          status: 'PENDING',
          createdAt: '2026-10-07T11:00:00Z',
          paidAt: null,
          rejectReason: null,
        },
      ];
      await route.fulfill({ json: { result: wallet.withdrawals[0]!.id } });
    });
    await page.goto('/seller');
    const section = page.locator('#wallet');
    const input = page.getByLabel('Số tiền muốn rút (đồng)');
    await input.fill('10.000');
    await section.getByRole('button', { name: 'Kiểm tra yêu cầu rút' }).click();
    await expect(
      section.getByText('Nhập số tiền nguyên, không kèm dấu chấm hoặc dấu phẩy.'),
    ).toBeVisible();
    await input.fill('10000');
    await section.getByRole('button', { name: 'Kiểm tra yêu cầu rút' }).click();
    await expect(section.locator('#withdrawal-error')).toContainText('50.000');
    await input.fill('300000');
    await section.getByRole('button', { name: 'Kiểm tra yêu cầu rút' }).click();
    await expect(section.locator('#withdrawal-error')).toContainText('vượt quá');
    await input.fill('100000');
    await section.getByRole('button', { name: 'Kiểm tra yêu cầu rút' }).click();
    const confirm = section.getByRole('button', { name: 'Xác nhận yêu cầu rút' });
    await expect(confirm).toBeFocused();
    expect(sends).toBe(0);
    await confirm.click();
    await expect(section.getByRole('status')).toContainText('Đã gửi yêu cầu');
    await expect(section.getByText('Chờ duyệt', { exact: true })).toBeVisible();
    expect(sends).toBe(1);
    await expect(section.locator('.wallet-balances')).toContainText('200.000');
    await section.getByText('Xem giao dịch trong ví', { exact: true }).click();
    await expect(section.locator('.wallet-change')).toContainText('+200.000');
    expect(
      (
        await new AxeBuilder({ page })
          .include('#wallet')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await section.screenshot({ path: `.impeccable/review/portal-wallet-${width}.png` });
  });
}

test('Lost withdrawal response blocks repeat after refresh and reload', async ({ page }) => {
  const wallet = initial();
  let sends = 0;
  await page.route('**/wallet', (route) => route.fulfill({ json: wallet }));
  await page.route('**/flows/request_withdrawal', (route) => {
    sends++;
    return route.abort('connectionreset');
  });
  await page.goto('/seller');
  await page.getByLabel('Số tiền muốn rút (đồng)').fill('100000');
  await page.getByRole('button', { name: 'Kiểm tra yêu cầu rút' }).click();
  await page.getByRole('button', { name: 'Xác nhận yêu cầu rút' }).click();
  await expect(page.locator('#wallet')).toContainText('Chưa xác định được kết quả');
  await page.getByRole('button', { name: 'Cập nhật ví' }).click();
  await expect(page.getByRole('button', { name: 'Kiểm tra yêu cầu rút' })).toHaveCount(0);
  await page.reload();
  await expect(page.locator('#wallet')).toContainText('Chưa xác định được kết quả');
  expect(sends).toBe(1);
  await page.getByRole('button', { name: 'Tôi đã kiểm tra lịch sử yêu cầu' }).click();
  await expect(page.getByLabel('Số tiền muốn rút (đồng)')).toBeVisible();
  expect(sends).toBe(1);
});

test('Empty wallet, missing bank and read failure offer honest recovery', async ({ page }) => {
  const wallet = initial();
  wallet.balance = null;
  wallet.entries = [];
  wallet.bankConfigured = false;
  let broken = true;
  await page.route('**/wallet', (route) =>
    broken
      ? route.fulfill({ status: 503, json: { detail: 'Chưa tải được ví.' } })
      : route.fulfill({ json: wallet }),
  );
  await page.goto('/seller');
  await expect(page.locator('#wallet')).toContainText('Chưa tải được ví');
  broken = false;
  await page.getByRole('button', { name: 'Cập nhật ví' }).click();
  await expect(page.locator('#wallet')).toContainText(
    'Shop chưa có đầy đủ thông tin tài khoản nhận tiền',
  );
  await expect(page.getByLabel('Số tiền muốn rút (đồng)')).toHaveCount(0);
  await expect(page.locator('#wallet')).toContainText('Shop chưa gửi yêu cầu rút tiền nào');
});

import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import type { components } from '../../packages/contracts/src/generated/api';

const sellerId = '20000000-0000-0000-0000-000000000099';
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
  await page.route('**/wallet', (route) =>
    route.fulfill({
      json: {
        balance: null,
        entries: [],
        bankConfigured: false,
        minimumWithdrawal: 50000,
        withdrawals: [],
        hasMoreEntries: false,
        hasMoreWithdrawals: false,
      },
    }),
  );
});

for (const width of [390, 1440]) {
  test(`Bank entry validates, reviews, masks and clears raw values at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    let bank: components['schemas']['SellerBankResponse'] = {
      status: 'MISSING',
      bankName: null,
      holder: null,
      accountSuffix: null,
    };
    let writes = 0;
    await page.route('**/bank', (route) => route.fulfill({ json: bank }));
    await page.route('**/flows/set_seller_bank', (route) => {
      writes++;
      expect(route.request().postDataJSON()).toEqual({
        p_bank: 'Test Bank',
        p_holder: 'Test Shop',
        p_account_enc: '00123456789',
      });
      bank = { status: 'READY', bankName: 'Test Bank', holder: 'TEST SHOP', accountSuffix: '6789' };
      return route.fulfill({ json: { result: null } });
    });
    await page.goto('/seller');
    await page.locator('.bank-details summary').click();
    const section = page.locator('.bank-details');
    await section
      .getByRole('button', { name: 'Khai báo tài khoản nhận tiền', exact: true })
      .click();
    await expect(page.getByLabel('Tên ngân hàng', { exact: true })).toBeFocused();
    await section.getByRole('button', { name: 'Kiểm tra thông tin tài khoản' }).click();
    await expect(section.getByText('Nhập tên ngân hàng.', { exact: true })).toBeVisible();
    await page.getByLabel('Tên ngân hàng', { exact: true }).fill('Test Bank');
    await page.getByLabel('Tên chủ tài khoản', { exact: true }).fill('Test Shop');
    await page.getByLabel('Số tài khoản ngân hàng', { exact: true }).fill('123 456');
    await section.getByRole('button', { name: 'Kiểm tra thông tin tài khoản' }).click();
    await expect(
      section.getByText('Nhập 4–34 chữ cái hoặc chữ số, không có khoảng trắng.'),
    ).toBeVisible();
    await page.getByLabel('Số tài khoản ngân hàng', { exact: true }).fill('00123456789');
    await section.getByRole('button', { name: 'Kiểm tra thông tin tài khoản' }).click();
    const confirm = section.getByRole('button', { name: 'Xác nhận lưu tài khoản' });
    await expect(confirm).toBeFocused();
    expect(writes).toBe(0);
    await expect(section.getByText('Số tài khoản đã che, kết thúc bằng 6789.')).toBeVisible();
    await confirm.click();
    await expect(section.getByRole('status')).toContainText('Đã lưu tài khoản');
    await expect(section.locator('.bank-summary')).toContainText('Đã che, kết thúc bằng 6789');
    expect(writes).toBe(1);
    await expect(section.locator('input')).toHaveCount(0);
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
    ).not.toContain('00123456789');
    expect(
      (
        await new AxeBuilder({ page })
          .include('.bank-details')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await section.screenshot({ path: `.impeccable/review/portal-bank-${width}.png` });
    await section.getByRole('button', { name: 'Đổi tài khoản nhận tiền' }).click();
    await expect(page.getByLabel('Số tài khoản ngân hàng', { exact: true })).toHaveValue('');
    await section.getByRole('button', { name: 'Hủy thay đổi' }).click();
    await expect(section.getByRole('button', { name: 'Đổi tài khoản nhận tiền' })).toBeFocused();
  });
}

test('Bank read and write failures preserve recovery without claiming success', async ({
  page,
}) => {
  let failedRead = true;
  await page.route('**/bank', (route) =>
    failedRead
      ? route.fulfill({ status: 503 })
      : route.fulfill({
          json: {
            status: 'NEEDS_UPDATE',
            bankName: 'Legacy Bank',
            holder: 'Shop',
            accountSuffix: null,
          },
        }),
  );
  await page.route('**/flows/set_seller_bank', (route) => route.abort('connectionreset'));
  await page.goto('/seller');
  await page.locator('.bank-details summary').click();
  await expect(page.locator('.bank-details')).toContainText('Chưa tải được thông tin tài khoản');
  failedRead = false;
  await page.getByRole('button', { name: 'Tải lại thông tin tài khoản' }).click();
  await expect(page.locator('.bank-details')).toContainText('Hãy nhập lại đầy đủ thông tin');
  await page.getByRole('button', { name: 'Khai báo tài khoản nhận tiền', exact: true }).click();
  await page.getByLabel('Số tài khoản ngân hàng', { exact: true }).fill('000123456');
  await page.getByRole('button', { name: 'Kiểm tra thông tin tài khoản' }).click();
  await page.getByRole('button', { name: 'Xác nhận lưu tài khoản' }).click();
  await expect(page.locator('.bank-details')).toContainText('Chưa xác nhận được kết quả lưu');
  await expect(page.getByLabel('Số tài khoản ngân hàng', { exact: true })).toHaveValue('000123456');
  await expect(page.locator('.bank-details').getByRole('status')).toBeEmpty();
});

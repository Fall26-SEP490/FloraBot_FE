import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function setup(page: Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { id: 'admin', name: 'Quản trị', role: 'ADMIN' } }),
  );
  await page.route('**/api/admin/sellers?*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/admin/slots', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/packages', (route) => route.fulfill({ json: [] }));
  for (const name of ['incidents', 'withdrawals', 'complaints', 'refunds'])
    await page.route(`**/api/admin/${name}?*`, (route) =>
      route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
    );
}
const daily = {
  result: [
    {
      muc: 'Tiền vào VietQR (đơn + phí gói)',
      chung_tu: 100000,
      so_cai: 100000,
      lech: 0,
      ghi_chu: '',
    },
    { muc: 'Sổ cái cân (tổng mọi bút toán)', chung_tu: 0, so_cai: 0, lech: 0, ghi_chu: '' },
    { muc: 'Lệnh hoàn chờ chi quá 48 giờ (số lệnh)', chung_tu: 3, so_cai: 0, lech: 0, ghi_chu: '' },
    {
      muc: 'Tiền đang chờ hoàn (REFUND_CLEARING)',
      chung_tu: 0,
      so_cai: 40000,
      lech: 0,
      ghi_chu: '',
    },
  ],
};
for (const width of [390, 1440])
  test(`Reconciliation review, report units and accessibility ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(page);
    let sent = 0;
    await page.route('**/flows/reconcile_daily', (route) => {
      expect(route.request().postDataJSON()).toEqual({ p_date: '2026-10-07' });
      return route.fulfill({ json: daily });
    });
    await page.route('**/flows/reconcile_gateway', (route) => {
      sent++;
      expect(route.request().postDataJSON()).toEqual({
        p_date: '2026-10-07',
        p_statement: [{ txn: 'fixture-1', amount: 150000 }],
      });
      return route.fulfill({
        json: {
          result: [
            {
              loai: 'MISSING_IN_DB',
              gateway_txn_id: 'fixture-1',
              he_thong: null,
              sao_ke: 150000,
              ghi_chu: '',
            },
          ],
        },
      });
    });
    await page.goto('/admin/reconciliation');
    const section = page.locator('.admin-reconciliation');
    await section.getByRole('button', { name: 'Xem báo cáo ngày' }).click();
    await expect(section.getByLabel('Ngày đối soát (giờ Việt Nam)')).toBeFocused();
    await section.getByLabel('Ngày đối soát (giờ Việt Nam)').fill('2026-10-07');
    await section.getByRole('button', { name: 'Xem báo cáo ngày' }).click();
    await expect(section.getByText('3 lệnh', { exact: true })).toBeVisible();
    await expect(section.getByText('Sổ cái hiện tại', { exact: true })).toHaveCount(2);
    const input = section.getByLabel('Nội dung sao kê JSON');
    await input.fill('invalid');
    await section.getByRole('button', { name: 'Kiểm tra sao kê', exact: true }).click();
    await expect(input).toBeFocused();
    await expect(section.getByRole('alert')).toContainText('chưa đúng JSON');
    await input.fill(
      JSON.stringify([
        { txn: 'fixture-1', amount: 100000, account: 'private-ignored' },
        { txn: 'fixture-1', amount: 50000 },
      ]),
    );
    await section.getByRole('button', { name: 'Kiểm tra sao kê', exact: true }).click();
    await expect(
      section.getByRole('heading', { name: 'Kiểm tra trước khi đối soát' }),
    ).toBeFocused();
    await expect(section.getByText(/1 mã giao dịch · Tổng 150.000/)).toBeVisible();
    expect(sent).toBe(0);
    await section.getByRole('button', { name: 'Sửa sao kê' }).click();
    await expect(input).toBeFocused();
    await section.getByRole('button', { name: 'Kiểm tra sao kê', exact: true }).click();
    await section.getByRole('button', { name: 'Đối soát sao kê đã kiểm tra' }).click();
    await expect(section.getByRole('status')).toHaveText('Có 1 chênh lệch cần kiểm tra.');
    await expect(section.getByText('Sao kê có, hệ thống chưa có', { exact: true })).toBeVisible();
    expect(sent).toBe(1);
    await expect(input).toHaveValue('');
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
    ).not.toContain('fixture-1');
    expect(
      (
        await new AxeBuilder({ page })
          .include('.admin-reconciliation')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await section.screenshot({ path: `.impeccable/review/admin-reconciliation-${width}.png` });
    await section.getByLabel('Ngày đối soát (giờ Việt Nam)').fill('2026-10-08');
    await expect(section.getByText('Mã giao dịch: fixture-1')).toHaveCount(0);
    await expect(section.getByRole('heading', { name: 'Báo cáo ngày 2026-10-07' })).toHaveCount(0);
  });

test('Empty statements, amount bounds and failed requests never retry automatically', async ({
  page,
}) => {
  await setup(page);
  let attempts = 0;
  await page.route('**/flows/reconcile_gateway', (route) => {
    attempts++;
    expect(route.request().postDataJSON()).toEqual({ p_date: '2026-10-07', p_statement: [] });
    return route.abort();
  });
  await page.goto('/admin/reconciliation');
  const section = page.locator('.admin-reconciliation');
  await section.getByLabel('Ngày đối soát (giờ Việt Nam)').fill('2026-10-07');
  for (const amount of [0, -1, 1.5, 9007199254740992]) {
    await section.getByLabel('Nội dung sao kê JSON').fill(JSON.stringify([{ txn: 'x', amount }]));
    await section.getByRole('button', { name: 'Kiểm tra sao kê', exact: true }).click();
    await expect(section.getByRole('alert')).toContainText('số nguyên dương');
  }
  await section.getByLabel('Nội dung sao kê JSON').fill('[]');
  await section.getByRole('button', { name: 'Kiểm tra sao kê', exact: true }).click();
  await expect(section.getByText(/Sao kê trống:/)).toBeVisible();
  await section.getByRole('button', { name: 'Đối soát sao kê đã kiểm tra' }).click();
  await expect(section.getByRole('alert')).toContainText('Đối soát không chuyển tiền');
  expect(attempts).toBe(1);
});

test('Cleared or hidden reports cannot reappear from a late response', async ({ page }) => {
  await setup(page);
  let release!: () => void;
  let started = false;
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/flows/reconcile_daily', async (route) => {
    started = true;
    await held;
    await route.fulfill({ json: daily });
  });
  await page.goto('/admin/reconciliation');
  const section = page.locator('.admin-reconciliation');
  await section.getByLabel('Ngày đối soát (giờ Việt Nam)').fill('2026-10-07');
  await section.getByLabel('Nội dung sao kê JSON').fill('[{"txn":"private","amount":100}]');
  await section.getByRole('button', { name: 'Xem báo cáo ngày' }).click();
  await expect.poll(() => started).toBe(true);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  const response = page.waitForResponse('**/flows/reconcile_daily');
  release();
  await (await response).finished();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(section.getByRole('status')).toContainText('rời tab');
  await expect(section.getByLabel('Nội dung sao kê JSON')).toHaveValue('');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(section.getByRole('heading', { name: 'Báo cáo ngày 2026-10-07' })).toHaveCount(0);
});

test('Differences paginate and a fresh empty result is not confused with an error', async ({
  page,
}) => {
  await setup(page);
  let empty = false;
  await page.route('**/flows/reconcile_gateway', (route) =>
    route.fulfill({
      json: {
        result: empty
          ? []
          : Array.from({ length: 21 }, (_, index) => ({
              loai: 'MISSING_IN_STATEMENT',
              gateway_txn_id: `row-${index}`,
              he_thong: '9223372036854775807',
              sao_ke: null,
              ghi_chu: '',
            })),
      },
    }),
  );
  await page.goto('/admin/reconciliation');
  const section = page.locator('.admin-reconciliation');
  await section.getByLabel('Ngày đối soát (giờ Việt Nam)').fill('2026-10-07');
  await section.getByLabel('Nội dung sao kê JSON').fill('[]');
  await section.getByRole('button', { name: 'Kiểm tra sao kê', exact: true }).click();
  await section.getByRole('button', { name: 'Đối soát sao kê đã kiểm tra' }).click();
  await expect(section.locator('.reconciliation-rows li')).toHaveCount(20);
  await section.getByRole('button', { name: 'Trang chênh lệch sau' }).click();
  await expect(section.locator('.reconciliation-rows li')).toHaveCount(1);
  await expect(section.getByText('Mã giao dịch: row-20', { exact: true })).toBeVisible();
  await expect(section.getByText('9.223.372.036.854.775.807 đ', { exact: true })).toBeVisible();
  await section.getByRole('button', { name: 'Xóa dữ liệu trên màn hình' }).click();
  await expect(section.locator('.reconciliation-report')).toHaveCount(0);
  empty = true;
  await section.getByLabel('Nội dung sao kê JSON').fill('[]');
  await section.getByRole('button', { name: 'Kiểm tra sao kê', exact: true }).click();
  await section.getByRole('button', { name: 'Đối soát sao kê đã kiểm tra' }).click();
  await expect(section.getByRole('status')).toHaveText(
    'Không tìm thấy chênh lệch với sao kê đã cung cấp.',
  );
  await expect(section.getByRole('alert')).toBeEmpty();
});

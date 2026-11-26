import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { chooseSelect } from '../fixtures/select';

const daily = {
  result: [
    {
      muc: 'Tiền vào VietQR (đơn + phí gói)',
      chung_tu: 100000,
      so_cai: 90000,
      lech: 10000,
      ghi_chu: '',
    },
    {
      muc: 'Chi hoàn khách/seller (chuyển khoản tay)',
      chung_tu: 10000,
      so_cai: 10000,
      lech: 0,
      ghi_chu: '',
    },
    { muc: 'Sổ cái cân (tổng mọi bút toán)', chung_tu: 0, so_cai: 0, lech: 0, ghi_chu: '' },
    { muc: 'Lệnh hoàn chờ chi quá 48 giờ (số lệnh)', chung_tu: 2, so_cai: 0, lech: 0, ghi_chu: '' },
    {
      muc: 'Tiền đang chờ hoàn (REFUND_CLEARING)',
      chung_tu: 0,
      so_cai: 20000,
      lech: 0,
      ghi_chu: '',
    },
  ],
};
async function setup(page: Page) {
  const model = { writes: [] as { path: string; body: unknown }[], fail: false, many: false };
  await page.clock.setFixedTime(new Date('2026-11-26T05:00:00Z'));
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (path === '/api/auth/me')
      return route.fulfill({ json: { id: 'admin', name: 'Quản trị', role: 'ADMIN' } });
    if (req.method() === 'POST') {
      model.writes.push({ path, body: req.postDataJSON() });
      if (model.fail) {
        model.fail = false;
        return route.fulfill({
          status: 503,
          json: { detail: 'Chưa nhận được kết quả thử nghiệm.' },
        });
      }
      if (path.endsWith('/reconcile_daily')) return route.fulfill({ json: daily });
      if (path.endsWith('/reconcile_gateway'))
        return route.fulfill({
          json: {
            result: Array.from({ length: model.many ? 41 : 1 }, (_, i) => ({
              loai: 'AMOUNT_MISMATCH',
              gateway_txn_id: `TXN-${i}`,
              he_thong: 10000,
              sao_ke: 15000,
              ghi_chu: 'Check amount',
            })),
          },
        });
      throw new Error('FE called an unsupported write API: ' + path);
    }
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  return model;
}
async function fillStatement(page: Page) {
  await page.getByRole('button', { name: 'Đối chiếu PayOS', exact: true }).click();
  await page.getByRole('button', { name: 'Nhập sao kê', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Sao kê PayOS', exact: true });
  await dialog.getByRole('button', { name: 'Dán từ Excel', exact: true }).click();
  await dialog
    .getByLabel('Hai cột: mã giao dịch và số tiền (đồng)')
    .fill('Mã giao dịch\tSố tiền\nTXN-A\t10000\nTXN-A\t5000');
  await dialog.getByRole('button', { name: 'Dùng dữ liệu', exact: true }).click();
  await expect(dialog.getByLabel('Số tiền dòng 1', { exact: true })).toHaveValue('15000');
  return dialog;
}

for (const width of [390, 1440]) {
  test(`Excel layout uses only the existing BE flows at ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 960 });
    const model = await setup(page);
    await page.goto('/admin/reconciliation');
    const section = page.getByRole('region', { name: 'Đối soát', exact: true });
    await section.getByRole('button', { name: 'Kiểm tra ngày', exact: true }).click();
    const count = section.getByRole('row').filter({ hasText: 'Lệnh hoàn quá 48 giờ' });
    await expect(count).toContainText('2 lệnh');
    await expect(count).not.toContainText('₫');
    await expect(
      section.getByRole('row').filter({ hasText: 'Tiền thu từ đơn & phí thuê' }),
    ).toContainText('Có chênh lệch');
    await page.screenshot({ path: info.outputPath(`daily-${width}.png`) });
    const dialog = await fillStatement(page);
    await dialog.screenshot({ path: info.outputPath(`statement-modal-${width}.png`) });
    await dialog.getByRole('button', { name: 'Đối chiếu', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(section.getByRole('cell', { name: 'Lệch số tiền', exact: true })).toBeVisible();
    await expect(section.getByRole('cell', { name: '15.000 ₫', exact: true })).toBeVisible();
    expect(model.writes).toEqual([
      { path: '/api/admin/flows/reconcile_daily', body: { p_date: '2026-11-26' } },
      {
        path: '/api/admin/flows/reconcile_gateway',
        body: { p_date: '2026-11-26', p_statement: [{ txn: 'TXN-A', amount: 15000 }] },
      },
    ]);
    const audit = await new AxeBuilder({ page })
      .include('.admin-reconciliation')
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(audit.violations).toEqual([]);
    await page.screenshot({ path: info.outputPath(`gateway-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await section.getByRole('button', { name: 'Sửa sao kê', exact: true }).click();
    await expect(dialog.getByLabel('Số tiền dòng 1', { exact: true })).toHaveValue('15000');
  });
}
test('errors retain the statement without automatic retry, and results paginate and filter', async ({
  page,
}) => {
  const model = await setup(page);
  model.fail = true;
  model.many = true;
  await page.goto('/admin/reconciliation');
  const dialog = await fillStatement(page);
  await dialog.getByRole('button', { name: 'Đối chiếu', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Chưa nhận được kết quả thử nghiệm.');
  expect(model.writes).toHaveLength(1);
  await expect(dialog.getByLabel('Số tiền dòng 1', { exact: true })).toHaveValue('15000');
  await dialog.getByRole('button', { name: 'Đối chiếu', exact: true }).click();
  await expect(dialog).not.toBeVisible();
  const section = page.getByRole('region', { name: 'Đối soát', exact: true });
  await expect(section.locator('tbody tr')).toHaveCount(20);
  await section.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await section.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expect(section.locator('tbody tr')).toHaveCount(1);
  await section.getByRole('searchbox', { name: 'Tìm mã giao dịch', exact: true }).fill('TXN-3');
  await expect(section.locator('tbody tr')).toHaveCount(11);
  await chooseSelect(section, 'Loại chênh lệch', 'MISSING_IN_DB');
  await expect(
    section.getByText('Không có giao dịch phù hợp với bộ lọc.', { exact: true }),
  ).toBeVisible();
});

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupAdminSurfaces } from '../fixtures/admin-surfaces';

const sections = [
  ['accounts', 'Tài khoản hệ thống'],
  ['managers', 'Quản lý vận hành'],
  ['shops', 'Shop hoa'],
  ['slots', 'Phân bổ kiosk'],
  ['installations', 'Hồ sơ thuê kiosk'],
  ['tasks', 'Giám sát công việc'],
  ['orders', 'Đơn đặt trước'],
  ['incidents', 'Sự cố tủ'],
  ['complaints', 'Phản ánh'],
  ['refunds', 'Hoàn tiền'],
  ['kiosk-refunds', 'Hoàn tiền thuê kiosk'],
  ['withdrawals', 'Rút tiền'],
  ['reconciliation', 'Đối soát'],
  ['reports', 'Báo cáo vận hành'],
] as const;

for (const width of [390, 1440])
  for (const [section, title] of sections) {
    test(`Admin ${section} is readable, accessible and has no overflow at ${width}`, async ({
      page,
    }) => {
      const model = await setupAdminSurfaces(page);
      await page.setViewportSize({ width, height: 960 });
      await page.goto('/admin/' + section);
      await expect(page.getByRole('heading', { level: 1, exact: true, name: title })).toBeVisible();
      await expect(page.locator('#main > :last-child')).toBeAttached();
      // Wait for the actual section rather than only the route shell.
      const selectors: Record<string, string> = {
        accounts: '.platform-management',
        managers: '.account-management-workspace',
        shops: '.admin-sellers',
        slots: '.admin-slots',
        installations: '.operations-queue-section',
        tasks: '#staff-tasks',
        orders: '.web-orders',
        incidents: '.admin-incidents',
        complaints: '.admin-complaints',
        refunds: '.admin-refunds',
        'kiosk-refunds': '.admin-kiosk-refunds-view',
        withdrawals: '.admin-withdrawals',
        reconciliation: '.admin-reconciliation',
        reports: '.api-reports',
      };
      await expect(page.locator(selectors[section])).toBeVisible();
      await expect(page.locator('#main h1')).toHaveCount(1);
      const menu = page.getByRole('button', { name: 'Mở danh mục quản lý', exact: true });
      if (width === 390) await menu.click();
      await expect(
        page
          .getByRole('navigation', { name: 'Điều hướng quản lý' })
          .locator('[aria-current="page"]'),
      ).toHaveAttribute('href', '/admin/' + section);
      if (width === 390) {
        await page
          .getByRole('button', { name: 'Đóng danh mục quản lý', exact: true })
          .press('Escape');
        await expect(menu).toBeFocused();
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const results = await new AxeBuilder({ page })
        .include('#main')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
      expect(model.writes).toEqual([]);
    });
  }

test('Admin narrow installation cards keep details reachable without horizontal scrolling', async ({
  page,
}) => {
  const model = await setupAdminSurfaces(page);
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.goto('/admin/installations');
  const details = page.getByRole('button', { name: 'Chi tiết', exact: true });
  await expect(details).toBeVisible();
  const bounds = await details.boundingBox();
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(1000);
  await details.click();
  await expect(
    page.getByRole('heading', { name: 'Chi tiết: Shop kiểm thử giao diện', exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: /Xác nhận liên hệ|Lưu lịch & Phân công|Nghiệm thu Đạt|Thêm tủ mới/,
    }),
  ).toHaveCount(0);
  expect(model.writes).toEqual([]);
});

test('Admin shop and kiosk filters reset and disclosures work with keyboard', async ({ page }) => {
  const model = await setupAdminSurfaces(page);
  await page.goto('/admin/shops');
  await page.getByLabel('Tìm tên shop hoặc số điện thoại').fill('Khongco');
  await expect(page.getByText('Không có hồ sơ phù hợp với bộ lọc hiện tại.')).toBeVisible();
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
  const summary = page.locator('.admin-sellers summary');
  await expect(summary.locator('.when-closed')).toBeVisible();
  await summary.press('Enter');
  await expect(summary.locator('.when-open')).toBeVisible();
  await expect(summary.locator('.when-closed')).toBeHidden();
  await expect(page.getByText('Địa chỉ / khu vực', { exact: true })).toBeVisible();
  await page.goto('/admin/slots');
  await page.getByLabel('Lọc phân bổ', { exact: true }).selectOption('ALL');
  await page.getByRole('button', { name: 'Đặt lại bộ lọc', exact: true }).click();
  await expect(page.getByLabel('Lọc phân bổ', { exact: true })).toHaveValue('UNASSIGNED');
  expect(model.writes).toEqual([]);
});

for (const [path, label, loaded] of [
  ['/admin/accounts', 'Tài khoản hệ thống', '.management-table'],
  ['/admin/reports/v_admin_queue', 'Báo cáo vận hành', '.reports-table-wrap'],
  ['/admin/withdrawals', 'Rút tiền', '.admin-shop-list'],
] as const)
  test(`Admin recovers ${label} from an API error without fake empty data`, async ({ page }) => {
    const model = await setupAdminSurfaces(page);
    model.fail.add(path);
    const route = path.includes('/reports/') ? '/admin/reports' : path;
    await page.goto(route);
    await expect(page.locator('#main').getByRole('alert')).toContainText(/Chưa|gián đoạn/);
    await expect(page.locator(loaded)).toHaveCount(0);
    model.fail.delete(path);
    const button =
      path === '/admin/accounts'
        ? 'Thử lại'
        : path.includes('/reports/')
          ? 'Cập nhật báo cáo'
          : 'Cập nhật yêu cầu rút tiền';
    await page.getByRole('button', { name: button, exact: true }).click();
    await expect(page.locator(loaded)).toBeVisible();
    expect(model.writes).toEqual([]);
  });

for (const width of [390, 1440])
  test(`Admin statement rows preserve validation, preview and API contract at ${width}`, async ({
    page,
  }) => {
    const model = await setupAdminSurfaces(page);
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/admin/reconciliation');
    await page.getByLabel('Ngày đối soát (giờ Việt Nam)').fill('2026-10-31');
    await page.getByRole('button', { name: 'Kiểm tra sao kê', exact: true }).click();
    await expect(page.locator('#reconciliation-error')).not.toBeEmpty();
    expect(model.writes).toEqual([]);
    await page.getByLabel('Mã giao dịch 1', { exact: true }).fill('TEST-ROW');
    await page.getByLabel('Số tiền giao dịch 1 (đồng)', { exact: true }).fill('100000');
    await page.getByRole('button', { name: 'Thêm giao dịch', exact: true }).click();
    await page.getByLabel('Mã giao dịch 2', { exact: true }).fill('TEST-ROW');
    await page.getByLabel('Số tiền giao dịch 2 (đồng)', { exact: true }).fill('50000');
    await page.getByRole('button', { name: 'Kiểm tra sao kê', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Kiểm tra trước khi đối soát', exact: true }),
    ).toBeFocused();
    await expect(page.getByText(/1 mã giao dịch · Tổng 150.000/)).toBeVisible();
    expect(model.writes).toEqual([]);
    await page.getByRole('button', { name: 'Sửa sao kê', exact: true }).click();
    await expect(page.getByLabel('Mã giao dịch 1', { exact: true })).toBeFocused();
    await page.getByRole('button', { name: 'Kiểm tra sao kê', exact: true }).click();
    await page.getByRole('button', { name: 'Đối soát sao kê đã kiểm tra', exact: true }).click();
    await expect(page.getByRole('status')).toHaveText(
      'Không tìm thấy chênh lệch với sao kê đã cung cấp.',
    );
    expect(model.writes).toEqual([
      {
        path: '/admin/flows/reconcile_gateway',
        body: { p_date: '2026-10-31', p_statement: [{ txn: 'TEST-ROW', amount: 150000 }] },
      },
    ]);
    await expect(page.getByLabel('Mã giao dịch 1', { exact: true })).toHaveValue('');
    expect(
      await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
    ).not.toContain('TEST-ROW');
  });

test('Admin row drafts clear when hidden and rejecting unsafe money never calls the API', async ({
  page,
}) => {
  const model = await setupAdminSurfaces(page);
  await page.goto('/admin/reconciliation');
  await page.getByLabel('Ngày đối soát (giờ Việt Nam)').fill('2026-10-31');
  await page.getByLabel('Mã giao dịch 1', { exact: true }).fill('PRIVATE-DRAFT');
  await page.getByLabel('Số tiền giao dịch 1 (đồng)', { exact: true }).fill('9007199254740992');
  await page.getByRole('button', { name: 'Kiểm tra sao kê', exact: true }).click();
  await expect(page.locator('#reconciliation-error')).not.toBeEmpty();
  expect(model.writes).toEqual([]);
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(page.getByLabel('Mã giao dịch 1', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Số tiền giao dịch 1 (đồng)', { exact: true })).toHaveValue('');
});

test('Admin manager form stays inside mobile viewport and Escape returns focus', async ({
  page,
}) => {
  const model = await setupAdminSurfaces(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/admin/managers');
  const add = page.getByRole('button', { name: 'Thêm Quản lý vận hành', exact: true });
  await add.click();
  const dialog = page.getByRole('dialog', { name: 'Thêm Quản lý vận hành', exact: true });
  await expect(dialog).toBeVisible();
  const box = await dialog.boundingBox();
  expect(box!.width).toBeLessThanOrEqual(390);
  expect(box!.height).toBeLessThanOrEqual(844);
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(add).toBeFocused();
  expect(model.writes).toEqual([]);
});

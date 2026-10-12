import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

type DashboardRole = 'ADMIN' | 'SELLER' | 'SELLER_STAFF';

async function mockDashboard(page: Page, role: DashboardRole) {
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') {
      return route.fulfill({
        json: {
          id: `test-${role.toLowerCase()}`,
          name:
            role === 'ADMIN'
              ? 'Quản trị viên'
              : role === 'SELLER'
                ? 'Chủ tiệm hoa'
                : 'Nhân viên ca sáng',
          role,
          sellerId: role === 'ADMIN' ? null : 'shop-test',
          sellerStatus: role === 'ADMIN' ? null : 'ACTIVE',
          packageExpiresAt: '2030-01-01',
        },
      });
    }
    if (path.endsWith('/products')) return route.fulfill({ json: [] });
    if (path.endsWith('/wallet')) return route.fulfill({ json: { balance: null } });
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
}

test('Admin mock CRUD validates on blur, paginates and soft-deletes records', async ({ page }) => {
  await mockDashboard(page, 'ADMIN');
  await page.goto('/admin');

  const panel = page.getByRole('region', { name: 'Tài khoản vận hành' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Hiển thị 1–4 trong 6 mục')).toBeVisible();
  await panel.getByRole('button', { name: 'Trang sau' }).click();
  await expect(panel.getByRole('row').filter({ hasText: 'Ngô Thị Hoa' })).toBeVisible();
  await expect(panel.getByText('Hiển thị 5–6 trong 6 mục')).toBeVisible();

  await panel.getByRole('button', { name: 'Thêm tài khoản' }).click();
  const createDialog = page.getByRole('dialog', { name: 'Thêm tài khoản' });
  const name = createDialog.getByLabel('Họ và tên');
  await expect(name).toBeFocused();
  await name.fill('A');
  await createDialog.getByLabel('Email').focus();
  await expect(createDialog.getByText('Nhập ít nhất 2 ký tự.')).toBeVisible();
  await expect(name).toHaveAttribute('aria-invalid', 'true');

  await name.fill('Đặng Thanh Lan');
  await createDialog.getByLabel('Email').fill('lan@florabot.vn');
  await createDialog.getByLabel('Vai trò').fill('Staff');
  await createDialog.getByRole('button', { name: 'Lưu thay đổi' }).click();

  await expect(createDialog).toBeHidden();
  await expect(panel.getByRole('row').filter({ hasText: 'Đặng Thanh Lan' })).toBeVisible();
  await expect(panel.getByText('Hiển thị 1–4 trong 7 mục')).toBeVisible();

  await panel.getByRole('button', { name: 'Xem Đặng Thanh Lan' }).click();
  const details = page.getByRole('dialog', { name: 'Chi tiết tài khoản' });
  await expect(details.getByText('lan@florabot.vn')).toBeVisible();
  await details.getByRole('button', { name: 'Đóng', exact: true }).click();

  await panel.getByRole('button', { name: 'Vô hiệu hóa Đặng Thanh Lan' }).click();
  const confirm = page.getByRole('dialog', { name: 'Vô hiệu hóa tài khoản?' });
  await expect(confirm).toContainText('vẫn được giữ trong bảng');
  await confirm.getByRole('button', { name: 'Xác nhận vô hiệu hóa' }).click();
  await expect(confirm).toBeHidden();
  const createdRow = panel.getByRole('row').filter({ hasText: 'Đặng Thanh Lan' });
  await expect(createdRow).toContainText('Đã vô hiệu hóa');
  await expect(createdRow).toBeVisible();
});

test('Seller can edit catalog data and receives a delete confirmation', async ({ page }) => {
  await mockDashboard(page, 'SELLER');
  await page.goto('/seller');

  const panel = page.getByRole('region', { name: 'Danh mục mẫu hoa' });
  await expect(panel.getByRole('button', { name: 'Thêm mẫu hoa' })).toBeVisible();
  await panel.getByRole('button', { name: 'Sửa Bó hồng pastel' }).click();
  const editor = page.getByRole('dialog', { name: 'Cập nhật mẫu hoa' });
  await editor.getByLabel('Tên mẫu hoa').fill('Bó hồng pastel Premium');
  await editor.getByLabel('Trạng thái').selectOption('DRAFT');
  await editor.getByRole('button', { name: 'Lưu thay đổi' }).click();
  const editedRow = panel.getByRole('row').filter({ hasText: 'Bó hồng pastel Premium' });
  await expect(editedRow).toContainText('Bản nháp');

  await panel.getByRole('button', { name: 'Vô hiệu hóa Bó hồng pastel Premium' }).click();
  const confirm = page.getByRole('dialog', { name: 'Vô hiệu hóa mẫu hoa?' });
  await confirm.getByRole('button', { name: 'Hủy' }).click();
  await expect(editedRow).toContainText('Bản nháp');
});

test('Staff has scoped actions and can only update task status', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await mockDashboard(page, 'SELLER_STAFF');
  await page.goto('/staff');

  const panel = page.getByRole('region', { name: 'Danh sách công việc mẫu' });
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: /Thêm/ })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: /Vô hiệu hóa/ })).toHaveCount(0);
  await expect(panel.getByText('Hiển thị 1–4 trong 6 mục')).toBeVisible();

  await panel.getByRole('button', { name: 'Sửa Nạp hoa ngăn A01–A04' }).click();
  const editor = page.getByRole('dialog', { name: 'Cập nhật công việc' });
  await expect(editor.getByLabel('Nội dung')).toHaveAttribute('readonly', '');
  await expect(editor.getByLabel('Trạng thái')).toBeFocused();
  await editor.getByLabel('Trạng thái').selectOption('IN_PROGRESS');
  await editor.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(panel.getByRole('row').filter({ hasText: 'Nạp hoa ngăn A01–A04' })).toContainText(
    'Đang thực hiện',
  );

  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
});

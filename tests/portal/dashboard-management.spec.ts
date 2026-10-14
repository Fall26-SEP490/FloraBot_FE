import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

type DashboardRole = 'ADMIN' | 'SELLER' | 'SELLER_STAFF';

const mockManagers = [
  {
    id: 'mgr-01',
    email: 'quanly1@florabot.vn',
    fullName: 'Trần Văn Quản Lý',
    phone: '0901234567',
    status: 'ACTIVE',
    role: 'OPERATIONS_MANAGER',
    createdAt: '2026-10-10T08:00:00Z',
  },
  {
    id: 'mgr-02',
    email: 'quanly2@florabot.vn',
    fullName: 'Lê Thị Điều Phối',
    phone: '0909876543',
    status: 'LOCKED',
    role: 'OPERATIONS_MANAGER',
    createdAt: '2026-10-11T09:30:00Z',
  },
];

const mockSellerStaff = [
  {
    id: 'stf-01',
    email: 'staff1@hoasaigon.vn',
    fullName: 'Nguyễn Thị Hoa',
    phone: '0912345678',
    status: 'ACTIVE',
    role: 'SELLER_STAFF',
    createdAt: '2026-10-10T10:00:00Z',
  },
  {
    id: 'stf-02',
    email: 'staff2@hoasaigon.vn',
    fullName: 'Phạm Minh Tuấn',
    phone: '0987654321',
    status: 'ACTIVE',
    role: 'SELLER_STAFF',
    createdAt: '2026-10-11T11:00:00Z',
  },
  {
    id: 'stf-03',
    email: 'staff3@hoasaigon.vn',
    fullName: 'Đỗ Văn Nghỉ',
    phone: null,
    status: 'DISABLED',
    role: 'SELLER_STAFF',
    createdAt: '2026-10-12T12:00:00Z',
  },
];

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
    if (path === '/api/admin/managers') {
      return route.fulfill({ json: mockManagers });
    }
    if (path.includes('/staff/accounts')) {
      return route.fulfill({ json: mockSellerStaff });
    }
    if (path.endsWith('/products')) return route.fulfill({ json: [] });
    if (path.endsWith('/wallet')) return route.fulfill({ json: { balance: null } });
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
}

test('Admin overview displays truthful Operations Manager personnel summary linking to /admin/managers and avoids mock CRUD', async ({
  page,
}) => {
  await mockDashboard(page, 'ADMIN');
  await page.goto('/admin');

  // Verify truthful personnel summary card exists for Operations Managers
  const panel = page.getByRole('region', { name: 'Đội ngũ Quản lý vận hành' });
  await expect(panel).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Đội ngũ Quản lý vận hành' })).toBeVisible();

  // Verify real counts from API: 2 total, 1 active, 1 locked/disabled
  await expect(panel.getByText('Tổng số tài khoản')).toBeVisible();
  await expect(panel.getByText('2')).toBeVisible();
  await expect(panel.getByText('Đang hoạt động')).toBeVisible();
  await expect(panel.getByText('1').first()).toBeVisible();

  // Verify direct link to real personnel management
  const manageLink = page.getByRole('link', { name: 'Quản lý tài khoản' });
  await expect(manageLink).toBeVisible();
  await expect(manageLink).toHaveAttribute('href', '/admin/managers');

  // Verify fake mock CRUD buttons and fake Staff accounts are completely removed from overview
  await expect(page.getByRole('button', { name: 'Thêm tài khoản' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Vô hiệu hóa/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Sửa / })).toHaveCount(0);
  await expect(page.getByText('Nguyễn Minh An')).toHaveCount(0);
  await expect(page.getByText('an@hoasaigon.vn')).toHaveCount(0);
});

test('Admin overview has no page-level horizontal overflow at viewport 934px', async ({ page }) => {
  // Test coordinator reported viewport ~934px
  await page.setViewportSize({ width: 934, height: 850 });
  await mockDashboard(page, 'ADMIN');
  await page.goto('/admin');

  await expect(page.getByRole('heading', { name: 'Ưu tiên giám sát hệ thống' })).toBeVisible();

  // Verify no horizontal overflow at the page/body level
  const docOverflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth);
  const bodyOverflow = await page.evaluate(() => document.body.scrollWidth <= innerWidth);
  expect(docOverflow).toBe(true);
  expect(bodyOverflow).toBe(true);

  // Verify accessible contrast and hierarchy at 934px
  const axeResults = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(axeResults.violations).toEqual([]);
});

test('Seller overview displays truthful Seller Staff personnel summary linking to /seller/staff', async ({
  page,
}) => {
  await mockDashboard(page, 'SELLER');
  await page.goto('/seller');

  // Verify truthful personnel summary card exists for shop staff
  const panel = page.getByRole('region', { name: 'Đội ngũ Nhân viên shop' });
  await expect(panel).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Đội ngũ Nhân viên shop' })).toBeVisible();

  // Verify real counts from API: 3 total, 2 active, 1 inactive/disabled
  await expect(panel.getByText('Tổng số nhân viên')).toBeVisible();
  await expect(panel.getByText('3')).toBeVisible();
  await expect(panel.getByText('Đang làm việc')).toBeVisible();
  await expect(panel.getByText('2')).toBeVisible();

  // Verify link to real seller staff management
  const staffLink = page.getByRole('link', { name: 'Quản lý nhân viên' });
  await expect(staffLink).toBeVisible();
  await expect(staffLink).toHaveAttribute('href', '/seller/staff');

  // Verify fake catalog CRUD table is not rendered on overview
  await expect(page.getByRole('button', { name: 'Thêm mẫu hoa' })).toHaveCount(0);
  await expect(page.getByText('HB-PASTEL-01')).toHaveCount(0);
});

test('Staff workspace renders real assigned tasks without fake mock management tables or horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 1000 });
  await mockDashboard(page, 'SELLER_STAFF');
  await page.goto('/staff');

  // Verify real staff tasks heading and guide are present
  await expect(page.getByRole('heading', { name: 'Chào Nhân viên ca sáng' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Từ nhận việc đến hoàn thành' })).toBeVisible();

  // Verify fake mock management table is NOT present
  await expect(page.getByRole('region', { name: 'Danh sách công việc mẫu' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Thêm/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Vô hiệu hóa/ })).toHaveCount(0);

  // Verify responsive width has no horizontal overflow
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);

  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
});

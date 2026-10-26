import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Status confirmation prevents duplicate requests and closing while pending', async ({
  page,
}) => {
  const account = {
    id: 'pending-manager',
    email: 'pending@florabot.test',
    fullName: 'Quản lý chờ xử lý',
    phone: null,
    status: 'ACTIVE',
    role: 'OPERATIONS_MANAGER',
    createdAt: '2026-10-14T00:00:00Z',
  };
  let release!: () => void;
  let requests = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: adminSession }));
  await page.route('**/api/admin/managers**', async (route) => {
    if (route.request().method() === 'PATCH') {
      requests++;
      await gate;
      account.status = 'LOCKED';
      return route.fulfill({ json: account });
    }
    return route.fulfill({ json: [account] });
  });
  try {
    await page.goto('/admin/managers');
    await page.getByRole('button', { name: `Khóa ${account.fullName}`, exact: true }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Xác nhận khóa', exact: true }).click();
    await expect(
      dialog.getByRole('button', { name: 'Đang cập nhật…', exact: true }),
    ).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Hủy', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    expect(requests).toBe(1);
    release();
    await expect(dialog).toBeHidden();
    await expect(
      page
        .getByRole('row')
        .filter({ hasText: account.email })
        .getByText('Tạm khóa', { exact: true }),
    ).toBeVisible();
  } finally {
    release();
  }
});

const adminSession = {
  id: '10000000-0000-0000-0000-000000000001',
  name: 'Quản Trị Viên',
  role: 'ADMIN',
  sellerId: null,
  sellerStatus: null,
  packageExpiresAt: null,
};

const operationsManagerSession = {
  id: '10000000-0000-0000-0000-000000000010',
  name: 'Nguyễn Quản Lý',
  role: 'OPERATIONS_MANAGER',
  sellerId: null,
  sellerStatus: null,
  packageExpiresAt: null,
};

const sellerSession = {
  id: '10000000-0000-0000-0000-000000000020',
  name: 'Chủ Tiệm Hoa',
  role: 'SELLER',
  sellerId: '20000000-0000-0000-0000-000000000001',
  sellerStatus: 'ACTIVE',
  packageExpiresAt: '2030-01-01',
};

const technicianSession = {
  id: '10000000-0000-0000-0000-000000000030',
  name: 'Trần Kỹ Thuật',
  role: 'TECHNICIAN',
  sellerId: null,
  sellerStatus: null,
  packageExpiresAt: null,
};

const staffSession = {
  id: '10000000-0000-0000-0000-000000000040',
  name: 'Lê Nhân Viên',
  role: 'SELLER_STAFF',
  sellerId: '20000000-0000-0000-0000-000000000001',
  sellerStatus: 'ACTIVE',
  packageExpiresAt: null,
};

test.describe('Account Management UI - Multi-Role, Hierarchy & Security', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
  });

  test('Admin can list, create, view, search, and update status of Operations Managers', async ({
    page,
  }) => {
    const managers = [
      {
        id: 'mgr-1',
        email: 'ops1@florabot.vn',
        fullName: 'Nguyễn Văn Quản Lý',
        phone: '0901234567',
        status: 'ACTIVE',
        role: 'OPERATIONS_MANAGER',
        createdAt: '2026-10-10T08:00:00Z',
      },
      {
        id: 'mgr-2',
        email: 'ops2@florabot.vn',
        fullName: 'Trần Thị Điều Phối',
        phone: null,
        status: 'LOCKED',
        role: 'OPERATIONS_MANAGER',
        createdAt: '2026-10-11T09:30:00Z',
      },
    ];

    let createdPayload: unknown = null;
    let patchedStatus: { id: string; status: string } | null = null;

    await page.route('**/api/auth/me', (route) => route.fulfill({ json: adminSession }));

    await page.route('**/api/admin/managers**', async (route) => {
      const req = route.request();
      const url = new URL(req.url());

      if (req.method() === 'GET') {
        const id = url.pathname.split('/')[4];
        if (id) return route.fulfill({ json: managers.find((manager) => manager.id === id) });
        return route.fulfill({ json: managers });
      }

      if (req.method() === 'POST') {
        createdPayload = req.postDataJSON();
        const postData = req.postDataJSON() as { email: string; fullName: string; phone?: string };
        if (postData.email === 'duplicate@florabot.vn') {
          return route.fulfill({
            status: 409,
            json: { detail: 'Email này đã được sử dụng trong hệ thống.' },
          });
        }
        const createdItem = {
          id: 'mgr-3',
          email: postData.email,
          fullName: postData.fullName,
          phone: postData.phone || null,
          status: 'ACTIVE',
          role: 'OPERATIONS_MANAGER',
          createdAt: new Date().toISOString(),
        };
        managers.push(createdItem);
        return route.fulfill({ status: 201, json: createdItem });
      }

      if (req.method() === 'PATCH' && url.pathname.endsWith('/status')) {
        const parts = url.pathname.split('/');
        const id = parts[parts.length - 2];
        const body = req.postDataJSON() as { status: string };
        patchedStatus = { id, status: body.status };
        const found = managers.find((m) => m.id === id);
        if (found) found.status = body.status;
        return route.fulfill({ json: found ?? { id, status: body.status } });
      }

      return route.fallback();
    });

    await page.goto('/admin/managers');

    // 1. Verify heading & stats
    await expect(
      page.getByRole('heading', { level: 2, name: 'Đội ngũ quản lý vận hành' }),
    ).toBeVisible();
    await expect(page.getByText('Tổng số Quản lý vận hành')).toBeVisible();
    await expect(
      page.getByRole('region', { name: 'Thống kê đội ngũ quản lý vận hành' }),
    ).toBeVisible();

    // 2. Verify rows in table
    const table = page.getByRole('table', { name: 'Đội ngũ quản lý vận hành' });
    await expect(table.getByRole('row').filter({ hasText: 'Nguyễn Văn Quản Lý' })).toBeVisible();
    await expect(table.getByRole('row').filter({ hasText: 'Trần Thị Điều Phối' })).toBeVisible();
    await expect(table.getByRole('row').filter({ hasText: 'ops1@florabot.vn' })).toBeVisible();

    // 3. Search filter
    const searchInput = page.getByPlaceholder('Tìm theo họ tên, email, SĐT…');
    await searchInput.fill('Điều Phối');
    await expect(table.getByRole('row').filter({ hasText: 'Trần Thị Điều Phối' })).toBeVisible();
    await expect(table.getByRole('row').filter({ hasText: 'Nguyễn Văn Quản Lý' })).toHaveCount(0);
    await searchInput.fill('');
    await expect(table.getByRole('row').filter({ hasText: 'Nguyễn Văn Quản Lý' })).toBeVisible();

    // 4. Detail view (confirm password is NOT exposed)
    await page.getByRole('button', { name: 'Chi tiết Nguyễn Văn Quản Lý' }).click();
    const detailDialog = page.getByRole('dialog', { name: 'Chi tiết Quản lý vận hành' });
    await expect(detailDialog).toBeVisible();
    await expect(detailDialog.getByText('ops1@florabot.vn')).toBeVisible();
    await expect(detailDialog.getByText('0901234567')).toBeVisible();
    await expect(detailDialog.getByText(/password|mật khẩu/i)).toHaveCount(0);
    await detailDialog.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click();
    await expect(detailDialog).toBeHidden();

    // 5. Create validation errors & show/hide password accessible toggle
    await page.getByRole('button', { name: 'Thêm Quản lý vận hành' }).click();
    const createModal = page.getByRole('dialog', { name: 'Thêm Quản lý vận hành' });
    await expect(createModal).toBeVisible();

    const nameInput = createModal.getByLabel(/Họ và tên/);
    const emailInput = createModal.getByLabel(/Địa chỉ email/);
    const passwordInput = createModal.getByLabel(/^Mật khẩu/);
    const phoneInput = createModal.getByLabel(/Số điện thoại/);
    const togglePassBtn = createModal.getByRole('button', { name: /Hiện mật khẩu|Ẩn mật khẩu/ });

    // Show/hide password test
    await expect(passwordInput).toHaveAttribute('type', 'password');
    await expect(togglePassBtn).toHaveAttribute('aria-pressed', 'false');
    await togglePassBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'text');
    await expect(togglePassBtn).toHaveAttribute('aria-pressed', 'true');
    await togglePassBtn.click();
    await expect(passwordInput).toHaveAttribute('type', 'password');

    // Trigger validation
    await nameInput.fill('A');
    await emailInput.fill('invalid-email');
    await passwordInput.fill('123');
    await phoneInput.fill('12345');
    await createModal.getByRole('button', { name: 'Tạo tài khoản' }).click();

    await expect(createModal.getByText('Họ và tên phải từ 2 đến 120 ký tự.')).toBeVisible();
    await expect(createModal.getByText('Email không đúng định dạng.')).toBeVisible();
    await expect(
      createModal.getByText('Mật khẩu phải từ 6 đến 72 ký tự.', { exact: true }),
    ).toBeVisible();
    await expect(createModal.getByText('Số điện thoại Việt Nam không hợp lệ')).toBeVisible();

    // 6. Handle 409 Duplicate error honestly
    await nameInput.fill('Trùng Lặp Email');
    await emailInput.fill('duplicate@florabot.vn');
    await passwordInput.fill('password123');
    await phoneInput.fill('');
    await createModal.getByRole('button', { name: 'Tạo tài khoản' }).click();

    await expect(createModal.getByText('Email này đã được sử dụng trong hệ thống.')).toBeVisible();

    // 7. Successful creation
    await emailInput.fill('newops@florabot.vn');
    await createModal.getByRole('button', { name: 'Tạo tài khoản' }).click();
    await expect(createModal).toBeHidden();

    expect(createdPayload).toEqual({
      fullName: 'Trùng Lặp Email',
      email: 'newops@florabot.vn',
      password: 'password123',
      phone: null,
    });

    await expect(table.getByRole('row').filter({ hasText: 'Trùng Lặp Email' })).toBeVisible();
    await expect(page.getByText('Đã tạo thành công tài khoản cho Trùng Lặp Email.')).toBeVisible();

    // 8. Status change: Lock account
    await page.getByRole('button', { name: 'Khóa Nguyễn Văn Quản Lý' }).click();
    const confirmLock = page.getByRole('dialog', { name: 'Khóa tài khoản Nguyễn Văn Quản Lý?' });
    await expect(confirmLock).toBeVisible();
    await confirmLock.getByRole('button', { name: 'Xác nhận khóa' }).click();
    await expect(confirmLock).toBeHidden();

    expect(patchedStatus).toEqual({ id: 'mgr-1', status: 'LOCKED' });

    // 9. Status change: Unlock account (LOCKED -> ACTIVE)
    await page.getByRole('button', { name: 'Mở khóa Trần Thị Điều Phối' }).click();
    const confirmUnlock = page.getByRole('dialog', {
      name: 'Kích hoạt lại tài khoản Trần Thị Điều Phối?',
    });
    await expect(confirmUnlock).toBeVisible();
    await confirmUnlock.getByRole('button', { name: 'Xác nhận kích hoạt' }).click();
    await expect(confirmUnlock).toBeHidden();

    expect(patchedStatus).toEqual({ id: 'mgr-2', status: 'ACTIVE' });
  });

  test('Operations Manager can list, create, and manage Technicians via /operations/technicians', async ({
    page,
  }) => {
    const technicians = [
      {
        id: 'tech-1',
        email: 'tech1@florabot.vn',
        fullName: 'Trần Kỹ Thuật Viên',
        phone: '0907654321',
        status: 'ACTIVE',
        role: 'TECHNICIAN',
        createdAt: '2026-10-12T10:00:00Z',
      },
    ];

    let createdTech: unknown = null;
    let patchedStatus: unknown = null;

    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ json: operationsManagerSession }),
    );

    await page.route('**/api/operations/technicians**', async (route) => {
      const req = route.request();
      const url = new URL(req.url());

      if (req.method() === 'GET') {
        return route.fulfill({ json: technicians });
      }

      if (req.method() === 'POST') {
        createdTech = req.postDataJSON();
        const postData = req.postDataJSON() as { email: string; fullName: string };
        const created = {
          id: 'tech-2',
          email: postData.email,
          fullName: postData.fullName,
          phone: null,
          status: 'ACTIVE',
          role: 'TECHNICIAN',
          createdAt: new Date().toISOString(),
        };
        technicians.push(created);
        return route.fulfill({ status: 201, json: created });
      }

      if (req.method() === 'PATCH' && url.pathname.endsWith('/status')) {
        patchedStatus = req.postDataJSON();
        return route.fulfill({
          json: { ...technicians[0], status: (req.postDataJSON() as { status: string }).status },
        });
      }

      return route.fallback();
    });

    await page.goto('/operations/technicians');

    await expect(
      page.getByRole('heading', { level: 2, name: 'Quản lý Kỹ thuật viên' }),
    ).toBeVisible();
    const table = page.getByRole('table', { name: 'Quản lý Kỹ thuật viên' });
    await expect(table.getByRole('row').filter({ hasText: 'Trần Kỹ Thuật Viên' })).toBeVisible();

    // Create technician
    await page.getByRole('button', { name: 'Thêm Kỹ thuật viên' }).click();
    const modal = page.getByRole('dialog', { name: 'Thêm Kỹ thuật viên' });
    await modal.getByLabel(/Họ và tên/).fill('Kỹ Thuật Viên Mới');
    await modal.getByLabel(/Địa chỉ email/).fill('tech_new@florabot.vn');
    await modal.getByLabel(/^Mật khẩu/).fill('secureTechPassword99');
    await modal.getByRole('button', { name: 'Tạo tài khoản' }).click();

    await expect(modal).toBeHidden();
    expect(createdTech).toEqual({
      fullName: 'Kỹ Thuật Viên Mới',
      email: 'tech_new@florabot.vn',
      password: 'secureTechPassword99',
      phone: null,
    });
    await expect(table.getByRole('row').filter({ hasText: 'Kỹ Thuật Viên Mới' })).toBeVisible();

    // Disable technician
    await page.getByRole('button', { name: 'Vô hiệu hóa Trần Kỹ Thuật Viên' }).click();
    const confirm = page.getByRole('dialog', {
      name: 'Vô hiệu hóa tài khoản Trần Kỹ Thuật Viên?',
    });
    await expect(confirm).toBeVisible();
    await confirm.getByRole('button', { name: 'Xác nhận vô hiệu hóa' }).click();
    await expect(confirm).toBeHidden();

    expect(patchedStatus).toEqual({ status: 'DISABLED' });
  });

  test('Seller manages own Seller Staff via /seller/staff with isolated tenant ID and /accounts directory', async ({
    page,
  }) => {
    const staffAccounts = [
      {
        id: 'staff-1',
        email: 'staff1@shop.vn',
        fullName: 'Nguyễn Thị Bán Hoa',
        phone: '0987654321',
        status: 'ACTIVE',
        role: 'SELLER_STAFF',
        createdAt: '2026-10-13T07:00:00Z',
      },
    ];

    let requestedDirectoryUrl = '';
    let postedPayload: unknown = null;
    let patchedStaffStatus: unknown = null;

    await page.route('**/api/auth/me', (route) => route.fulfill({ json: sellerSession }));

    await page.route(
      '**/api/sellers/20000000-0000-0000-0000-000000000001/staff**',
      async (route) => {
        const req = route.request();
        const url = new URL(req.url());

        if (req.method() === 'GET' && url.pathname.endsWith('/accounts')) {
          requestedDirectoryUrl = url.pathname;
          return route.fulfill({ json: staffAccounts });
        }

        if (req.method() === 'POST' && url.pathname.endsWith('/staff')) {
          postedPayload = req.postDataJSON();
          const postData = req.postDataJSON() as { email: string; fullName: string };
          const newStaff = {
            id: 'staff-2',
            email: postData.email,
            fullName: postData.fullName,
            phone: null,
            status: 'ACTIVE',
            role: 'SELLER_STAFF',
            createdAt: new Date().toISOString(),
          };
          staffAccounts.push(newStaff);
          return route.fulfill({ status: 201, json: newStaff });
        }

        if (req.method() === 'PATCH' && url.pathname.endsWith('/status')) {
          patchedStaffStatus = req.postDataJSON();
          return route.fulfill({
            json: {
              ...staffAccounts[0],
              status: (req.postDataJSON() as { status: string }).status,
            },
          });
        }

        return route.fallback();
      },
    );

    await page.goto('/seller/staff');

    await expect(
      page.getByRole('heading', { level: 2, name: 'Quản lý Nhân viên shop' }),
    ).toBeVisible();
    const table = page.getByRole('table', { name: 'Quản lý Nhân viên shop' });

    // Verify it called NEW GET /sellers/{id}/staff/accounts per coordinator finding
    expect(requestedDirectoryUrl).toBe(
      '/api/sellers/20000000-0000-0000-0000-000000000001/staff/accounts',
    );
    await expect(table.getByRole('row').filter({ hasText: 'Nguyễn Thị Bán Hoa' })).toBeVisible();

    // Create staff
    await page.getByRole('button', { name: 'Thêm nhân viên shop' }).click();
    const modal = page.getByRole('dialog', { name: 'Thêm nhân viên shop' });
    await modal.getByLabel(/Họ và tên/).fill('Nhân Viên Mới');
    await modal.getByLabel(/Địa chỉ email/).fill('newstaff@shop.vn');
    await modal.getByLabel(/^Mật khẩu/).fill('staffpass123');
    await modal.getByRole('button', { name: 'Tạo tài khoản' }).click();

    await expect(modal).toBeHidden();
    expect(postedPayload).toEqual({
      fullName: 'Nhân Viên Mới',
      email: 'newstaff@shop.vn',
      password: 'staffpass123',
      phone: null,
    });
    await expect(table.getByRole('row').filter({ hasText: 'Nhân Viên Mới' })).toBeVisible();

    // Lock staff
    await page.getByRole('button', { name: 'Khóa Nguyễn Thị Bán Hoa' }).click();
    const confirm = page.getByRole('dialog', { name: 'Khóa tài khoản Nguyễn Thị Bán Hoa?' });
    await confirm.getByRole('button', { name: 'Xác nhận khóa' }).click();
    await expect(confirm).toBeHidden();
    expect(patchedStaffStatus).toEqual({ status: 'LOCKED' });
  });

  test('Negative navigation: Technician and Staff are denied access to management routes and cannot create people', async ({
    page,
  }) => {
    // 1. Technician navigating to /admin/managers -> redirected to /technician
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: technicianSession }));
    await page.goto('/admin/managers');
    await expect(page).toHaveURL(/\/technician$/);
    await expect(page.getByRole('button', { name: /Thêm/ })).toHaveCount(0);

    // Technician navigating to /operations/technicians -> redirected to /technician
    await page.goto('/operations/technicians');
    await expect(page).toHaveURL(/\/technician$/);

    // Technician navigating to /seller/staff -> redirected to /technician
    await page.goto('/seller/staff');
    await expect(page).toHaveURL(/\/technician$/);

    // 2. Seller Staff navigating to /admin/managers -> redirected to /staff
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: staffSession }));
    await page.goto('/admin/managers');
    await expect(page).toHaveURL(/\/staff$/);

    // Staff navigating to /operations/technicians -> redirected to /staff
    await page.goto('/operations/technicians');
    await expect(page).toHaveURL(/\/staff$/);

    // Staff navigating to /seller/staff -> redirected to /staff
    await page.goto('/seller/staff');
    await expect(page).toHaveURL(/\/staff$/);
    await expect(page.getByRole('button', { name: /Thêm/ })).toHaveCount(0);

    // 3. Operations Manager cannot enter /admin/managers or /seller/staff
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ json: operationsManagerSession }),
    );
    await page.goto('/admin/managers');
    await expect(page).toHaveURL(/\/operations$/);

    await page.goto('/seller/staff');
    await expect(page).toHaveURL(/\/operations$/);
  });

  for (const width of [390, 1440]) {
    test(`Account management accessibility and reflow at ${width}px`, async ({ page }) => {
      await page.setViewportSize({ width, height: 950 });
      await page.route('**/api/auth/me', (route) => route.fulfill({ json: adminSession }));
      await page.route('**/api/admin/managers**', (route) =>
        route.fulfill({
          json: [
            {
              id: 'mgr-1',
              email: 'manager@florabot.vn',
              fullName: 'Võ Minh Trí',
              phone: '0912345678',
              status: 'ACTIVE',
              role: 'OPERATIONS_MANAGER',
              createdAt: '2026-10-10T00:00:00Z',
            },
          ],
        }),
      );

      await page.goto('/admin/managers');
      await expect(
        page.getByRole('heading', { level: 2, name: 'Đội ngũ quản lý vận hành' }),
      ).toBeVisible();

      // Check WCAG accessibility
      const axeResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(axeResults.violations).toEqual([]);

      // Check horizontal reflow
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    });
  }
});

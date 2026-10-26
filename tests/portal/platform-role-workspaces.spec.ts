import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const profile = (id: string, role = 'CUSTOMER') => ({
  id,
  role,
  fullName: `Tài khoản ${id}`,
  email: `${id}@example.test`,
  phone: '0901234567',
  address: '12 Nguyễn Huệ',
  status: 'ACTIVE',
  createdAt: '2026-10-20T00:00:00Z',
  updatedAt: '2026-10-20T00:00:00Z',
});

async function setup(page: Page, role = 'OPERATIONS_MANAGER') {
  const calls: string[] = [];
  const writes: { path: string; method: string; body: Record<string, unknown> }[] = [];
  const customer = profile('customer');
  const manager = profile('manager', 'OPERATIONS_MANAGER');
  const tech = profile('tech', 'TECHNICIAN');
  const owner = { ...profile('owner', 'SELLER'), sellerId: 'shop' };
  const shop = {
    id: 'shop',
    shopName: 'Hoa Bình An',
    phone: '0901234567',
    address: '12 Nguyễn Huệ',
    status: 'ACTIVE',
    packageName: 'Pro',
    packageId: 'package',
    packageExpiresAt: '2027-01-01',
    packageExpiresAtTs: null,
    contactEmail: 'shop@example.test',
    brandTone: null,
    createdAt: '2026-10-20T00:00:00Z',
    updatedAt: '2026-10-20T00:00:00Z',
  };
  const state = {
    failHistory: false,
    failCustomer: false,
    conflict: false,
    failTechDetail: false,
    evidenceError: false,
    profileReads: 0,
  };
  const job = {
    id: 'installation',
    shopName: 'Hoa Bình An',
    phone: '0901234567',
    contactEmail: 'shop@example.test',
    installationAddress: '12 Nguyễn Huệ',
    latitude: 10.77,
    longitude: 106.7,
    kioskCode: 'K-TEST',
    kioskId: 'kiosk',
    scheduledDate: '2026-11-10',
    timeWindow: '10:00 - 12:00',
    status: 'SCHEDULED',
    reworkReason: null,
    technicianReport: null,
    evidence: [],
  };
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    const method = request.method();
    calls.push(`${method} ${path}${url.search}`);
    if (path === '/api/auth/me')
      return route.fulfill({
        json: {
          id: `actor-${role}`,
          name: 'Người kiểm tra',
          role,
          sellerId: null,
          sellerStatus: null,
          packageExpiresAt: null,
        },
      });
    if (path === '/api/auth/config')
      return route.fulfill({
        json: { googleEnabled: false, registrationEmailEnabled: false, googleClientId: null },
      });
    if (path === '/api/auth/refresh') return route.fulfill({ status: 401 });
    if (method !== 'GET')
      writes.push({ path, method, body: request.postDataJSON() as Record<string, unknown> });
    const body = method === 'GET' ? {} : (request.postDataJSON() as Record<string, unknown>);
    if (path === '/api/admin/managers' || path === '/api/operations/technicians')
      return route.fulfill({ json: [path.includes('managers') ? manager : tech] });
    if (path === '/api/admin/managers/manager' || path === '/api/operations/technicians/tech') {
      const row = path.includes('managers') ? manager : tech;
      if (method === 'PUT') Object.assign(row, body);
      return route.fulfill({ json: row });
    }
    if (path === '/api/operations/customers') {
      if (state.failCustomer)
        return route.fulfill({ status: 500, json: { detail: 'Lỗi tải danh sách khách hàng' } });
      if (method === 'POST')
        return route.fulfill({ status: 201, json: { ...customer, ...body, id: 'new-customer' } });
      return route.fulfill({
        json: {
          items: [customer],
          page: Number(url.searchParams.get('page') || 1),
          hasMore: url.searchParams.get('page') !== '2',
        },
      });
    }
    if (path.startsWith('/api/operations/customers/customer')) {
      if (method === 'PUT' || method === 'PATCH') Object.assign(customer, body);
      return route.fulfill({ json: customer });
    }
    if (path === '/api/operations/sellers')
      return route.fulfill({ json: { items: [shop], page: 1, hasMore: false } });
    if (path === '/api/operations/sellers/shop') {
      if (method === 'PUT') Object.assign(shop, body);
      return route.fulfill({ json: shop });
    }
    if (path === '/api/operations/sellers/shop/accounts') return route.fulfill({ json: [owner] });
    if (path === '/api/operations/sellers/shop/accounts/owner') {
      Object.assign(owner, body);
      return route.fulfill({ json: owner });
    }
    if (path === '/api/operations/sellers/shop/status-history')
      return state.failHistory
        ? route.fulfill({ status: 500, json: { detail: 'Lỗi lịch sử shop' } })
        : route.fulfill({
            json: {
              items: [
                {
                  id: 'history',
                  actorId: 'manager',
                  fromStatus: 'ACTIVE',
                  toStatus: 'SUSPENDED',
                  reason: 'Lý do kiểm tra',
                  action: 'SELLER_STATUS_SUSPENDED',
                  createdAt: '2026-10-26T00:00:00Z',
                },
              ],
              page: 1,
              hasMore: false,
            },
          });
    if (path === '/api/operations/sellers/shop/status') {
      if (state.conflict)
        return route.fulfill({
          status: 409,
          json: { detail: 'Gói thuê hiện tại không còn hợp lệ' },
        });
      shop.status = String(body.status);
      return route.fulfill({ json: shop });
    }
    if (path === '/api/admin/accounts')
      return route.fulfill({
        json: {
          items: [{ ...owner, bank: { bankName: 'BANK TEST', accountLast4: '4444' } }],
          page: 1,
          hasMore: false,
        },
      });
    if (path === '/api/admin/accounts/owner/profile') {
      state.profileReads++;
      return route.fulfill({
        headers: { 'Cache-Control': 'no-store' },
        json: {
          ...owner,
          loginEmail: owner.email,
          contactEmail: owner.email,
          gender: 'OTHER',
          dateOfBirth: '2000-01-01',
          personalBank: {
            bankName: 'BANK TEST',
            accountHolder: 'OWNER TEST',
            accountLast4: '4444',
            accountNumber: '1111222233334444',
            status: 'READY',
          },
          shopBank: {
            bankName: 'SHOP BANK TEST',
            bankHolder: 'SHOP TEST',
            accountSuffix: '8888',
            accountNumber: '5555666677778888',
            status: 'READY',
          },
        },
      });
    }
    if (path === '/api/staff/kiosk-installations') return route.fulfill({ json: [job] });
    if (path === '/api/staff/kiosk-installations/installation')
      return state.failTechDetail
        ? route.fulfill({ status: 500, json: { detail: 'Lỗi chi tiết' } })
        : route.fulfill({ json: job });
    if (path.endsWith('/installation/evidence'))
      return state.evidenceError
        ? route.fulfill({ status: 500 })
        : route.fulfill({ json: [{ id: 'evidence', createdAt: '2026-10-26T00:00:00Z' }] });
    if (path.endsWith('/installation/start')) {
      job.status = 'INSTALLING';
      return route.fulfill({ json: job });
    }
    if (path.endsWith('/installation/submit')) {
      job.status = 'AWAITING_HANDOVER';
      return route.fulfill({ json: job });
    }
    if (path.endsWith('/installation/evidence/evidence')) return route.fulfill({ status: 404 });
    if (
      path === '/api/operations/kiosk-applications' ||
      path.endsWith('/staff-tasks') ||
      path === '/api/staff/tasks'
    )
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    if (
      path === '/api/operations/eligible-kiosks' ||
      path === '/api/operations/staff' ||
      path === '/api/operations/incidents'
    )
      return route.fulfill({ json: [] });
    return route.fulfill({ status: 404, json: { detail: 'No fixture for this endpoint' } });
  });
  return { calls, writes, state, customer, shop, job };
}

for (const [role, url, label] of [
  ['ADMIN', '/admin/managers', 'Manager'],
  ['OPERATIONS_MANAGER', '/operations/technicians', 'Technician'],
]) {
  test(`${label}: remote detail and profile editing`, async ({ page }) => {
    const { writes } = await setup(page, role);
    await page.goto(url);
    await page.getByRole('button', { name: /^Chi tiết/ }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByText('12 Nguyễn Huệ', { exact: true })).toBeVisible();
    await dialog.getByRole('button', { name: 'Chỉnh sửa thông tin' }).click();
    await dialog.getByLabel('Họ và tên', { exact: true }).fill('Tên sau chỉnh sửa');
    await dialog.getByLabel('Địa chỉ', { exact: true }).fill('45 Lê Lợi');
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(dialog.getByRole('status')).toContainText('Đã lưu');
    expect(writes.find((write) => write.method === 'PUT')?.body).toEqual({
      fullName: 'Tên sau chỉnh sửa',
      phone: '0901234567',
      address: '45 Lê Lợi',
    });
    await dialog.getByRole('button', { name: 'Chỉnh sửa thông tin' }).click();
    await dialog.getByLabel('Số điện thoại', { exact: true }).fill('');
    await dialog.getByLabel('Địa chỉ', { exact: true }).fill('');
    await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
    await expect(dialog.getByRole('status')).toContainText('Đã lưu');
    expect(writes.filter((write) => write.method === 'PUT').at(-1)?.body).toMatchObject({
      phone: '',
      address: '',
    });
    await expect(dialog.getByText('0901234567', { exact: true })).toHaveCount(0);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
  });
}

test('Profile address validation matches BE limits before sending PUT', async ({ page }) => {
  const { writes } = await setup(page);
  await page.goto('/operations/technicians');
  await page.getByRole('button', { name: /^Chi tiết/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Chỉnh sửa thông tin' }).click();
  const address = dialog.getByLabel('Địa chỉ', { exact: true });
  await expect(address).toHaveAttribute('maxlength', '300');
  await address.fill('Địa chỉ có\nxuống dòng');
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(dialog.getByRole('alert')).toContainText('300 ký tự');
  expect(writes.filter((write) => write.method === 'PUT')).toHaveLength(0);
  await address.fill('Địa chỉ hợp lệ');
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(dialog.getByRole('status')).toContainText('Đã lưu');
  expect(writes.filter((write) => write.method === 'PUT')).toHaveLength(1);
});

test('Customer server paging, filters, create, profile and status', async ({ page }) => {
  const { calls, writes } = await setup(page);
  await page.goto('/operations/customers');
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expect.poll(() => calls.some((call) => call.includes('/customers?page=2'))).toBe(true);
  await page.getByLabel('Tìm kiếm', { exact: true }).fill('khách');
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await expect
    .poll(() => calls.some((call) => call.includes('page=1') && call.includes('search=kh%C3%A1ch')))
    .toBe(true);
  await page.getByRole('button', { name: 'Thêm khách hàng', exact: true }).click();
  const create = page.getByRole('dialog');
  await create.getByLabel('Họ và tên', { exact: true }).fill('Khách mới');
  await create.getByLabel('Email đăng nhập', { exact: true }).fill('new@example.test');
  await create.getByLabel('Mật khẩu ban đầu', { exact: true }).fill('FixturePassword123!');
  await create.getByRole('button', { name: 'Tạo khách hàng', exact: true }).click();
  await expect(create).toHaveCount(0);
  expect(writes.find((write) => write.method === 'POST')?.body.email).toBe('new@example.test');
  await page.getByRole('button', { name: /^Chi tiết/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Chỉnh sửa thông tin' }).click();
  await page.getByRole('dialog').getByLabel('Họ và tên', { exact: true }).fill('Khách đã sửa');
  await page.getByRole('dialog').getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(page.getByRole('dialog').getByRole('status')).toContainText('Đã lưu');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: /^Khóa / }).click();
  expect(writes.filter((write) => write.method === 'PATCH')).toHaveLength(0);
  await page.getByRole('dialog').getByRole('button', { name: 'Xác nhận trạng thái' }).click();
  await expect.poll(() => writes.filter((write) => write.method === 'PATCH').length).toBe(1);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('Seller shop, owner, status review and history use scoped APIs', async ({ page }) => {
  const { writes, calls } = await setup(page);
  await page.goto('/operations/sellers');
  await page.getByRole('button', { name: /^Chi tiết shop/ }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Sửa thông tin shop' }).click();
  await dialog.getByLabel('Tên shop', { exact: true }).fill('Shop được sửa');
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(dialog.getByRole('status')).toContainText('Đã lưu thông tin shop');
  await dialog.getByRole('button', { name: /^Sửa chủ shop/ }).click();
  await dialog.getByLabel('Họ và tên', { exact: true }).fill('Chủ shop mới');
  await dialog.getByRole('button', { name: 'Lưu thay đổi' }).click();
  await expect(dialog.getByRole('status')).toContainText('Đã lưu thông tin chủ shop');
  await dialog.getByLabel('Lý do thay đổi trạng thái').fill('Đã xác minh vi phạm đóng gói');
  await dialog.getByRole('button', { name: 'Kiểm tra thay đổi trạng thái' }).click();
  expect(writes.filter((write) => write.method === 'PATCH')).toHaveLength(0);
  await dialog.getByRole('button', { name: 'Xác nhận thay đổi shop' }).click();
  await expect(dialog.getByRole('status')).toContainText('Đã cập nhật trạng thái');
  expect(writes.map((write) => write.path)).toContain(
    '/api/operations/sellers/shop/accounts/owner',
  );
  expect(calls.some((call) => call.includes('/status-history?'))).toBe(true);
  expect(calls.some((call) => call.includes('/bank'))).toBe(false);
});

test('Seller history failure is retryable and restore conflict stays visible', async ({ page }) => {
  const { state, shop } = await setup(page);
  state.failHistory = true;
  state.conflict = true;
  shop.status = 'SUSPENDED';
  await page.goto('/operations/sellers');
  await page.getByRole('button', { name: /^Chi tiết shop/ }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('alert')).toContainText('Lỗi lịch sử');
  state.failHistory = false;
  await dialog.getByRole('button', { name: 'Thử lại' }).click();
  await expect(dialog.getByText('Lý do kiểm tra', { exact: true })).toBeVisible();
  await dialog.getByLabel('Lý do thay đổi trạng thái').fill('Đã khắc phục vấn đề');
  await dialog.getByRole('button', { name: 'Kiểm tra thay đổi trạng thái' }).click();
  await dialog.getByRole('button', { name: 'Xác nhận thay đổi shop' }).click();
  await expect(dialog.getByRole('alert')).toContainText('Gói thuê hiện tại không còn hợp lệ');
});

test('Admin directory filters and sensitive profile is fetched again after close', async ({
  page,
}) => {
  const { calls, state } = await setup(page, 'ADMIN');
  await page.goto('/admin/accounts');
  await page.getByLabel('Vai trò', { exact: true }).selectOption('SELLER');
  await expect.poll(() => calls.some((call) => call.includes('role=SELLER'))).toBe(true);
  const opener = page.getByRole('button', { name: /^Hồ sơ / });
  await opener.click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('••••4444', { exact: true })).toBeVisible();
  await expect(dialog.getByText('1111222233334444', { exact: true })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Hiện số tài khoản' }).click();
  await expect(dialog.getByText('1111222233334444', { exact: true })).toBeVisible();
  await expect(dialog.getByText('5555666677778888', { exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await opener.click();
  await expect.poll(() => state.profileReads).toBe(2);
  await expect(dialog.getByText('1111222233334444', { exact: true })).toHaveCount(0);
  expect(
    await page.evaluate(() => JSON.stringify(localStorage) + JSON.stringify(sessionStorage)),
  ).not.toContain('1111222233334444');
});

test('Admin sensitive profile closes when the document becomes hidden', async ({ page }) => {
  await setup(page, 'ADMIN');
  await page.goto('/admin/accounts');
  await page.getByRole('button', { name: /^Hồ sơ / }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Hiện số tài khoản' }).click();
  await expect(dialog.getByText('1111222233334444', { exact: true })).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText('1111222233334444', { exact: true })).toHaveCount(0);
});

test('Admin directory and profile are accessible and fit mobile and desktop', async ({ page }) => {
  await setup(page, 'ADMIN');
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/admin/accounts');
    await expect(page.locator('.platform-management table')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.screenshot({
      path: `artifacts/platform-admin-accounts-${width}.png`,
      fullPage: true,
    });
    await page.getByRole('button', { name: /^Hồ sơ / }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('button', { name: 'Hiện số tài khoản' })).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page.keyboard.press('Escape');
  }
});

test('Clear directory filters restores the first unfiltered server page', async ({ page }) => {
  const { calls } = await setup(page);
  await page.goto('/operations/customers');
  await page.getByLabel('Trạng thái', { exact: true }).selectOption('LOCKED');
  await page.getByLabel('Tìm kiếm', { exact: true }).fill('customer');
  await page.getByRole('button', { name: 'Tìm kiếm', exact: true }).click();
  await expect
    .poll(() =>
      calls.some((call) => call.includes('status=LOCKED') && call.includes('search=customer')),
    )
    .toBe(true);
  await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
  await expect(page.getByLabel('Tìm kiếm', { exact: true })).toHaveValue('');
  await expect(page.getByLabel('Trạng thái', { exact: true })).toHaveValue('');
  await expect(
    page
      .getByRole('navigation', { name: 'Phân trang danh sách', exact: true })
      .getByText('Trang 1', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: 'Chi tiết Tài khoản customer', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Xóa bộ lọc', exact: true })).toHaveCount(0);
});

test('Collapsed platform menu stays compact on mobile', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/operations/customers');
  const menu = page.getByRole('button', { name: 'Mở danh mục quản lý', exact: true });
  await expect(menu).toBeVisible();
  expect(
    await page
      .locator('.workspace-sidebar')
      .evaluate((element) => element.getBoundingClientRect().height),
  ).toBeLessThan(100);
  await menu.click();
  await expect(page.getByRole('link', { name: 'Quản lý shop hoa', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(menu).toBeFocused();
  expect(
    await page
      .locator('.workspace-sidebar')
      .evaluate((element) => element.getBoundingClientRect().height),
  ).toBeLessThan(100);
});

test('Read errors do not appear as an empty customer list', async ({ page }) => {
  const { state } = await setup(page);
  state.failCustomer = true;
  await page.goto('/operations/customers');
  await expect(page.locator('.platform-management').getByRole('alert')).toContainText(
    'Lỗi tải danh sách',
  );
  await expect(page.getByText('Chưa có khách hàng phù hợp với bộ lọc.')).toHaveCount(0);
  state.failCustomer = false;
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(
    page.getByRole('button', { name: 'Chi tiết Tài khoản customer', exact: true }),
  ).toBeVisible();
});

test('Admin cannot invoke Operations customer management', async ({ page }) => {
  const { calls } = await setup(page, 'ADMIN');
  await page.goto('/operations/customers');
  await expect(
    page.getByText('Các thao tác điều phối và quản lý kỹ thuật viên dành cho Quản lý vận hành.', {
      exact: false,
    }),
  ).toBeVisible();
  expect(calls.some((call) => call.includes('/api/operations/customers'))).toBe(false);
});

test('Technician installation detail and evidence errors block actions until retried', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  const { state, writes } = await setup(page, 'TECHNICIAN');
  state.failTechDetail = true;
  state.evidenceError = true;
  await page.goto('/technician/installations');
  await expect(page.getByRole('button', { name: 'Tải lại chi tiết lắp đặt' })).toBeVisible();
  await expect(page.getByRole('button', { name: /Bắt đầu khảo sát/ })).toHaveCount(0);
  state.failTechDetail = false;
  await page.getByRole('button', { name: 'Tải lại chi tiết lắp đặt' }).click();
  await page.getByRole('button', { name: /Bắt đầu khảo sát/ }).click();
  const submit = page.getByRole('button', { name: /Nộp báo cáo hoàn thành/ });
  await expect(submit).toBeDisabled();
  state.evidenceError = false;
  await page.getByRole('button', { name: 'Tải lại minh chứng' }).click();
  await expect(submit).toBeEnabled();
  await expect(
    page.getByRole('list', { name: 'Tiến độ lắp đặt' }).locator('[aria-current="step"]'),
  ).toContainText('Thực hiện');
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      width,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: 'artifacts/platform-technician-workflow-1440.png',
    fullPage: true,
  });
  await page.getByLabel('Nội dung báo cáo chi tiết:').fill('Ngắn');
  await submit.click();
  await expect(page.getByRole('region', { name: 'Hoa Bình An' }).getByRole('alert')).toContainText(
    'ít nhất 10 ký tự',
  );
  expect(writes.some((write) => write.path.endsWith('/submit'))).toBe(false);
  await page
    .getByLabel('Nội dung báo cáo chi tiết:')
    .fill('Đã lắp đặt và kiểm tra đầy đủ thiết bị tại hiện trường');
  await submit.click();
  await expect(page.getByText('Đã nộp báo cáo thành công!', { exact: true })).toBeVisible();
});

test('New platform directories reflow and pass accessibility from 320 to 1440', async ({
  page,
}) => {
  await setup(page);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const url of ['/operations/customers', '/operations/sellers']) {
      await page.goto(url);
      await expect(page.locator('.platform-management table')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(axe.violations).toEqual([]);
      await page.screenshot({
        path: `artifacts/platform-${url.split('/').pop()}-${width}.png`,
        fullPage: true,
      });
    }
  }
});

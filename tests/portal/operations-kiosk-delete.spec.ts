import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const targetId = '10000000-0000-0000-0000-000000000001';
const targetCode = 'K-DELETE-TEST';
const stock = [
  { id: targetId, code: targetCode, name: 'Tủ kiểm thử xóa', slotCount: 2, status: 'OFFLINE' },
  {
    id: '10000000-0000-0000-0000-000000000002',
    code: 'K-ONLINE-TEST',
    name: 'Tủ đã kết nối',
    slotCount: 2,
    status: 'ONLINE',
  },
];

async function setup(page: Page, role = 'OPERATIONS_MANAGER') {
  let releaseDelete = () => {};
  const gate = new Promise<void>((resolve) => {
    releaseDelete = resolve;
  });
  const model = {
    items: [...stock],
    status: 204,
    hold: false,
    release: () => releaseDelete(),
    eligibleReads: 0,
    deleteCalls: [] as { path: string; body: string | null }[],
  };
  const application = {
    id: 'app-delete-test',
    customerId: 'customer-delete-test',
    packageId: 'trial-delete-test',
    shopName: 'Shop kiểm thử phân công',
    packageName: 'Trial',
    totalSlots: 2,
    annualFee: 10000,
    phone: '0901234567',
    contactEmail: 'delete@example.test',
    installationAddress: 'Địa chỉ kiểm thử',
    latitude: 10.7,
    longitude: 106.7,
    bankName: 'Test Bank',
    bankHolder: 'TEST HOLDER',
    bankAccountSuffix: '1234',
    status: 'CONFIRMED',
    assignedTechnicianId: null,
    assignedKioskId: null,
    scheduledDate: null,
    timeWindow: null,
    createdAt: '2026-10-31T00:00:00Z',
    updatedAt: '2026-10-31T00:00:00Z',
  };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (path === '/api/auth/me')
      return route.fulfill({
        json: {
          id: 'manager-delete-test',
          name: 'Nhân sự kiểm thử',
          role,
          sellerId: null,
          sellerStatus: null,
          packageExpiresAt: null,
        },
      });
    if (path === '/api/operations/eligible-kiosks') {
      model.eligibleReads++;
      return route.fulfill({ json: model.items });
    }
    if (path === '/api/operations/kiosk-applications')
      return route.fulfill({ json: { items: [application], page: 1, hasMore: false } });
    if (path === '/api/operations/kiosk-applications/app-delete-test')
      return route.fulfill({ json: { application, evidencePhotos: [] } });
    if (path === '/api/operations/technicians')
      return route.fulfill({
        json: [
          {
            id: 'tech-delete-test',
            fullName: 'Kỹ thuật viên kiểm thử',
            email: 'tech@example.test',
            status: 'ACTIVE',
            role: 'TECHNICIAN',
          },
        ],
      });
    if (path === `/api/operations/kiosks/${targetId}` && request.method() === 'DELETE') {
      model.deleteCalls.push({ path, body: request.postData() });
      if (model.hold) await gate;
      if (model.status === 0) return route.abort('connectionreset');
      if (model.status === 204 || model.status === 404)
        model.items = model.items.filter((item) => item.id !== targetId);
      if (model.status === 204) return route.fulfill({ status: 204 });
      return route.fulfill({
        status: model.status,
        json: {
          detail:
            model.status === 409
              ? 'Kiosk đã có hồ sơ hoặc dữ liệu liên quan; không thể xóa để bảo toàn lịch sử.'
              : 'Yêu cầu kiểm thử bị từ chối.',
        },
      });
    }
    return route.fulfill({ status: request.method() === 'GET' ? 200 : 405, json: [] });
  });
  return model;
}

async function openInventory(page: Page) {
  await page.getByRole('button', { name: 'Kho tủ khả dụng' }).click();
  return page.getByRole('dialog', { name: 'Kho thiết bị Kiosk khả dụng' });
}
async function confirmDialog(page: Page) {
  await page.getByRole('button', { name: `Xóa tủ ${targetCode}`, exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Xóa tủ khỏi kho?' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('dialog')).toHaveCount(1);
  return dialog;
}

for (const width of [390, 1440]) {
  test(`Manager confirms one DELETE, handles 204 and refreshes inventory at ${width}px`, async ({
    page,
  }) => {
    const model = await setup(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/operations/installations');
    const inventory = await openInventory(page);
    await expect(
      inventory.getByRole('button', { name: 'Xóa tủ K-ONLINE-TEST', exact: true }),
    ).toBeDisabled();
    await page.screenshot({
      path: `artifacts/kiosk-delete-inventory-${width}.png`,
      fullPage: false,
    });
    let dialog = await confirmDialog(page);
    await expect(dialog.getByRole('button', { name: 'Hủy', exact: true })).toBeFocused();
    await expect(dialog).toContainText(targetCode);
    await expect(dialog).toContainText('Thao tác này không thể hoàn tác.');
    await page.keyboard.press('Escape');
    await expect(
      inventory.getByRole('button', { name: `Xóa tủ ${targetCode}`, exact: true }),
    ).toBeFocused();
    expect(model.deleteCalls).toEqual([]);
    dialog = await confirmDialog(page);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `artifacts/kiosk-delete-confirmation-${width}.png`,
      fullPage: true,
    });
    model.hold = true;
    await dialog.getByRole('button', { name: 'Xác nhận xóa tủ', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Đang xóa...', exact: true })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Hủy', exact: true })).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeVisible();
    expect(model.deleteCalls).toEqual([{ path: `/api/operations/kiosks/${targetId}`, body: null }]);
    model.release();
    await expect(inventory).toBeVisible();
    await expect(
      inventory.getByRole('status').filter({ hasText: `Đã xóa tủ ${targetCode}` }),
    ).toBeVisible();
    await expect(inventory.getByText('1 tủ khả dụng', { exact: true })).toBeVisible();
    await expect(
      inventory.getByRole('button', { name: `Xóa tủ ${targetCode}`, exact: true }),
    ).toHaveCount(0);
    await expect.poll(() => model.eligibleReads).toBeGreaterThan(1);
    expect(model.deleteCalls).toHaveLength(1);
  });
}

for (const status of [401, 403, 409, 500, 0]) {
  test(`Delete failure ${status} keeps the kiosk and reports the error without success`, async ({
    page,
  }) => {
    const model = await setup(page);
    model.status = status;
    await page.goto('/operations/installations');
    const inventory = await openInventory(page);
    const dialog = await confirmDialog(page);
    await dialog.getByRole('button', { name: 'Xác nhận xóa tủ', exact: true }).click();
    const message =
      status === 401
        ? 'Phiên đăng nhập đã hết hạn.'
        : status === 403
          ? 'Bạn không có quyền xóa kiosk.'
          : status === 409
            ? 'Kiosk đã có hồ sơ hoặc dữ liệu liên quan'
            : status === 0
              ? 'Chưa xác nhận được kết quả xóa.'
              : 'Yêu cầu kiểm thử bị từ chối.';
    await expect(dialog.getByRole('alert')).toContainText(message);
    await expect(
      dialog.getByRole('button', { name: 'Xác nhận xóa tủ', exact: true }),
    ).toBeEnabled();
    await dialog.getByRole('button', { name: 'Hủy', exact: true }).click();
    await expect(inventory.getByText(targetCode, { exact: true })).toBeVisible();
    await expect(inventory.getByRole('status').filter({ hasText: 'Đã xóa tủ' })).toHaveCount(0);
    expect(model.deleteCalls).toHaveLength(1);
  });
}

test('404 removes an obsolete kiosk without claiming a successful deletion', async ({ page }) => {
  const model = await setup(page);
  model.status = 404;
  await page.goto('/operations/installations');
  const inventory = await openInventory(page);
  const dialog = await confirmDialog(page);
  await dialog.getByRole('button', { name: 'Xác nhận xóa tủ', exact: true }).click();
  await expect(dialog.getByRole('alert')).toContainText('Tủ không còn tồn tại.');
  await expect(dialog.getByRole('button', { name: 'Xác nhận xóa tủ', exact: true })).toBeDisabled();
  await dialog.getByRole('button', { name: 'Quay lại kho', exact: true }).click();
  await expect(inventory.getByText(targetCode, { exact: true })).toHaveCount(0);
  await expect(inventory.getByRole('status').filter({ hasText: 'Đã xóa tủ' })).toHaveCount(0);
});

test('Deleting a selected kiosk also clears its schedule option and prevents stale scheduling', async ({
  page,
}) => {
  const model = await setup(page);
  await page.goto('/operations/installations?application=app-delete-test');
  const select = page.getByLabel('Tủ kiosk cấp phát', { exact: true });
  await select.selectOption(targetId);
  await expect(select).toHaveValue(targetId);
  const inventory = await openInventory(page);
  const dialog = await confirmDialog(page);
  await dialog.getByRole('button', { name: 'Xác nhận xóa tủ', exact: true }).click();
  await expect(inventory).toBeVisible();
  await inventory.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(select).toHaveValue('');
  await expect(select.getByRole('option', { name: new RegExp(targetCode) })).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: 'Lưu lịch & Phân công', exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByText('Tủ đã chọn không còn khả dụng. Vui lòng chọn lại tủ trước khi lưu.'),
  ).toBeVisible();
  expect(model.deleteCalls).toHaveLength(1);
});

test('Admin cannot access kiosk inventory or delete controls', async ({ page }) => {
  const model = await setup(page, 'ADMIN');
  await page.goto('/admin/installations');
  await expect(page.getByText('Chế độ giám sát (Admin)', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Kho tủ khả dụng' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Xóa tủ/ })).toHaveCount(0);
  expect(model.eligibleReads).toBe(0);
  expect(model.deleteCalls).toEqual([]);
});

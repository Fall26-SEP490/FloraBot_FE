import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function setup(page: Page) {
  const model = {
    complaintsUnavailable: true,
    slotsUnavailable: true,
    slotReads: 0,
    writes: [] as string[],
  };
  const application = {
    id: 'test-lease-101',
    customerId: 'test-customer-101',
    packageId: 'test-package-101',
    packageName: 'Trial',
    annualFee: 10000,
    totalSlots: 2,
    shopName: 'Shop đăng ký kiosk mới',
    phone: '0901234567',
    contactEmail: 'lease@example.test',
    installationAddress: 'Địa chỉ kiểm thử',
    latitude: 10.78,
    longitude: 106.69,
    bankName: 'Test Bank',
    bankHolder: 'TEST HOLDER',
    bankAccountSuffix: '1234',
    status: 'PAID_REVIEW',
    reviewNote: null,
    createdAt: '2026-10-31T01:00:00Z',
    updatedAt: '2026-10-31T01:00:00Z',
  };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;
    if (request.method() !== 'GET') {
      model.writes.push(path);
      return route.fulfill({ status: 405, json: {} });
    }
    if (path === '/api/auth/me')
      return route.fulfill({
        json: {
          id: 'test-admin-101',
          name: 'Admin kiểm thử',
          role: 'ADMIN',
          sellerId: null,
          sellerStatus: null,
          packageExpiresAt: null,
        },
      });
    if (path === '/api/operations/kiosk-applications')
      return route.fulfill({ json: { items: [application], page: 1, hasMore: false } });
    if (path === '/api/operations/kiosk-applications/test-lease-101')
      return route.fulfill({ json: { application, evidencePhotos: [] } });
    if (path === '/api/admin/sellers')
      return route.fulfill({
        json: [
          {
            id: 'test-seller-old',
            shopName: 'Shop có sẵn trong hệ thống',
            phone: '0901234567',
            address: 'Địa chỉ shop',
            status: 'ACTIVE',
            packageId: null,
            packageExpiresAt: null,
          },
        ],
      });
    if (path === '/api/admin/complaints' && model.complaintsUnavailable)
      return route.fulfill({ status: 503, json: { detail: 'Unavailable' } });
    if (path === '/api/admin/kiosks')
      return route.fulfill({
        json: [
          {
            id: 'test-kiosk-101',
            code: 'K-TEST-101',
            name: 'Tủ kiểm thử',
            status: 'OFFLINE',
            sellerId: null,
            sellerName: null,
            slotCount: 2,
          },
        ],
      });
    if (path === '/api/admin/slots') {
      model.slotReads++;
      if (model.slotsUnavailable) return route.fulfill({ status: 503, json: {} });
      return route.fulfill({
        json: [
          {
            id: 'slot-a',
            kioskId: 'test-kiosk-101',
            slotCode: 'W01',
            status: 'EMPTY',
            zone: 'WALK_IN',
            currentSellerId: null,
            bouquetId: null,
            kioskCode: 'K-TEST-101',
            kioskName: 'Tủ kiểm thử',
            kioskAddress: 'Địa chỉ',
            kioskStatus: 'OFFLINE',
          },
          {
            id: 'slot-b',
            kioskId: 'test-kiosk-101',
            slotCode: 'P01',
            status: 'EMPTY',
            zone: null,
            currentSellerId: null,
            bouquetId: null,
            kioskCode: 'K-TEST-101',
            kioskName: 'Tủ kiểm thử',
            kioskAddress: 'Địa chỉ',
            kioskStatus: 'OFFLINE',
          },
          {
            id: 'slot-other',
            kioskId: 'other-kiosk',
            slotCode: 'OTHER-99',
            status: 'EMPTY',
            zone: null,
          },
        ],
      });
    }
    if (path === '/api/packages') return route.fulfill({ json: [] });
    if (path === '/api/admin/kiosk-applications/refunds') return route.fulfill({ json: [] });
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  return model;
}

for (const width of [390, 1440]) {
  test(`Admin approval center isolates queue failures and opens read-only leases at ${width}`, async ({
    page,
  }) => {
    const model = await setup(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/admin/approvals');
    await expect(page.getByRole('heading', { name: 'Trung tâm duyệt', exact: true })).toBeVisible();
    const complaints = page.getByRole('article', { name: 'Phản ánh của khách', exact: true });
    await expect(complaints.getByRole('alert')).toContainText('Chưa tải được hàng đợi này.');
    await expect(complaints).not.toContainText('0 yêu cầu đang hiển thị');
    const leases = page.getByRole('article', { name: 'Hồ sơ thuê kiosk mới', exact: true });
    await expect(leases).toContainText('1 yêu cầu đang hiển thị');
    await expect(leases).toContainText('Manager');
    model.complaintsUnavailable = false;
    await complaints
      .getByRole('button', { name: 'Thử lại phản ánh của khách', exact: true })
      .click();
    await expect(complaints).toContainText('0 yêu cầu đang hiển thị');
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await leases.getByRole('link', { name: 'Xem giám sát hồ sơ thuê' }).click();
    await expect(page).toHaveURL(/\/admin\/installations$/);
    await expect(page.getByText('Chế độ giám sát (Admin)', { exact: true })).toBeVisible();
    expect(
      await page
        .getByRole('button', { name: 'Chờ xác nhận', exact: true })
        .evaluate((button) => button.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
    await page.getByLabel('Lọc theo trạng thái:', { exact: true }).selectOption('PAID_REVIEW');
    await page.getByRole('button', { name: 'Chi tiết', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Chi tiết: Shop đăng ký kiosk mới', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', {
        name: /Xác nhận liên hệ|Lưu lịch & Phân công|Nghiệm thu Đạt|Thêm tủ mới/,
      }),
    ).toHaveCount(0);
    expect(model.writes).toEqual([]);
  });

  test(`Admin kiosk slot API loads on demand, retries, and filters by kiosk at ${width}`, async ({
    page,
  }) => {
    const model = await setup(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/admin/slots');
    await page.locator('.admin-slots summary').click();
    expect(model.slotReads).toBe(0);
    await page.getByRole('button', { name: 'Xem các ô tủ', exact: true }).click();
    await expect(page.getByText('Chưa tải được các ô của kiosk.', { exact: true })).toBeVisible();
    model.slotsUnavailable = false;
    await page.getByRole('button', { name: 'Tải lại các ô tủ', exact: true }).click();
    const slots = page.getByRole('region', { name: 'Các ô của kiosk K-TEST-101', exact: true });
    await expect(slots.getByText('W01', { exact: true })).toBeVisible();
    await expect(slots.getByText('P01', { exact: true })).toBeVisible();
    await expect(slots).toContainText('Mua tại tủ');
    await expect(slots).toContainText('Chưa phân loại');
    await expect(slots).not.toContainText('OTHER-99');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(model.writes).toEqual([]);
  });
}

test('Admin shops distinguish existing sellers from new Customer lease applications', async ({
  page,
}) => {
  await setup(page);
  await page.goto('/admin/shops');
  await expect(page.getByLabel('Lọc trạng thái shop')).toHaveValue('');
  await expect(page.getByText('Shop có sẵn trong hệ thống', { exact: true })).toBeVisible();
  await page
    .locator('.admin-sellers')
    .getByRole('link', { name: 'Hồ sơ thuê kiosk', exact: true })
    .click();
  await expect(page).toHaveURL(/\/admin\/installations$/);
  await expect(page.getByText('Shop đăng ký kiosk mới', { exact: true })).toBeVisible();
});

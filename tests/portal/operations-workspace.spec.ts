import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const application = {
  id: 'app-operations',
  customerId: 'customer-1',
  packageId: 'package-1',
  packageName: 'Trial',
  annualFee: 10000,
  walkInSlots: 1,
  preorderSlots: 1,
  totalSlots: 2,
  shopName: 'Hoa Nhà Mình',
  phone: '0901234567',
  contactEmail: 'shop@example.test',
  installationAddress: '12 Nguyễn Huệ, TP. Hồ Chí Minh',
  latitude: 10.77,
  longitude: 106.7,
  bankName: 'MB',
  bankHolder: 'NGUYEN AN',
  bankAccountSuffix: '1234',
  status: 'SCHEDULED',
  assignedTechnicianId: 'tech-1',
  assignedTechnicianName: 'Minh Kỹ Thuật',
  assignedKioskId: 'kiosk-1',
  assignedKioskCode: 'K-HCM-01',
  scheduledDate: '2026-11-10T08:30:00Z',
  timeWindow: '10:00 - 12:00',
  createdAt: '2026-10-20T08:00:00Z',
  updatedAt: '2026-10-20T08:00:00Z',
  technicianReport: null,
};

async function setup(
  page: Page,
  options: {
    role?: string;
    detailError?: boolean;
    noEvidence?: boolean;
    overviewError?: boolean;
  } = {},
) {
  const writes: { path: string; body: Record<string, unknown> }[] = [];
  let failDetail = !!options.detailError;
  let failOverview = !!options.overviewError;
  await page.route('**/api/**', async (route) => {
    const { pathname: path, searchParams } = new URL(route.request().url());
    const post = route.request().method() === 'POST';
    if (path === '/api/auth/me')
      return route.fulfill({
        json: {
          id: 'manager-1',
          name: 'An Điều Phối',
          role: options.role ?? 'OPERATIONS_MANAGER',
          sellerId: null,
          sellerStatus: null,
          packageExpiresAt: null,
        },
      });
    if (path === '/api/operations/kiosk-applications' && !post) {
      if (failOverview) {
        failOverview = false;
        return route.fulfill({ status: 503, json: { detail: 'Tạm ngưng' } });
      }
      return route.fulfill({
        json: { items: searchParams.get('status') ? [] : [application], page: 1, hasMore: false },
      });
    }
    if (path === `/api/operations/kiosk-applications/${application.id}`) {
      if (failDetail) {
        failDetail = false;
        return route.fulfill({ status: 503, json: { detail: 'Hồ sơ tạm thời chưa sẵn sàng' } });
      }
      return route.fulfill({
        json: {
          application: options.noEvidence
            ? { ...application, status: 'AWAITING_HANDOVER', technicianReport: 'Lắp đặt hoàn tất' }
            : application,
          evidencePhotos: [],
        },
      });
    }
    if (path === '/api/operations/technicians')
      return route.fulfill({
        json: [
          {
            id: 'tech-1',
            fullName: 'Minh Kỹ Thuật',
            email: 'tech@example.test',
            phone: '0901234568',
            status: 'ACTIVE',
            role: 'TECHNICIAN',
          },
        ],
      });
    if (path === '/api/operations/eligible-kiosks') return route.fulfill({ json: [] });
    if (path === '/api/operations/staff-tasks')
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    if (path === '/api/operations/staff') return route.fulfill({ json: [] });
    if (path === '/api/operations/incidents')
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    if (post) {
      const data = route.request().postData();
      writes.push({ path, body: data ? route.request().postDataJSON() : {} });
      if (path.includes('/provision-key')) {
        return route.fulfill({
          json: { kioskId: 'kiosk-1', apiKey: 'test-reprovisioned-key-xyz' },
        });
      }
      return route.fulfill({ json: application });
    }
    return route.fulfill({ json: [] });
  });
  return writes;
}

test('Overview uses backend data, recovers failed reads and opens the correct application', async ({
  page,
}) => {
  const writes = await setup(page, { overviewError: true });
  await page.goto('/operations');
  await expect(page.getByRole('heading', { level: 1, name: 'Tổng quan vận hành' })).toBeVisible();
  await expect(page.getByText('Chưa tải được hồ sơ. Hãy thử làm mới.')).toBeVisible();
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await page.getByRole('link').filter({ hasText: 'Hoa Nhà Mình' }).click();
  await expect(page.getByRole('heading', { name: 'Chi tiết: Hoa Nhà Mình' })).toBeVisible();
  expect(writes).toEqual([]);
});

test('Rescheduling preserves the reserved kiosk and validates the time window before POST', async ({
  page,
}) => {
  const writes = await setup(page);
  await page.goto(`/operations/installations?application=${application.id}`);
  await expect(page.locator('.operations-detail-progress li[aria-current="step"]')).toContainText(
    'Xếp lịch lắp đặt',
  );
  await expect(page.getByLabel('Tủ kiosk cấp phát')).toHaveValue('kiosk-1');
  await expect(page.getByLabel('Kỹ thuật viên phụ trách')).toHaveValue('tech-1');
  await expect(page.getByLabel('Ngày dự kiến lắp đặt')).toHaveValue('2026-11-10');
  const time = page.getByLabel('Khung giờ');
  await expect(time).toHaveValue('10:00 - 12:00');
  await time.fill('12:00 - 09:00');
  await page.getByRole('button', { name: 'Lưu lịch & Phân công' }).click();
  await expect(page.locator('main').getByRole('alert')).toContainText('giờ kết thúc phải sau');
  expect(writes).toHaveLength(0);
  await time.fill('13:00 - 15:00');
  await page.getByRole('button', { name: 'Lưu lịch & Phân công' }).click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toEqual({
    path: `/api/operations/kiosk-applications/${application.id}/schedule`,
    body: {
      technicianId: 'tech-1',
      kioskId: 'kiosk-1',
      scheduledDate: '2026-11-10',
      timeWindow: '13:00 - 15:00',
    },
  });

  // Re-provisioning API key displays real kiosk code (K-HCM-01) from assignedKioskCode
  page.on('dialog', (dialog) => dialog.accept());
  await page.getByText('Thiết bị và khóa kết nối', { exact: true }).click();
  await page.getByRole('button', { name: 'Cấp lại khóa API' }).click();
  await expect(page.getByText('Cấu hình khóa thiết bị Kiosk (API Key)')).toBeVisible();
  await expect(page.locator('.provision-field-row strong')).toHaveText('K-HCM-01');
  await page.getByRole('button', { name: 'Tôi đã sao chép khóa - Đóng bảng này' }).click();
  await expect(page.getByText('Cấu hình khóa thiết bị Kiosk (API Key)')).not.toBeVisible();
});

test('Detail failure is recoverable and handover requires evidence', async ({ page }) => {
  const writes = await setup(page, { detailError: true, noEvidence: true });
  await page.goto(`/operations/installations?application=${application.id}`);
  await expect(page.locator('main').getByRole('alert')).toContainText(
    'Hồ sơ tạm thời chưa sẵn sàng',
  );
  await page.getByRole('button', { name: 'Thử lại chi tiết' }).click();
  await expect(
    page.getByRole('button', { name: 'Nghiệm thu Đạt & Bàn giao Kiosk' }),
  ).toBeDisabled();
  expect(writes).toEqual([]);
});

test('Admin can inspect applications without manager mutations or directory queries', async ({
  page,
}) => {
  const requests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/operations/')) requests.push(new URL(request.url()).pathname);
  });
  const writes = await setup(page, { role: 'ADMIN' });
  await page.goto(`/operations/installations?application=${application.id}`);
  await expect(page.getByText('Chế độ giám sát (Admin)')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Lưu lịch & Phân công' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Thêm tủ mới', exact: true })).toHaveCount(0);
  expect(requests).not.toContain('/api/operations/technicians');
  expect(requests).not.toContain('/api/operations/eligible-kiosks');
  expect(writes).toEqual([]);
});

for (const width of [390, 1440]) {
  test(`Operations overview and installation form reflow and accessibility at ${width}px`, async ({
    page,
  }) => {
    await setup(page);
    await page.setViewportSize({ width, height: 1000 });
    for (const path of ['/operations', `/operations/installations?application=${application.id}`]) {
      await page.goto(path);
      await expect(page.locator('h1')).toHaveCount(1);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
      if (path.includes('installations')) await expect(page.getByLabel('Khung giờ')).toBeVisible();
      else await expect(page.getByText('Hoa Nhà Mình')).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const audit = await new AxeBuilder({ page }).analyze();
      expect(audit.violations).toEqual([]);
      await page.screenshot({
        path: `artifacts/operations-${path.includes('installations') ? 'installations' : 'overview'}-${width}.png`,
        fullPage: true,
      });
    }
  });
}

test('Enrollment modal traps focus and restores it on Escape without writing data', async ({
  page,
}) => {
  const writes = await setup(page);
  await page.route('**/api/operations/kiosk-applications/app-operations', (route) =>
    route.fulfill({
      json: { application: { ...application, status: 'CONFIRMED' }, evidencePhotos: [] },
    }),
  );
  await page.goto('/operations/installations?application=app-operations');
  const trigger = page.getByRole('button', { name: '+ Tạo tủ theo hồ sơ', exact: true });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Đăng ký thiết bị kiosk mới' });
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(writes).toEqual([]);
});

for (const width of [390, 1440]) {
  test(`Kiosk inventory filters, reflows and returns focus without writes at ${width}px`, async ({
    page,
  }) => {
    const writes = await setup(page);
    await page.route('**/api/operations/eligible-kiosks', (route) =>
      route.fulfill({
        json: [
          {
            id: 'stock-1',
            code: 'K-TRIAL-01',
            name: 'Tủ thử nghiệm',
            slotCount: 2,
            status: 'OFFLINE',
          },
          {
            id: 'stock-2',
            code: 'K-PRO-01',
            name: 'Tủ cửa hàng trung tâm',
            slotCount: 8,
            status: 'ONLINE',
          },
        ],
      }),
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/operations/installations');
    const trigger = page.getByRole('button', { name: 'Kho tủ khả dụng' });
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'Kho thiết bị Kiosk khả dụng' });
    await expect(dialog.getByText('2 tủ khả dụng', { exact: true })).toBeVisible();
    await expect(dialog.getByText('OFFLINE', { exact: true })).toBeVisible();
    await dialog.getByLabel('Quy mô ô', { exact: true }).selectOption('8');
    await expect(dialog.getByText('K-PRO-01', { exact: true })).toBeVisible();
    await expect(dialog.getByText('K-TRIAL-01', { exact: true })).toHaveCount(0);
    await dialog.getByLabel('Tìm thiết bị').fill('không có thiết bị này');
    await expect(dialog.getByRole('heading', { name: 'Không tìm thấy tủ phù hợp' })).toBeVisible();
    await dialog.getByRole('button', { name: 'Xóa bộ lọc' }).click();
    await expect(dialog.getByText('K-TRIAL-01', { exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const bounds = await dialog.boundingBox();
    expect(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width).toBe(true);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({
      path: `artifacts/installation-inventory-${width}.png`,
      fullPage: true,
    });
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(trigger).toBeFocused();
    expect(writes).toEqual([]);
  });
}

test('Manager reviews location and slot layout using their distinct backend contracts', async ({
  page,
}) => {
  await setup(page);
  const kioskId = 'kiosk-1';
  const slotId = '40000000-0000-0000-0000-000000000031';
  const requestDetails = { id: 'request-1', kioskId, reason: 'Cập nhật theo yêu cầu của shop' };
  let locationReviewed = false;
  let layoutReviewed = false;
  await page.route('**/api/operations/kiosk-termination-requests?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/operations/kiosk-location-requests?*', (route) => {
    const status = new URL(route.request().url()).searchParams.get('status');
    if (status !== 'REQUESTED') return route.fulfill({ status: 400, json: {} });
    return route.fulfill({
      json: locationReviewed
        ? []
        : [
            {
              ...requestDetails,
              status: 'REQUESTED',
              address: '21 Nguyễn Huệ',
              latitude: 10.77,
              longitude: 106.7,
            },
          ],
    });
  });
  await page.route('**/api/operations/kiosk-location-requests/request-1/review', (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({
      decision: 'REJECTED',
      note: 'Thiếu xác nhận địa chỉ',
    });
    locationReviewed = true;
    return route.fulfill({ json: { ...requestDetails, status: 'REJECTED' } });
  });
  await page.route('**/api/operations/kiosk-layout-requests?*', (route) => {
    expect(new URL(route.request().url()).searchParams.get('status')).toBe('PENDING');
    return route.fulfill({
      json: layoutReviewed
        ? []
        : [
            {
              ...requestDetails,
              status: 'PENDING',
              walkInSlots: 1,
              preorderSlots: 1,
            },
          ],
    });
  });
  await page.route('**/api/kiosks/kiosk-1/flower-presence', (route) =>
    route.fulfill({
      json: {
        slots: [
          { slotId, slotCode: 'A01' },
          { slotId: '40000000-0000-0000-0000-000000000032', slotCode: 'A02' },
        ],
      },
    }),
  );
  await page.route('**/api/operations/kiosk-layout-requests/request-1/review', (route) => {
    expect(route.request().postDataJSON()).toEqual({ preorderSlotIds: [slotId], note: null });
    layoutReviewed = true;
    return route.fulfill({ json: { status: 'APPROVED' } });
  });

  await page.goto('/operations/terminations');
  await page.getByText('Yêu cầu đổi vị trí kiosk chờ duyệt', { exact: true }).click();
  await expect(page.getByText('21 Nguyễn Huệ')).toBeVisible();
  const rejectLocation = page.getByRole('button', { name: 'Từ chối', exact: true });
  await expect(rejectLocation).toBeDisabled();
  await page.getByLabel(/Ghi chú xem xét \(lý do từ chối/).fill('Thiếu xác nhận địa chỉ');
  await rejectLocation.click();
  await expect(page.getByText('Không có yêu cầu đổi vị trí kiosk đang chờ duyệt.')).toBeVisible();

  await page
    .getByText('Yêu cầu đổi cơ cấu ô (Walk-in / Pre-order) chờ duyệt', { exact: true })
    .click();
  const approveLayout = page.getByRole('button', { name: 'Duyệt đổi cơ cấu ô' });
  await expect(approveLayout).toBeDisabled();
  await page.getByRole('checkbox', { name: 'Ô A01' }).check();
  await expect(page.getByRole('checkbox', { name: 'Ô A02' })).toBeDisabled();
  await approveLayout.click();
  await expect(page.getByText('Không có yêu cầu đổi cơ cấu ô đang chờ duyệt.')).toBeVisible();
});

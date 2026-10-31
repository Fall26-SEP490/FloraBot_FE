import { expect, test, type Page } from '@playwright/test';

const appId = 'test-installation-101';
const techId = 'test-technician-101';
const photo = {
  name: 'test-installation.png',
  mimeType: 'image/png',
  buffer: Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  ),
};

async function installationFixture(page: Page, initialStatus = 'SCHEDULED') {
  const model = {
    role: 'TECHNICIAN',
    status: initialStatus,
    report: '',
    customerRole: 'CUSTOMER',
    photos: [] as { id: string; createdAt: string }[],
    writes: [] as { role: string; path: string }[],
    attachIds: [] as string[],
    uploadCount: 0,
    attachFailures: 0,
    loseAttachResponse: false,
    evidenceReadFailure: false,
    denySubmit: false,
    denyList: false,
    denyDetail: false,
    loginBody: null as Record<string, string> | null,
  };
  const job = () => ({
    id: appId,
    shopName: 'Shop Hoa Kiểm Thử',
    phone: '0901234567',
    contactEmail: 'installation@example.test',
    installationAddress: 'Địa chỉ lắp đặt kiểm thử',
    latitude: 10.78,
    longitude: 106.69,
    kioskId: 'test-kiosk-101',
    kioskCode: 'K-TEST-101',
    scheduledDate: '2026-11-02',
    timeWindow: '09:00 - 12:00',
    status: model.status,
    technicianReport: model.report || null,
    reworkReason: null,
    evidence: model.photos,
  });
  const application = () => ({
    ...job(),
    customerId: 'test-customer-101',
    packageId: 'test-package-trial',
    packageName: 'Trial',
    annualFee: 10000,
    totalSlots: 2,
    assignedTechnicianId: techId,
    assignedTechnicianName: 'Kỹ thuật viên kiểm thử',
    assignedKioskId: 'test-kiosk-101',
    assignedKioskCode: 'K-TEST-101',
    bankName: 'Ngân hàng kiểm thử',
    bankHolder: 'TEST ACCOUNT',
    bankAccountSuffix: '1234',
    createdAt: '2026-10-30T08:00:00Z',
    updatedAt: '2026-10-30T08:00:00Z',
  });
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    const method = request.method();
    if (method !== 'GET') model.writes.push({ role: model.role, path });
    const session = {
      id: model.role === 'TECHNICIAN' ? techId : 'test-manager-101',
      role: model.role,
      name: 'Nhân sự kiểm thử',
      sellerId: null,
      sellerStatus: null,
      packageExpiresAt: null,
    };
    if (path === '/api/auth/me') return route.fulfill({ json: session });
    if (path === '/api/auth/admin/login') {
      model.loginBody = request.postDataJSON();
      return route.fulfill({ json: session });
    }
    if (path.startsWith('/api/staff/kiosk-installations')) {
      if (model.denyList || model.role !== 'TECHNICIAN') {
        return route.fulfill({ status: 403, json: { detail: 'Forbidden' } });
      }
      if (path === '/api/staff/kiosk-installations') return route.fulfill({ json: [job()] });
      if (model.denyDetail) return route.fulfill({ status: 404, json: {} });
      if (path.endsWith('/evidence/upload')) {
        model.uploadCount++;
        expect(request.headers()['content-type']).toBe('image/png');
        return route.fulfill({
          json: {
            reference: 'evidence:v1:test-photo-ticket',
            expiresAt: new Date(Date.now() + 3600000).toISOString(),
          },
        });
      }
      if (path.endsWith('/evidence')) {
        if (method === 'GET')
          return model.evidenceReadFailure
            ? route.fulfill({ status: 503, json: { detail: 'Evidence unavailable' } })
            : route.fulfill({ json: model.photos });
        const body = request.postDataJSON();
        expect(body.reference).toBe('evidence:v1:test-photo-ticket');
        model.attachIds.push(body.id);
        if (model.attachFailures > 0) {
          model.attachFailures--;
          return route.fulfill({ status: 503, json: { detail: 'Đính kèm tạm thời gián đoạn.' } });
        }
        const item = { id: body.id, createdAt: new Date().toISOString() };
        model.photos.push(item);
        if (model.loseAttachResponse) {
          model.loseAttachResponse = false;
          return route.abort('connectionreset');
        }
        return route.fulfill({ json: item });
      }
      if (path.includes('/evidence/'))
        return route.fulfill({ contentType: 'image/png', body: photo.buffer });
      if (path.endsWith('/start')) {
        expect(model.status).toBe('SCHEDULED');
        model.status = 'INSTALLING';
        return route.fulfill({ json: job() });
      }
      if (path.endsWith('/submit')) {
        if (model.denySubmit)
          return route.fulfill({ status: 403, json: { detail: 'Wrong technician' } });
        expect(model.status).toBe('INSTALLING');
        expect(model.photos.length).toBeGreaterThan(0);
        model.report = request.postDataJSON().report;
        expect(model.report.length).toBeGreaterThanOrEqual(10);
        model.status = 'AWAITING_HANDOVER';
        return route.fulfill({ json: job() });
      }
      return route.fulfill({ json: job() });
    }
    if (path === '/api/operations/kiosk-applications') {
      return route.fulfill({ json: { items: [application()], page: 1, hasMore: false } });
    }
    if (path === `/api/operations/kiosk-applications/${appId}`) {
      return route.fulfill({ json: { application: application(), evidencePhotos: model.photos } });
    }
    if (path.includes('/operations/kiosk-applications/') && path.includes('/evidence/')) {
      return route.fulfill({ contentType: 'image/png', body: photo.buffer });
    }
    if (path.endsWith('/handover')) {
      expect(model.role).toBe('OPERATIONS_MANAGER');
      expect(model.status).toBe('AWAITING_HANDOVER');
      expect(model.customerRole).toBe('CUSTOMER');
      model.status = 'ACTIVE';
      model.customerRole = 'SELLER';
      return route.fulfill({ json: application() });
    }
    return route.fulfill({ status: method === 'GET' ? 200 : 405, json: [] });
  });
  return model;
}

for (const width of [390, 1440]) {
  test(`Technician evidence/report → Manager handover with role boundaries at ${width}`, async ({
    page,
  }) => {
    const model = await installationFixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/technician/installations');
    await expect(page.locator('#job-detail-title')).toHaveText('Shop Hoa Kiểm Thử');
    await expect(page.getByRole('button', { name: /Nghiệm thu Đạt/ })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.getByRole('button', { name: /Bắt đầu khảo sát/ }).click();
    const report = page.getByLabel('Nội dung báo cáo chi tiết:');
    await report.fill('Đã kiểm tra nguồn điện và hoàn thành lắp đặt tại hiện trường.');
    const submit = page.getByRole('button', { name: 'Nộp báo cáo hoàn thành', exact: true });
    await expect(submit).toBeDisabled();
    await page.locator('input[type=file]').setInputFiles(photo);
    await page.getByRole('button', { name: 'Tải ảnh lên', exact: true }).click();
    await expect(
      page.getByText('Đã tải lên và đính kèm ảnh test-installation.png thành công.'),
    ).toBeVisible();
    await submit.click();
    await expect(page.getByText('Đã nộp báo cáo thành công!', { exact: true })).toBeVisible();
    await expect(page.getByText(model.report, { exact: true })).toBeVisible();
    expect(model.customerRole).toBe('CUSTOMER');
    model.role = 'OPERATIONS_MANAGER';
    await page.goto('/operations/installations');
    await page.getByRole('button', { name: 'Chi tiết', exact: true }).click();
    await expect(page.getByText(model.report, { exact: true })).toBeVisible();
    await expect(page.getByRole('img', { name: 'Minh chứng #1', exact: true })).toBeVisible();
    await page
      .getByRole('button', { name: 'Nghiệm thu Đạt & Bàn giao Kiosk', exact: true })
      .click();
    await expect(page.getByText(/Đã nghiệm thu bàn giao và kích hoạt Chủ shop/)).toBeVisible();
    expect(model.status).toBe('ACTIVE');
    expect(model.customerRole).toBe('SELLER');
    expect(
      model.writes.filter((w) => w.role === 'TECHNICIAN' && w.path.endsWith('/handover')),
    ).toEqual([]);
  });
}

test('Attachment retry reuses the uploaded ticket and ID and keeps the report draft', async ({
  page,
}) => {
  const model = await installationFixture(page, 'INSTALLING');
  model.attachFailures = 1;
  await page.goto('/technician/installations');
  const draft = page.getByLabel('Nội dung báo cáo chi tiết:');
  await draft.fill('Báo cáo đang soạn trước khi tải ảnh.');
  await page.locator('input[type=file]').setInputFiles(photo);
  await page.getByRole('button', { name: 'Tải ảnh lên', exact: true }).click();
  await expect(page.getByText('Đính kèm tạm thời gián đoạn.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Tải ảnh lên', exact: true }).click();
  await expect(
    page.getByText('Đã tải lên và đính kèm ảnh test-installation.png thành công.'),
  ).toBeVisible();
  expect(model.uploadCount).toBe(1);
  expect(model.attachIds).toHaveLength(2);
  expect(new Set(model.attachIds).size).toBe(1);
  await expect(draft).toHaveValue('Báo cáo đang soạn trước khi tải ảnh.');
});

test('A lost attachment response is reconciled by GET without a duplicate upload or attach', async ({
  page,
}) => {
  const model = await installationFixture(page, 'INSTALLING');
  model.loseAttachResponse = true;
  await page.goto('/technician/installations');
  await page.locator('input[type=file]').setInputFiles(photo);
  await page.getByRole('button', { name: 'Tải ảnh lên', exact: true }).click();
  await expect(
    page.getByText('Đã tải lên và đính kèm ảnh test-installation.png thành công.'),
  ).toBeVisible();
  expect(model.uploadCount).toBe(1);
  expect(model.attachIds).toHaveLength(1);
  expect(model.photos).toHaveLength(1);
});

test('Report submission stays blocked while evidence cannot be read', async ({ page }) => {
  const model = await installationFixture(page, 'INSTALLING');
  model.photos.push({ id: 'test-existing-evidence', createdAt: new Date().toISOString() });
  model.evidenceReadFailure = true;
  await page.goto('/technician/installations');
  await page.getByLabel('Nội dung báo cáo chi tiết:').fill('Đã lắp đặt và kiểm tra thiết bị.');
  const submit = page.getByRole('button', { name: 'Nộp báo cáo hoàn thành', exact: true });
  await expect(page.getByText('Chưa đọc được minh chứng lắp đặt.')).toBeVisible();
  await expect(submit).toBeDisabled();
  expect(model.writes.filter((w) => w.path.endsWith('/submit'))).toHaveLength(0);
  model.evidenceReadFailure = false;
  await page.getByRole('button', { name: 'Tải lại minh chứng', exact: true }).click();
  await expect(submit).toBeEnabled();
});

test('403 on submit explains assigned Technician access and preserves the report', async ({
  page,
}) => {
  const model = await installationFixture(page, 'INSTALLING');
  model.photos.push({ id: 'test-existing-evidence', createdAt: new Date().toISOString() });
  model.denySubmit = true;
  await page.goto('/technician/installations');
  const report = page.getByLabel('Nội dung báo cáo chi tiết:');
  await report.fill('Báo cáo chưa được gửi vì quyền phân công đã đổi.');
  await page.getByRole('button', { name: 'Nộp báo cáo hoàn thành', exact: true }).click();
  await expect(
    page.getByText(/Hãy dùng tài khoản TECHNICIAN được Manager phân công/),
  ).toBeVisible();
  await expect(report).toHaveValue('Báo cáo chưa được gửi vì quyền phân công đã đổi.');
  expect(model.status).toBe('INSTALLING');
});

for (const failure of ['list403', 'detail404']) {
  test(`An inaccessible Technician job exposes no action controls: ${failure}`, async ({
    page,
  }) => {
    const model = await installationFixture(page);
    model.denyList = failure === 'list403';
    model.denyDetail = failure === 'detail404';
    await page.goto('/technician/installations');
    await expect(
      page.getByText(
        failure === 'list403'
          ? /Hãy dùng tài khoản TECHNICIAN được Manager phân công/
          : /Không tìm thấy công việc được phân công/,
      ),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Bắt đầu khảo sát/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Tải ảnh lên', exact: true })).toHaveCount(0);
    expect(model.writes).toHaveLength(0);
  });
}

test('Operations login accepts an existing BE-issued legacy staff identifier', async ({ page }) => {
  const model = await installationFixture(page);
  await page.goto('/admin/login');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByText('Nhập email do quản trị viên cấp.', { exact: true })).toBeVisible();
  expect(model.loginBody).toBeNull();
  await page.getByLabel('Email', { exact: true }).fill('legacy@.florabot.test');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('Mock-password-123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/\/technician$/);
  expect(model.loginBody).toEqual({
    email: 'legacy@.florabot.test',
    password: 'Mock-password-123',
  });
});

for (const missing of ['photo', 'report']) {
  test(`Manager cannot hand over before required evidence is available: ${missing}`, async ({
    page,
  }) => {
    const model = await installationFixture(page, 'AWAITING_HANDOVER');
    model.role = 'OPERATIONS_MANAGER';
    if (missing !== 'photo')
      model.photos.push({ id: 'test-evidence-101', createdAt: new Date().toISOString() });
    if (missing !== 'report') model.report = 'Đã hoàn tất lắp đặt, chờ người quản lý kiểm tra.';
    await page.goto('/operations/installations');
    await page.getByRole('button', { name: 'Chi tiết', exact: true }).click();
    await expect(
      page.getByRole('button', { name: 'Nghiệm thu Đạt & Bàn giao Kiosk', exact: true }),
    ).toBeDisabled();
    expect(model.writes.filter((w) => w.path.endsWith('/handover'))).toHaveLength(0);
    expect(model.customerRole).toBe('CUSTOMER');
  });
}

import { readFile } from 'node:fs/promises';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const kioskId = '40000000-0000-0000-0000-000000000099';
const installationId = '70000000-0000-0000-0000-000000000099';
const shopName = 'Shop ESP32 kiểm thử';
const hardwareId = 'ESP32-TEST';
const fileContents = '// test fixture only\n#define MQTT_PASSWORD "fixture-device-secret"\n';

type Role = 'ADMIN' | 'OPERATIONS_MANAGER' | 'TECHNICIAN';
type Phase = 'PENDING' | 'PROVISIONING' | 'READY' | 'FAILED';

async function fixture(page: Page, role: Role) {
  const state = {
    phase: 'READY' as Phase | null,
    status: 'SCHEDULED',
    deniedRead: false,
    downloadError: null as { status: number; code: string } | null,
    invalidAttachment: false,
    autoProgress: false,
    autoDisabled: false,
    readCount: 0,
    downloadCount: 0,
    refreshCount: 0,
    provisionCount: 0,
    auditReads: [] as URLSearchParams[],
  };
  const job = () => ({
    id: installationId,
    status: state.status,
    shopName,
    kioskCode: 'K-ESP32',
    kioskId,
    installationAddress: '12 Nguyễn Huệ',
    contactEmail: 'esp32@example.test',
    phone: '0901234567',
    scheduledDate: '2026-11-11',
    timeWindow: '09:00 - 12:00',
  });
  const app = () => ({
    ...job(),
    assignedKioskId: state.status === 'CONFIRMED' ? null : kioskId,
    assignedKioskCode: 'K-ESP32',
    walkInSlots: 1,
    preorderSlots: 1,
    totalSlots: 2,
    annualFee: 40000,
    createdAt: '2026-11-10T04:00:00Z',
  });
  const expectedConfigPath =
    role === 'TECHNICIAN'
      ? `/api/staff/kiosk-installations/${installationId}/esp32-config`
      : `/api/${role === 'ADMIN' ? 'admin' : 'operations'}/kiosks/${kioskId}/esp32-config`;

  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    if (path === '/api/auth/me')
      return route.fulfill({ json: { id: 'actor-1', name: 'Nhân sự kiểm thử', role } });
    if (path === '/api/auth/refresh') {
      state.refreshCount++;
      return route.fulfill({ status: 401 });
    }
    if (path === '/api/staff/kiosk-installations') return route.fulfill({ json: [job()] });
    if (path === `/api/staff/kiosk-installations/${installationId}`)
      return route.fulfill({ json: job() });
    if (path === `/api/staff/kiosk-installations/${installationId}/evidence`)
      return route.fulfill({ json: [] });
    if (path === '/api/operations/kiosk-applications')
      return route.fulfill({ json: { items: [app()], page: 1, hasMore: false } });
    if (path === `/api/operations/kiosk-applications/${installationId}`)
      return route.fulfill({ json: { application: app(), evidencePhotos: [] } });
    if (path === '/api/operations/kiosks/enroll') {
      expect(req.method()).toBe('POST');
      expect(req.postDataJSON()).toEqual({
        applicationId: installationId,
        hardwareId,
        mqttClientId: null,
        code: 'K-ESP32',
        name: 'Tủ ESP32 kiểm thử',
        region: 'HCM',
      });
      state.phase = 'PENDING';
      return route.fulfill({
        status: 201,
        json: {
          id: kioskId,
          code: 'K-ESP32',
          name: 'Tủ ESP32 kiểm thử',
          status: 'OFFLINE',
          apiKey: 'fixture-kiosk-screen-key',
          provisioning: { state: 'PENDING', attempts: 0 },
        },
      });
    }
    if (path === '/api/admin/kiosks')
      return route.fulfill({
        json: [
          {
            id: kioskId,
            code: 'K-ESP32',
            name: 'Tủ ESP32 kiểm thử',
            status: 'OFFLINE',
            sellerId: null,
            slotCount: 2,
          },
        ],
      });
    if (path === '/api/admin/audit-logs') {
      state.auditReads.push(url.searchParams);
      return route.fulfill({
        json: {
          page: 1,
          hasMore: false,
          items: [
            {
              id: 9,
              actorType: 'USER',
              actorId: 'actor-2',
              action: 'ESP32_CONFIG_DOWNLOADED',
              entityType: 'kiosks',
              entityId: kioskId,
              createdAt: '2026-11-10T04:00:00Z',
              payloadRedacted: true,
            },
          ],
        },
      });
    }
    if (path.includes('/esp32-config')) {
      expect(path).toMatch(new RegExp(`^${expectedConfigPath}(/(download|provision))?$`));
      if (path.endsWith('/download')) {
        expect(role).not.toBe('ADMIN');
        expect(req.method()).toBe('POST');
        state.downloadCount++;
        const body = req.postDataJSON();
        expect(Object.keys(body)).toEqual(['password']);
        if (state.downloadError)
          return route.fulfill({
            status: state.downloadError.status,
            json: { code: state.downloadError.code },
          });
        if (body.password !== 'fixture-current-password') {
          return route.fulfill({
            status: 401,
            json: { code: 'ESP32_CONFIG_REAUTHENTICATION_FAILED' },
          });
        }
        if (state.invalidAttachment)
          return route.fulfill({ json: { unexpected: 'wrong-response-type' } });
        return route.fulfill({
          status: 200,
          contentType: 'text/x-c++hdr; charset=utf-8',
          headers: {
            'Content-Disposition': 'attachment; filename=config.local.h',
            'Cache-Control': 'no-store',
          },
          body: fileContents,
        });
      }
      if (path.endsWith('/provision')) {
        expect(role).not.toBe('ADMIN');
        expect(req.method()).toBe('POST');
        expect(req.postData()).toBeNull();
        state.provisionCount++;
        if (state.autoDisabled)
          return route.fulfill({ status: 409, json: { code: 'ESP32_AUTO_PROVISIONING_DISABLED' } });
        state.phase = 'PENDING';
        return route.fulfill({ status: 202, json: { state: 'PENDING', attempts: 1 } });
      }
      expect(req.method()).toBe('GET');
      state.readCount++;
      if (state.deniedRead)
        return route.fulfill({ status: 404, json: { code: 'ESP32_CONFIG_NOT_FOUND' } });
      const phase = state.phase;
      if (state.autoProgress) {
        if (phase === 'PENDING') state.phase = 'PROVISIONING';
        if (phase === 'PROVISIONING') state.phase = 'READY';
      }
      return route.fulfill({
        json: {
          kioskId,
          kioskCode: 'K-ESP32',
          status: 'OFFLINE',
          hardwareId,
          mqttClientId: 'legacy-client',
          firmwareMqttClientId: 'esp32-ESP32-TEST',
          mqttClientIdsMatch: false,
          mqttHost: 'mqtt.example.test',
          mqttTlsPort: 8883,
          caCertificatePem:
            '-----BEGIN CERTIFICATE-----\nPUBLIC-FIXTURE\n-----END CERTIFICATE-----',
          canDownload: role !== 'ADMIN' && (phase === 'READY' || phase === null),
          requiresReauthentication: role !== 'ADMIN',
          downloadUnavailableCode:
            phase === 'FAILED'
              ? 'ESP32_CONFIG_PROVISIONING_FAILED'
              : phase === 'PENDING' || phase === 'PROVISIONING'
                ? 'ESP32_CONFIG_NOT_READY'
                : null,
          provisioning: phase
            ? {
                state: phase,
                attempts: phase === 'FAILED' ? 2 : 0,
                errorCode: phase === 'FAILED' ? 'BROKER_TEST_FAILURE' : null,
              }
            : null,
          // Deliberately add unexpected fields so the UI cannot expose them by dumping JSON.
          mqttPassword: 'fixture-metadata-secret',
          hmacKey: 'fixture-metadata-hmac',
        },
      });
    }
    return route.fulfill({ json: [] });
  });
  return state;
}

const managerUrl = `/operations/installations?application=${installationId}`;

async function openManagerPanel(page: Page) {
  await page.goto(managerUrl);
  const panel = page.locator('.esp32-configuration');
  await panel.locator('summary').first().click();
  return panel;
}

async function fillDownload(page: Page, password = 'fixture-current-password') {
  const field = page.getByLabel('Mật khẩu hiện tại');
  if (!(await field.isVisible()))
    await page.getByRole('button', { name: 'Tải cấu hình ESP32' }).click();
  await field.fill(password);
}

test('Manager enrollment automatically opens provisioning and waits for READY without setting ONLINE', async ({
  page,
}, info) => {
  const state = await fixture(page, 'OPERATIONS_MANAGER');
  state.status = 'CONFIRMED';
  state.autoProgress = true;
  await page.goto(managerUrl);
  await page.getByRole('button', { name: '+ Tạo tủ theo hồ sơ', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Đăng ký thiết bị kiosk mới' });
  await dialog.getByLabel('Mã tủ (Code) *').fill('K-ESP32');
  await dialog.getByLabel('Tên tủ *').fill('Tủ ESP32 kiểm thử');
  await dialog.getByLabel('Hardware ID (Serial) *').fill(hardwareId);
  await dialog.getByRole('button', { name: 'Đăng ký thiết bị (OFFLINE)' }).click();
  const keyDialog = page.getByRole('dialog', { name: 'Cấu hình khóa thiết bị Kiosk (API Key)' });
  await expect(keyDialog).toBeVisible();
  await keyDialog.getByRole('button', { name: /Đóng bảng này/ }).click();
  const panel = page.locator('.esp32-configuration');
  await expect(panel.getByText(/Chờ cấp cấu hình|Đang cấp cấu hình/).first()).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Tải cấu hình ESP32' })).toHaveCount(0);
  await expect(panel.getByText('Cấu hình sẵn sàng', { exact: true })).toBeVisible({
    timeout: 12000,
  });
  await expect(panel.getByText('OFFLINE · Chưa kết nối')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Tải cấu hình ESP32' })).toBeVisible();
  await expect(page.getByText('fixture-kiosk-screen-key')).toHaveCount(0);
  expect(state.readCount).toBeGreaterThanOrEqual(3);
  expect(state.provisionCount).toBe(0);
  expect(state.downloadCount).toBe(0);
  await panel.screenshot({ path: info.outputPath('manager-esp32.png') });
});

test('Manager reauthenticates once, clears password on failure and downloads exact file bytes', async ({
  page,
}) => {
  const state = await fixture(page, 'OPERATIONS_MANAGER');
  const panel = await openManagerPanel(page);
  await expect(panel.getByText('Hai MQTT Client ID chưa khớp.', { exact: false })).toBeVisible();
  await fillDownload(page, 'fixture-incorrect-password');
  const confirm = page.getByRole('button', { name: 'Xác thực và tải file' });
  await confirm.click();
  await expect(panel.getByRole('alert')).toHaveText(/Mật khẩu chưa đúng/);
  await expect(page.getByLabel('Mật khẩu hiện tại')).toHaveValue('');
  await fillDownload(page);
  const fileEvent = page.waitForEvent('download');
  await confirm.click();
  const file = await fileEvent;
  expect(file.suggestedFilename()).toBe('config.local.h');
  expect(await readFile(await file.path(), 'utf8')).toBe(fileContents);
  await expect(panel.getByText(/Đã tải config.local.h/)).toBeVisible();
  await expect(page.getByLabel('Mật khẩu hiện tại')).toHaveCount(0);
  await expect(page.locator('main')).not.toContainText(
    /fixture-device-secret|fixture-metadata-secret|fixture-metadata-hmac/,
  );
  expect(state.downloadCount).toBe(2);
  expect(state.refreshCount).toBe(0);
  expect(
    await page.evaluate(() =>
      Object.values(localStorage).concat(Object.values(sessionStorage)).join(' '),
    ),
  ).not.toMatch(/fixture-current-password|fixture-device-secret/);
});

test('Admin views metadata and filtered audit, with no download or retry actions', async ({
  page,
}) => {
  const state = await fixture(page, 'ADMIN');
  state.phase = 'FAILED';
  await page.goto('/admin/slots');
  await page.locator('summary.admin-disclosure-summary').click();
  const panel = page.locator('.esp32-configuration');
  await panel.locator('summary').first().click();
  await expect(panel.getByText('mqtt.example.test')).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Tải cấu hình ESP32' })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Thử cấp lại' })).toHaveCount(0);
  await panel.getByText('Chứng chỉ CA công khai', { exact: true }).click();
  await expect(panel.getByText(/PUBLIC-FIXTURE/)).toBeVisible();
  await panel.getByRole('link', { name: 'Xem nhật ký tải cấu hình' }).click();
  await expect(page.getByText('ESP32_CONFIG_DOWNLOADED', { exact: true })).toBeVisible();
  expect(state.auditReads[0]?.get('entityId')).toBe(kioskId);
  expect(state.auditReads[0]?.get('entityType')).toBe('kiosks');
  expect(state.auditReads[0]?.get('action')).toBe('ESP32_CONFIG_DOWNLOADED');
  expect(state.downloadCount + state.provisionCount).toBe(0);
});

test('Technician uses installation scope and loses download when assignment is withdrawn', async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 390, height: 850 });
  const state = await fixture(page, 'TECHNICIAN');
  await page.goto('/technician/installations');
  await page.getByRole('button', { name: /Shop ESP32 kiểm thử/ }).click();
  const panel = page.locator('.esp32-configuration');
  await panel.locator('summary').first().click();
  await expect(panel.getByText(hardwareId, { exact: true })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).include('.esp32-configuration').analyze()).violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await panel.screenshot({ path: info.outputPath('technician-esp32.png') });
  await fillDownload(page);
  const fileEvent = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Xác thực và tải file' }).click();
  expect((await fileEvent).suggestedFilename()).toBe('config.local.h');
  await expect(panel.getByText(/Đã tải config.local.h/)).toBeVisible();
  await fillDownload(page);
  state.downloadError = { status: 404, code: 'ESP32_CONFIG_NOT_FOUND' };
  await page.getByRole('button', { name: 'Xác thực và tải file' }).click();
  await expect(panel.getByRole('alert')).toHaveText(
    /Không tìm thấy cấu hình trong phạm vi được giao/,
  );
  await expect(page.getByLabel('Mật khẩu hiện tại')).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Tải cấu hình ESP32' })).toHaveCount(0);

  await expect(panel.getByText(hardwareId, { exact: true })).toHaveCount(0);
  expect(state.downloadCount).toBe(2);

  state.status = 'ACTIVE';
  const before = state.readCount;
  await page.reload();
  await page.getByRole('button', { name: /Shop ESP32 kiểm thử/ }).click();
  await expect(page.locator('#job-detail-title')).toHaveText(shopName);
  await expect(page.getByText('Cấu hình ESP32', { exact: true })).toHaveCount(0);
  expect(state.readCount).toBe(before);
});

test('Failed provisioning can be retried, but a disabled deployment stops retry', async ({
  page,
}) => {
  const state = await fixture(page, 'OPERATIONS_MANAGER');
  state.phase = 'FAILED';
  state.autoDisabled = true;
  const panel = await openManagerPanel(page);
  await expect(panel.getByText('BROKER_TEST_FAILURE')).toBeVisible();
  await panel.getByRole('button', { name: 'Thử cấp lại' }).click();
  await expect(panel.getByRole('alert')).toHaveText('VPS chưa bật cấp cấu hình tự động.');
  await expect(panel.getByRole('button', { name: 'Thử cấp lại' })).toHaveCount(0);
  expect(state.provisionCount).toBe(1);

  state.autoDisabled = false;
  state.autoProgress = true;
  await page.reload();
  await page.locator('.esp32-configuration > summary').click();
  await page.getByRole('button', { name: 'Thử cấp lại' }).click();
  await expect(page.getByText('Cấu hình sẵn sàng', { exact: true })).toBeVisible({
    timeout: 12000,
  });
  expect(state.provisionCount).toBe(2);
});

test('Legacy metadata can allow download while BE reports missing credentials', async ({
  page,
}) => {
  const state = await fixture(page, 'OPERATIONS_MANAGER');
  state.phase = null;
  state.downloadError = { status: 409, code: 'ESP32_CONFIG_NOT_PROVISIONED' };
  const panel = await openManagerPanel(page);
  await expect(panel.getByText('Không có tiến trình tự cấp')).toBeVisible();
  await fillDownload(page);
  await page.getByRole('button', { name: 'Xác thực và tải file' }).click();
  await expect(panel.getByRole('alert')).toHaveText(/Tủ chưa có bộ khóa thiết bị/);
  await expect(panel.getByRole('button', { name: 'Tải cấu hình ESP32' })).toHaveCount(0);
  await expect(page.getByLabel('Mật khẩu hiện tại')).toHaveCount(0);
  expect(state.downloadCount).toBe(1);
});

test('Scope denial hides actions and a non-file response does not download', async ({ page }) => {
  const state = await fixture(page, 'OPERATIONS_MANAGER');
  state.deniedRead = true;
  const panel = await openManagerPanel(page);
  await expect(panel.getByRole('alert')).toHaveText(/Không tìm thấy cấu hình/);
  await expect(panel.getByRole('button', { name: 'Tải cấu hình ESP32' })).toHaveCount(0);
  state.deniedRead = false;
  state.invalidAttachment = true;
  await panel.getByRole('button', { name: 'Tải lại thông số' }).click();
  await fillDownload(page);
  let downloads = 0;
  page.on('download', () => downloads++);
  await page.getByRole('button', { name: 'Xác thực và tải file' }).click();
  await expect(panel.getByRole('alert')).toHaveText(/Chưa hoàn tất thao tác/);
  await expect(page.getByLabel('Mật khẩu hiện tại')).toHaveValue('');
  expect(downloads).toBe(0);
});

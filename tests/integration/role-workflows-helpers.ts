import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { resolve } from 'node:path';

/**
 * Portable repository roots for isolated integration runs.
 * Coordinator can override these via environment variables without editing test files.
 */
export const backendRoot = process.env.FLORABOT_BE_ROOT
  ? resolve(process.env.FLORABOT_BE_ROOT)
  : resolve('../BE');

export const kioskRoot = process.env.FLORABOT_KIOS_ROOT
  ? resolve(process.env.FLORABOT_KIOS_ROOT)
  : resolve('../Kios');

/**
 * Fixed local florabot_browser_tests database connection string.
 * Forced strictly to local florabot_browser_tests; never inherits a foreign DATABASE_URL that could target demo.
 */
export const fixedDatabaseUrl =
  'Host=localhost;Port=55436;Database=florabot_browser_tests;Username=florabot;Password=local-florabot-only';

/**
 * Execute raw SQL commands strictly in the disposable florabot_browser_tests database.
 * No hardware actions or slot overwrites.
 */
export function sql(input: string): string {
  const result = spawnSync(
    'docker',
    [
      'compose',
      'exec',
      '-T',
      'postgres',
      'psql',
      '-U',
      'florabot',
      '-d',
      'florabot_browser_tests',
      '-v',
      'ON_ERROR_STOP=1',
      '-tAq',
    ],
    {
      cwd: backendRoot,
      input,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
    },
  );
  expect(
    result.status,
    'SQL fixture execution must succeed against disposable florabot_browser_tests',
  ).toBe(0);
  return result.stdout.trim();
}

/**
 * Provision user credentials in process memory via the documented dotnet CLI stdin.
 * Password never enters persistent files, console logs, or Playwright traces.
 */
export function provisionUser(id: string, email: string, password: string): void {
  const result = spawnSync(
    'dotnet',
    [
      'run',
      '--project',
      'src/FloraBot.Api',
      '--no-build',
      '--no-launch-profile',
      '--',
      'provision-user',
      id,
      email,
    ],
    {
      cwd: backendRoot,
      encoding: 'utf8',
      input: password + '\n',
      timeout: 30_000,
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
        DATABASE_URL: fixedDatabaseUrl,
      },
      windowsHide: true,
    },
  );
  expect(result.status, 'Operator CLI must provision user in florabot_browser_tests').toBe(0);
}

/**
 * Resilient login helper honoring server-side rate limits (429) without weakening
 * production limits or validations.
 */
export async function loginAccount(
  page: Page,
  options: {
    email: string;
    password: string;
    loginPath: '/dang-nhap' | '/admin/login';
    expectedUrl: RegExp;
    submitEndpoint: string;
  },
): Promise<void> {
  await page.goto(options.loginPath);
  await page.getByLabel('Email', { exact: true }).fill(options.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(options.password);

  const loginResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith(options.submitEndpoint),
  );
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const response = await loginResponsePromise;

  if (response.status() === 429) {
    // Normal window pacing when multiple browser test flows share the loopback rate budget.
    await expect(page.locator('main').getByRole('alert')).toContainText('Bạn thao tác hơi nhanh');
    await page.waitForTimeout(60_000);
    const retryPromise = page.waitForResponse((res) => res.url().endsWith(options.submitEndpoint));
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    expect((await retryPromise).status()).toBe(200);
  } else {
    expect(response.status()).toBe(200);
  }

  await expect(page).toHaveURL(options.expectedUrl);
}

/**
 * Resilient customer registration helper honoring server-side rate limits (429)
 * without weakening production limits or validations.
 */
export async function registerCustomer(
  page: Page,
  options: {
    fullName: string;
    email: string;
    password: string;
  },
): Promise<void> {
  await page.goto('/dang-ky');
  await page.getByLabel('Họ và tên', { exact: true }).fill(options.fullName);
  await page.getByLabel('Email', { exact: true }).fill(options.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(options.password);
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill(options.password);
  await page.getByRole('checkbox').check();

  const registerPromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/auth/register') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  const response = await registerPromise;

  if (response.status() === 429) {
    await expect(page.locator('main').getByRole('alert')).toContainText('Bạn thao tác hơi nhanh');
    await page.waitForTimeout(60_000);
    const retryPromise = page.waitForResponse(
      (res) => res.url().endsWith('/api/auth/register') && res.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
    expect((await retryPromise).status()).toBe(200);
  } else {
    expect(response.status()).toBe(200);
  }

  await expect(page).toHaveURL(/\/tai-khoan$/);
}

export type PreorderFixture = {
  sellerId: string;
  sellerUserId: string;
  sellerEmail: string;
  sellerPassword: string;
  kioskId: string;
  kioskName: string;
  slotId: string;
  productId: string;
  flowerName: string;
};

/**
 * Creates dedicated synthetic seller, kiosk, slot, and artificial flower fixtures
 * for custom preorder integration testing.
 */
export function createPreorderFixture(): PreorderFixture {
  const sellerId = randomUUID();
  const sellerUserId = randomUUID();
  const kioskId = randomUUID();
  const slotId = randomUUID();
  const productId = randomUUID();
  const apiKey = randomBytes(24).toString('hex');
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

  const sellerEmail = `seller-custom-${sellerId}@example.invalid`;
  const sellerPassword = randomBytes(24).toString('base64url');
  const shopName = `Tiệm Hoa Mẫu Riêng ${randomInt(1000, 9999)}`;
  const kioskName = `Tủ Nhận Mẫu Riêng ${randomInt(1000, 9999)}`;
  const flowerName = `Bó Lan Lụa Quý Phái ${randomInt(1000, 9999)}`;

  sql(`
    BEGIN;
    INSERT INTO kiosk_ops.kiosks(id, code, name, address, region, hardware_id, mqtt_client_id, status, last_heartbeat_at, api_key_hash)
    VALUES ('${kioskId}', 'KIOSK-${kioskId}', '${kioskName}', 'Đại học FPT, TP. Thủ Đức', 'ThuDuc', '${kioskId}', '${kioskId}', 'ONLINE', public.app_now(), '${apiKeyHash}');

    INSERT INTO identity.sellers(id, shop_name, phone, status, package_id, package_expires_at)
    VALUES ('${sellerId}', '${shopName}', '09${randomInt(10000000, 99999999)}', 'ACTIVE', '20000000-0000-0000-0000-00000000000a', CURRENT_DATE + 30);

    INSERT INTO identity.users(id, email, password_hash, full_name, role, seller_id)
    VALUES ('${sellerUserId}', '${sellerEmail}', '!unprovisioned', 'Chủ ${shopName}', 'SELLER', '${sellerId}');

    INSERT INTO kiosk_ops.slots(id, kiosk_id, slot_code, relay_channel, status, current_seller_id)
    VALUES ('${slotId}', '${kioskId}', 'C01', 1, 'RENTED_EMPTY', '${sellerId}');

    INSERT INTO kiosk_ops.slot_assignments(slot_id, seller_id, assigned_by, status)
    VALUES ('${slotId}', '${sellerId}', (SELECT id FROM identity.users WHERE role='ADMIN' ORDER BY id LIMIT 1), 'ACTIVE');

    INSERT INTO catalog.flower_products(id, seller_id, name, description, price, shelf_life_hours, length_cm, width_cm, height_cm, status, inventory_kind)
    VALUES ('${productId}', '${sellerId}', '${flowerName}', 'Bó hoa lụa nghệ thuật cao cấp theo yêu cầu', 450000, 72, 25.0, 20.0, 45.0, 'ACTIVE', 'ARTIFICIAL');
    COMMIT;
  `);

  provisionUser(sellerUserId, sellerEmail, sellerPassword);

  return {
    sellerId,
    sellerUserId,
    sellerEmail,
    sellerPassword,
    kioskId,
    kioskName,
    slotId,
    productId,
    flowerName,
  };
}

export type RoleTaskFixture = {
  managerId: string;
  managerEmail: string;
  managerPassword: string;
  technicianId: string;
  technicianEmail: string;
  technicianPassword: string;
  technicianName: string;
  sellerId: string;
  sellerOwnerId: string;
  sellerOwnerEmail: string;
  sellerOwnerPassword: string;
  sellerStaffId: string;
  sellerStaffEmail: string;
  sellerStaffPassword: string;
  sellerStaffName: string;
  foreignStaffId: string;
  foreignStaffEmail: string;
  foreignStaffPassword: string;
  kioskId: string;
  kioskName: string;
  slotId: string;
  incidentId: string;
  shopName: string;
};

/**
 * Creates dedicated fixtures for Operations Manager, Technician, Seller, and SellerStaff
 * with an open incident and an active kiosk delivery slot.
 */
export function createRoleTaskFixture(): RoleTaskFixture {
  const managerId = randomUUID();
  const technicianId = randomUUID();
  const sellerId = randomUUID();
  const sellerOwnerId = randomUUID();
  const sellerStaffId = randomUUID();
  const foreignSellerId = randomUUID();
  const foreignStaffId = randomUUID();
  const kioskId = randomUUID();
  const slotId = randomUUID();
  const incidentId = randomUUID();
  const apiKey = randomBytes(24).toString('hex');
  const apiKeyHash = createHash('sha256').update(apiKey).digest('hex');

  const managerEmail = `ops-mgr-${managerId}@example.invalid`;
  const managerPassword = randomBytes(24).toString('base64url');

  const technicianEmail = `tech-${technicianId}@example.invalid`;
  const technicianPassword = randomBytes(24).toString('base64url');
  const technicianName = `Kỹ thuật viên ${randomInt(100, 999)}`;

  const shopName = `Tiệm Hoa Vận Hành ${randomInt(1000, 9999)}`;
  const sellerOwnerEmail = `owner-${sellerOwnerId}@example.invalid`;
  const sellerOwnerPassword = randomBytes(24).toString('base64url');

  const sellerStaffEmail = `staff-${sellerStaffId}@example.invalid`;
  const sellerStaffPassword = randomBytes(24).toString('base64url');
  const sellerStaffName = `Nhân viên Giao ${randomInt(100, 999)}`;

  const foreignStaffEmail = `foreign-staff-${foreignStaffId}@example.invalid`;
  const foreignStaffPassword = randomBytes(24).toString('base64url');

  const kioskName = `Tủ Vận Hành ${randomInt(1000, 9999)}`;

  sql(`
    BEGIN;
    INSERT INTO kiosk_ops.kiosks(id, code, name, address, region, hardware_id, mqtt_client_id, status, last_heartbeat_at, api_key_hash)
    VALUES ('${kioskId}', 'KIOSK-OPS-${kioskId}', '${kioskName}', 'Khu Công nghệ cao, TP. Thủ Đức', 'ThuDuc', '${kioskId}', '${kioskId}', 'ONLINE', public.app_now(), '${apiKeyHash}');

    INSERT INTO identity.sellers(id, shop_name, phone, status, package_id, package_expires_at)
    VALUES
      ('${sellerId}', '${shopName}', '09${randomInt(10000000, 99999999)}', 'ACTIVE', '20000000-0000-0000-0000-00000000000a', CURRENT_DATE + 30),
      ('${foreignSellerId}', 'Tiệm Ngoại Vi', '09${randomInt(10000000, 99999999)}', 'ACTIVE', '20000000-0000-0000-0000-00000000000a', CURRENT_DATE + 30);

    INSERT INTO identity.users(id, email, password_hash, full_name, role, seller_id)
    VALUES
      ('${managerId}', '${managerEmail}', '!unprovisioned', 'Quản lý Vận hành', 'OPERATIONS_MANAGER', NULL),
      ('${technicianId}', '${technicianEmail}', '!unprovisioned', '${technicianName}', 'TECHNICIAN', NULL),
      ('${sellerOwnerId}', '${sellerOwnerEmail}', '!unprovisioned', 'Chủ ${shopName}', 'SELLER', '${sellerId}'),
      ('${sellerStaffId}', '${sellerStaffEmail}', '!unprovisioned', '${sellerStaffName}', 'SELLER_STAFF', '${sellerId}'),
      ('${foreignStaffId}', '${foreignStaffEmail}', '!unprovisioned', 'Nhân viên Ngoài Shop', 'SELLER_STAFF', '${foreignSellerId}');

    INSERT INTO kiosk_ops.manager_kiosks(manager_id, kiosk_id)
    VALUES ('${managerId}', '${kioskId}');

    INSERT INTO kiosk_ops.slots(id, kiosk_id, slot_code, relay_channel, status, current_seller_id)
    VALUES ('${slotId}', '${kioskId}', 'B01', 2, 'RENTED_EMPTY', '${sellerId}');

    INSERT INTO kiosk_ops.slot_assignments(slot_id, seller_id, assigned_by, status)
    VALUES ('${slotId}', '${sellerId}', (SELECT id FROM identity.users WHERE role='ADMIN' ORDER BY id LIMIT 1), 'ACTIVE');

    INSERT INTO ordering.disputes(id, kiosk_id, slot_id, kind, status, reported_by, reason)
    VALUES ('${incidentId}', '${kioskId}', '${slotId}', 'DEVICE_FAULT', 'OPEN', '${managerId}', 'Khóa ô B01 kẹt cơ khí, cần kỹ thuật viên kiểm tra.');
    COMMIT;
  `);

  provisionUser(managerId, managerEmail, managerPassword);
  provisionUser(technicianId, technicianEmail, technicianPassword);
  provisionUser(sellerOwnerId, sellerOwnerEmail, sellerOwnerPassword);
  provisionUser(sellerStaffId, sellerStaffEmail, sellerStaffPassword);
  provisionUser(foreignStaffId, foreignStaffEmail, foreignStaffPassword);

  return {
    managerId,
    managerEmail,
    managerPassword,
    technicianId,
    technicianEmail,
    technicianPassword,
    technicianName,
    sellerId,
    sellerOwnerId,
    sellerOwnerEmail,
    sellerOwnerPassword,
    sellerStaffId,
    sellerStaffEmail,
    sellerStaffPassword,
    sellerStaffName,
    foreignStaffId,
    foreignStaffEmail,
    foreignStaffPassword,
    kioskId,
    kioskName,
    slotId,
    incidentId,
    shopName,
  };
}

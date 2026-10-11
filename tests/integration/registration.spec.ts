import { expect, test } from '@playwright/test';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { uploadEvidence } from './evidence';
import { getBackendRoot, loginAdminWithPacing, loginSellerWithPacing } from './helpers';

const backend = getBackendRoot();
const database =
  'Host=localhost;Port=55436;Database=florabot_browser_tests;Username=florabot;Password=local-florabot-only';

function provision(id: string, email: string, password: string) {
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
      cwd: backend,
      encoding: 'utf8',
      input: password + '\n',
      timeout: 30_000,
      env: { ...process.env, ASPNETCORE_ENVIRONMENT: 'Development', DATABASE_URL: database },
      windowsHide: true,
    },
  );
  expect(result.status, 'Operator CLI must provision the disposable account').toBe(0);
}

test('Real registration, admin approval, provisioning and seller subscription', async ({
  page,
  context,
}) => {
  test.setTimeout(300_000);
  let hubConnected = false;
  let refreshMessages = 0;
  page.on('websocket', (socket) => {
    if (!socket.url().includes('/hub/portal')) return;
    socket.on('framereceived', ({ payload }) => {
      const frame = payload.toString();
      if (frame.includes('{}')) hubConnected = true;
      if (frame.includes('"target":"Refresh"')) refreshMessages++;
    });
  });
  const password = randomBytes(24).toString('base64url');
  provision('10000000-0000-0000-0000-000000000001', 'admin@florabot.vn', password);
  const phone = `09${randomInt(10_000_000, 100_000_000)}`;
  const shopName = `Tiệm hoa trình duyệt ${randomInt(1000, 9999)}`;
  await page.goto('http://127.0.0.1:5183/#dang-ky');
  await page.getByLabel('Tên shop', { exact: true }).fill(shopName);
  await page.getByLabel('Số điện thoại', { exact: true }).fill(phone);
  await page.locator('#area').fill('Thủ Đức');
  const registration = page.waitForResponse(
    (response) => response.url().endsWith('/api/sellers') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Đăng ký tư vấn' }).click();
  const response = await registration;
  expect(response.status()).toBe(201);
  const seller = (await response.json()) as { id: string; status: string };
  expect(seller.status).toBe('PENDING');
  await expect(page.getByRole('status').filter({ hasText: 'Đã nhận đăng ký' })).toBeVisible();

  await page.goto('/admin/login');
  await loginAdminWithPacing(page, 'admin@florabot.vn', password);
  await page.goto('/admin/shops');
  await expect.poll(() => hubConnected).toBe(true);
  const liveShopName = `Hoa cập nhật trực tiếp ${randomInt(1000, 9999)}`;
  const liveRegistration = await page.request.post('/api/sellers', {
    headers: { Origin: 'http://127.0.0.1:5183' },
    data: {
      shopName: liveShopName,
      phone: `09${randomInt(10_000_000, 100_000_000)}`,
      area: 'Thủ Đức',
      packageId: '20000000-0000-0000-0000-00000000000a',
    },
  });
  expect(liveRegistration.status()).toBe(201);
  await expect.poll(() => refreshMessages).toBeGreaterThan(0);
  await expect(
    page.locator('.admin-sellers').getByText(liveShopName, { exact: true }),
  ).toBeVisible();
  const shop = page.locator('.admin-sellers li').filter({ hasText: shopName });
  await shop.locator('summary').click();
  await shop
    .getByLabel(`Gói thuê cho ${shopName}`)
    .selectOption('20000000-0000-0000-0000-00000000000a');
  await shop.getByRole('button', { name: 'Duyệt hồ sơ shop' }).click();
  await expect(
    page
      .locator('.admin-sellers')
      .getByRole('status')
      .filter({ hasText: `Đã duyệt ${shopName}` }),
  ).toBeVisible();
  const cookies = await context.cookies();
  const authCookies = cookies.filter((cookie) => cookie.name.startsWith('florabot_'));
  expect(authCookies).toHaveLength(2);
  expect(authCookies.every((cookie) => cookie.httpOnly && cookie.sameSite === 'Strict')).toBe(true);
  expect(await page.evaluate(() => document.cookie)).not.toContain('florabot_');
  const access = authCookies.find((cookie) => cookie.name === 'florabot_access')!;
  await context.addCookies([{ ...access, value: 'invalid-access-for-refresh-test' }]);
  const refreshResponse = page.waitForResponse((response) =>
    response.url().endsWith('/api/auth/refresh'),
  );
  await page.goto('/admin');
  expect((await refreshResponse).status()).toBe(200);
  await expect(page).toHaveURL(/\/admin$/);
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await expect(page).toHaveURL(/\/admin\/login$/);

  // Operator-only account lookup uses the fixture's validated UUID, never a public setup endpoint.
  expect(seller.id).toMatch(/^[0-9a-f-]{36}$/);
  const lookup = spawnSync(
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
      '-tAc',
      `SELECT id FROM identity.users WHERE seller_id='${seller.id}' AND role='SELLER'`,
    ],
    { cwd: backend, encoding: 'utf8', windowsHide: true },
  );
  expect(lookup.status).toBe(0);
  const userId = lookup.stdout.trim();
  expect(userId).toMatch(/^[0-9a-f-]{36}$/);
  const email = `browser-${userId}@example.invalid`;
  provision(userId, email, password);
  await page.goto('/dang-nhap');
  await loginSellerWithPacing(page, email, password);
  await expect(page.getByLabel('Trạng thái gói')).toContainText('Shop đã được duyệt');
  await expect(page.getByRole('button', { name: 'Ghi nhận bó hoa vào ô' })).toHaveCount(0);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/seller$/);
  const foreign = await page.request.get('/api/sellers/20000000-0000-0000-0000-000000000001/slots');
  expect(foreign.status()).toBe(404);
  await page.goto('/seller/wallet');
  const wallet = page.locator('#wallet');
  await expect(wallet).toContainText('Shop chưa có đầy đủ thông tin tài khoản nhận tiền');
  expect(
    (await page.request.get('/api/sellers/20000000-0000-0000-0000-000000000001/wallet')).status(),
  ).toBe(404);
  await wallet.locator('.bank-details summary').click();
  await wallet.getByRole('button', { name: 'Khai báo tài khoản nhận tiền', exact: true }).click();
  await wallet.getByLabel('Tên ngân hàng', { exact: true }).fill('Browser Test Bank');
  await wallet.getByLabel('Tên chủ tài khoản', { exact: true }).fill('TEST SHOP');
  await wallet.getByLabel('Số tài khoản ngân hàng', { exact: true }).fill('00012345678');
  await wallet.getByRole('button', { name: 'Kiểm tra thông tin tài khoản' }).click();
  const bankSave = page.waitForResponse((response) =>
    response.url().endsWith('/flows/set_seller_bank'),
  );
  await wallet.getByRole('button', { name: 'Xác nhận lưu tài khoản' }).click();
  expect((await bankSave).status()).toBe(200);
  await expect(wallet.locator('.bank-summary')).toContainText('Đã che, kết thúc bằng 5678');
  const bankRead = await page.request.get(`/api/sellers/${seller.id}/bank`);
  expect(bankRead.headers()['cache-control']).toBe('no-store');
  expect(await bankRead.text()).not.toContain('00012345678');
  await wallet.locator('.bank-details summary').click();
  // Fund only this disposable browser fixture; no transfer or real bank account is involved.
  const funding = spawnSync(
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
      '-q',
    ],
    {
      cwd: backend,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
      input: `BEGIN;
      INSERT INTO payment.ledger_entries(journal_id,account,seller_id,amount,ref_type,ref_id,memo) VALUES
      ('${seller.id}','GATEWAY_CLEARING',NULL,200000,'ORDER','${seller.id}','Browser test fixture'),
      ('${seller.id}','SELLER_AVAILABLE','${seller.id}',-200000,'ORDER','${seller.id}','Browser test fixture');
      COMMIT;`,
    },
  );
  expect(funding.status, 'Isolated wallet fixture must be balanced').toBe(0);
  await wallet.getByRole('button', { name: 'Cập nhật ví' }).click();
  await wallet.getByLabel('Số tiền muốn rút (đồng)').fill('100000');
  await wallet.getByRole('button', { name: 'Kiểm tra yêu cầu rút' }).click();
  const withdrawal = page.waitForResponse((response) =>
    response.url().endsWith('/flows/request_withdrawal'),
  );
  await wallet.getByRole('button', { name: 'Xác nhận yêu cầu rút' }).click();
  expect((await withdrawal).status()).toBe(200);
  await expect(wallet.getByRole('status')).toContainText('Đã gửi yêu cầu');
  await expect(wallet.getByText('Chờ duyệt', { exact: true })).toBeVisible();
  await expect(wallet.locator('.wallet-balances')).toContainText('200.000');
  await page.goto('/seller/subscriptions');
  const subscription = page.locator('.subscriptions');
  await subscription.getByRole('button', { name: /Đăng ký/ }).click();
  await expect(subscription).toContainText('Chờ thanh toán');
  const unavailable = page.waitForResponse((response) => response.url().endsWith('/payment-link'));
  await subscription.getByRole('button', { name: 'Tạo liên kết thanh toán' }).click();
  expect((await unavailable).status()).toBe(503);
  await expect(subscription.getByRole('alert')).toBeVisible();
  await expect(page.getByLabel('Trạng thái gói')).toContainText('Shop đã được duyệt');

  // Isolated empty-slot fixture: fault reporting must not need an active sales subscription.
  const faultFixture = spawnSync(
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
      '-q',
    ],
    {
      cwd: backend,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 30_000,
      input: `INSERT INTO kiosk_ops.slots(id,kiosk_id,slot_code,relay_channel,status,current_seller_id)
      VALUES('${seller.id}','40000000-0000-0000-0000-000000000001','BROWSER-FAULT',63,'RENTED_EMPTY','${seller.id}');`,
    },
  );
  expect(faultFixture.status).toBe(0);
  await page.goto('/seller/stock');
  const stock = page.locator('.seller-stock');
  await stock.getByRole('button', { name: 'Làm mới ô và sản phẩm' }).click();
  await stock.locator('summary').filter({ hasText: 'BROWSER-FAULT' }).click();
  await stock.getByRole('button', { name: 'Báo sự cố ô BROWSER-FAULT' }).click();
  await stock
    .getByLabel('Tình trạng cần kiểm tra')
    .fill('Khóa không phản hồi trong bài kiểm tra trình duyệt.');
  await uploadEvidence(stock);
  await stock.getByRole('button', { name: 'Kiểm tra báo cáo' }).click();
  const report = page.waitForResponse((response) =>
    response.url().endsWith('/flows/report_device_fault'),
  );
  await stock.getByRole('button', { name: 'Xác nhận báo sự cố' }).click();
  const reportResponse = await report;
  expect(reportResponse.status()).toBe(200);
  const reportId = ((await reportResponse.json()) as { result: string }).result;
  await expect(stock.locator('.fault-report').getByRole('status')).toContainText(
    'Đã ghi nhận báo cáo',
  );
  await expect(stock.locator('summary').filter({ hasText: 'BROWSER-FAULT' })).toContainText(
    'Có sự cố',
  );
  const evidence = spawnSync(
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
      '-tAc',
      `SELECT count(*) FROM ordering.disputes WHERE slot_id='${seller.id}' AND kind='DEVICE_FAULT' AND status='OPEN' AND reported_by='${userId}'`,
    ],
    { cwd: backend, encoding: 'utf8', windowsHide: true },
  );
  expect(evidence.status).toBe(0);
  expect(evidence.stdout.trim()).toBe('1');
  const foreignFault = await page.request.post(
    `/api/sellers/${seller.id}/flows/report_device_fault`,
    {
      headers: { Origin: 'http://127.0.0.1:5183' },
      data: {
        p_kiosk: '40000000-0000-0000-0000-000000000001',
        p_slot: '40000000-0000-0000-0001-000000000001',
        p_desc: 'Foreign slot must be denied',
        p_photo: 'https://example.invalid/foreign.jpg',
      },
    },
  );
  expect(foreignFault.status()).toBe(404);
  expect((await page.request.get(`/api/admin/incidents/${reportId}`)).status()).toBe(403);
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await page.goto('/admin/login');
  await loginAdminWithPacing(page, 'admin@florabot.vn', password);
  await page.goto('/admin/incidents');
  const incidents = page.locator('.admin-incidents');
  const incident = incidents
    .locator('li')
    .filter({ has: page.locator('summary', { hasText: 'BROWSER-FAULT' }) });
  await incident.locator('summary').click();
  await expect(
    incident.getByText('Khóa không phản hồi trong bài kiểm tra trình duyệt.'),
  ).toBeVisible();
  await expect(incident.getByRole('link', { name: 'Mở ảnh minh chứng 1' })).toHaveAttribute(
    'href',
    /\/api\/admin\/evidence\/[0-9a-f-]{36}$/,
  );
  await incident
    .getByLabel('Kết quả kiểm tra và xử lý')
    .fill('Đã kiểm tra khóa trong môi trường thử nghiệm.');
  await incident.getByRole('button', { name: 'Kiểm tra kết quả xử lý' }).click();
  const resolution = page.waitForResponse((response) =>
    response.url().endsWith('/flows/resolve_device_fault'),
  );
  await incident.getByRole('button', { name: 'Xác nhận đóng sự cố' }).click();
  expect((await resolution).status()).toBe(200);
  await expect(incidents.getByRole('status')).toContainText('Đã ghi nhận xử lý');
  await incidents.getByLabel('Trạng thái sự cố').selectOption('RESOLVED_FIXED');
  await incident.locator('summary').click();
  await expect(incident.getByText('Đã kiểm tra khóa trong môi trường thử nghiệm.')).toBeVisible();
  await expect(incident.getByRole('button', { name: 'Kiểm tra kết quả xử lý' })).toHaveCount(0);
  const closed = await page.request.get(`/api/admin/incidents/${reportId}`);
  expect(closed.headers()['cache-control']).toBe('no-store');
  expect(((await closed.json()) as { incident: { status: string } }).incident.status).toBe(
    'RESOLVED_FIXED',
  );

  await page.goto('/admin/withdrawals');
  const payouts = page.locator('.admin-withdrawals');
  await payouts.locator('summary').filter({ hasText: shopName }).click();
  await payouts.getByRole('button', { name: 'Duyệt yêu cầu', exact: true }).click();
  await payouts.getByRole('button', { name: 'Kiểm tra thao tác' }).click();
  await payouts.getByRole('button', { name: 'Xác nhận thao tác' }).click();
  await expect(payouts.getByRole('status')).toContainText('Đã duyệt yêu cầu');
  await payouts.getByLabel('Trạng thái yêu cầu rút tiền').selectOption('APPROVED');
  await payouts.locator('summary').filter({ hasText: shopName }).click();
  await expect(
    payouts.getByText('Bước chi cần một admin khác người đã duyệt yêu cầu.'),
  ).toBeVisible();
  await expect(payouts.getByRole('button', { name: 'Xem tài khoản để chi' })).toHaveCount(0);
  const payerId = randomUUID();
  const payerEmail = `payer-${payerId}@example.invalid`;
  const payerSetup = spawnSync(
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
      '-q',
    ],
    {
      cwd: backend,
      encoding: 'utf8',
      windowsHide: true,
      input: `INSERT INTO identity.users(id,email,password_hash,full_name,role) VALUES('${payerId}','${payerEmail}','!unprovisioned','Browser payer','ADMIN');`,
    },
  );
  expect(payerSetup.status).toBe(0);
  provision(payerId, payerEmail, password);
  await page.getByRole('button', { name: 'Đăng xuất' }).click();
  await page.goto('/admin/login');
  await loginAdminWithPacing(page, payerEmail, password);
  await page.goto('/admin/withdrawals');
  await payouts.getByLabel('Trạng thái yêu cầu rút tiền').selectOption('APPROVED');
  await payouts.locator('summary').filter({ hasText: shopName }).click();
  await payouts.getByRole('button', { name: 'Xem tài khoản để chi' }).click();
  await expect(payouts.getByText('00012345678', { exact: true })).toBeVisible();
  await payouts.getByRole('button', { name: 'Ghi nhận đã chuyển khoản' }).click();
  // This records only a synthetic transfer in the disposable ledger; no bank/provider is called.
  await uploadEvidence(payouts);
  await payouts.getByRole('checkbox').check();
  await payouts.getByRole('button', { name: 'Kiểm tra thao tác' }).click();
  const payout = page.waitForResponse((response) =>
    response.url().endsWith('/flows/pay_withdrawal'),
  );
  await payouts.getByRole('button', { name: 'Xác nhận thao tác' }).click();
  expect((await payout).status()).toBe(200);
  await expect(
    payouts.getByRole('status').filter({ hasText: 'Đã ghi nhận chuyển tiền' }),
  ).toBeVisible();
  await payouts.getByLabel('Trạng thái yêu cầu rút tiền').selectOption('PAID');
  await payouts.locator('summary').filter({ hasText: shopName }).click();
  await expect(payouts.getByText('00012345678', { exact: true })).toHaveCount(0);
  const paidRecord = spawnSync(
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
      '-tAc',
      `SELECT count(*) FROM payment.withdrawal_requests WHERE seller_id='${seller.id}' AND status='PAID' AND approved_by='10000000-0000-0000-0000-000000000001' AND paid_by='${payerId}'`,
    ],
    { cwd: backend, encoding: 'utf8', windowsHide: true },
  );
  expect(paidRecord.status).toBe(0);
  expect(paidRecord.stdout.trim()).toBe('1');
});

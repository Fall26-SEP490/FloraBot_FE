import { expect, test } from '@playwright/test';
import { randomBytes, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { uploadEvidence, evidencePng } from './evidence';
import { getBackendRoot, loginAdminWithPacing } from './helpers';

function sql(input: string) {
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
      cwd: getBackendRoot(),
      input,
      encoding: 'utf8',
      windowsHide: true,
    },
  );
  expect(result.status, 'SQL fixture/check must succeed in the disposable browser database').toBe(
    0,
  );
  return result.stdout.trim();
}

test('Public receipt stores a refund account through gateway/API without exposing it in reads or audit', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const order = randomUUID();
  const checkout = randomUUID();
  // Synthetic completed charge is a fixture, not a provider payment or bank transfer.
  const token = sql(`
    INSERT INTO ordering.orders(id,order_code,checkout_id,seller_id,kiosk_id,status,subtotal,total_amount,tracking_token,completed_at)
    VALUES('${order}','BROWSER-${order}','${checkout}','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','COMPLETED',350000,350000,flow.new_tracking_token(),public.app_now());
    INSERT INTO payment.payments(kind,purpose,checkout_id,gateway,idempotency_key,amount,status,paid_at)
    VALUES('CHARGE','ORDER_CHECKOUT','${checkout}','MANUAL','browser-${checkout}',350000,'SUCCEEDED',public.app_now());
    DO $$ BEGIN PERFORM flow.admin_refund('${order}','10000000-0000-0000-0000-000000000001',350000,'Synthetic browser receipt fixture'); END $$;
    SELECT tracking_token FROM ordering.orders WHERE id='${order}';
  `);
  expect(token).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/);
  await page.goto(`/receipt#order=${order}&token=${token}`);
  await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
  await expect(page.getByText('Khoản hoàn đang chờ thông tin tài khoản nhận tiền.')).toBeVisible();
  await page.getByLabel('Tên ngân hàng', { exact: true }).fill('ACB');
  await page.getByLabel('Tên chủ tài khoản', { exact: true }).fill('Nguyen Van A');
  await page.getByLabel('Số tài khoản ngân hàng', { exact: true }).fill('001234567890');
  await page.getByRole('button', { name: 'Kiểm tra tài khoản', exact: true }).click();
  await page.getByRole('button', { name: 'Xác nhận gửi tài khoản' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã gửi tài khoản nhận hoàn' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
  await expect(
    page.getByText('Đã nhận thông tin tài khoản hoàn tiền. Khoản hoàn đang chờ được xử lý.'),
  ).toBeVisible();
  const evidence = sql(
    `SELECT (refund_bank_account_enc IS NOT NULL AND refund_bank_account_enc <> '001234567890')::text || '|' || refund_bank_holder FROM ordering.orders WHERE id='${order}';`,
  );
  expect(evidence).toBe('true|NGUYEN VAN A');
  const audit = sql(
    `SELECT payload::text FROM notify.audit_logs WHERE entity_id='${order}' AND action='REFUND_INFO_SUBMITTED';`,
  );
  expect(JSON.parse(audit)).toEqual({ bank: 'ACB' });
  const lookup = await page.request.post('/api/receipts/lookup', {
    data: { orderId: order, trackingToken: token },
  });
  expect(lookup.status()).toBe(200);
  expect(lookup.headers()['cache-control']).toBe('no-store');
  const body = await lookup.text();
  expect(body).not.toContain('001234567890');
  expect(body).not.toContain('NGUYEN VAN A');
  await page.getByLabel('Mã tra cứu', { exact: true }).fill('');
  await expect(page.getByLabel('Mã tra cứu', { exact: true })).toHaveValue('');

  const payer = randomUUID();
  const payerEmail = `refund-${payer}@example.invalid`;
  const payerPassword = randomBytes(24).toString('base64url');
  sql(
    `INSERT INTO identity.users(id,email,full_name,role,password_hash) VALUES('${payer}','${payerEmail}','Refund payer','ADMIN','!unprovisioned');`,
  );
  const provisioned = spawnSync(
    'dotnet',
    [
      'run',
      '--project',
      'src/FloraBot.Api',
      '--no-build',
      '--no-launch-profile',
      '--',
      'provision-user',
      payer,
      payerEmail,
    ],
    {
      cwd: getBackendRoot(),
      input: payerPassword + '\n',
      encoding: 'utf8',
      windowsHide: true,
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
        DATABASE_URL:
          'Host=localhost;Port=55436;Database=florabot_browser_tests;Username=florabot;Password=local-florabot-only',
      },
    },
  );
  expect(provisioned.status).toBe(0);
  await page.goto('/admin/login');
  await loginAdminWithPacing(page, payerEmail, payerPassword);
  await page.goto('/admin/refunds');
  const refunds = page.locator('.admin-refunds');
  await refunds.getByText(`Đơn BROWSER-${order} · 350.000 đ`, { exact: true }).click();
  await refunds.getByRole('button', { name: 'Xem tài khoản nhận hoàn', exact: true }).click();
  await expect(refunds.getByText('001234567890', { exact: true })).toBeVisible();
  await refunds.getByRole('button', { name: 'Ghi nhận đã chi hoàn', exact: true }).click();
  await uploadEvidence(refunds);
  await refunds.getByRole('checkbox').check();
  await refunds.getByRole('button', { name: 'Kiểm tra chứng từ hoàn' }).click();
  await refunds.getByRole('button', { name: 'Xác nhận khoản hoàn' }).click();
  await expect(
    refunds.getByRole('status').filter({ hasText: 'Đã ghi nhận chi hoàn và cập nhật sổ cái.' }),
  ).toBeVisible();
  expect(
    sql(
      `SELECT count(*) FROM payment.payments WHERE order_id='${order}' AND kind='REFUND' AND status='SUCCEEDED' AND paid_by='${payer}' AND approved_by <> paid_by;`,
    ),
  ).toBe('1');
  expect(
    sql(
      `SELECT status || '|' || (refund_bank_name IS NULL AND refund_bank_holder IS NULL AND refund_bank_account_enc IS NULL)::text FROM ordering.orders WHERE id='${order}';`,
    ),
  ).toBe('REFUNDED|true');
  expect(
    sql(
      `SELECT count(*)::text || '|' || sum(amount)::text FROM payment.ledger_entries WHERE ref_type='REFUND' AND ref_id IN(SELECT id FROM payment.payments WHERE order_id='${order}' AND kind='REFUND');`,
    ),
  ).toBe('2|0');
  expect(
    sql(
      `SELECT count(*) FROM notify.audit_logs WHERE action='REFUND_BANK_VIEWED' AND actor_id='${payer}' AND entity_id IN(SELECT id FROM payment.payments WHERE order_id='${order}' AND kind='REFUND');`,
    ),
  ).toBe('1');
});

test('Public complaint creates exactly one dispute and evidence record through the real API', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const order = randomUUID();
  // Completed order is an isolated fixture; this case exercises after-sale handling, not payment.
  const token = sql(`
    INSERT INTO ordering.orders(id,order_code,checkout_id,seller_id,kiosk_id,status,subtotal,total_amount,tracking_token,completed_at)
    VALUES('${order}','BROWSER-${order}','${randomUUID()}','20000000-0000-0000-0000-000000000001','40000000-0000-0000-0000-000000000001','COMPLETED',350000,350000,flow.new_tracking_token(),public.app_now());
    SELECT tracking_token FROM ordering.orders WHERE id='${order}';
  `);
  const denied = await page.request.post('/api/receipts/flows/open_dispute', {
    data: {
      p_order: order,
      p_tracking: '!!!!!!!!',
      p_reason: 'Hoa bị dập khi nhận tại tủ.',
      p_photo: 'https://example.invalid/browser-complaint.jpg',
    },
  });
  expect(denied.status()).toBe(404);
  await page.goto(`/receipt#order=${order}&token=${token}`);
  await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
  await page.getByRole('button', { name: 'Gửi phản ánh về hoa' }).click();
  await page.getByLabel('Vấn đề với bó hoa').fill('Hoa bị dập khi nhận tại tủ.');
  await uploadEvidence(page.locator('main'));
  await page.getByRole('button', { name: 'Kiểm tra phản ánh', exact: true }).click();
  const submitted = page.waitForRequest((request) =>
    request.url().endsWith('/api/receipts/flows/open_dispute'),
  );
  await page.getByRole('button', { name: 'Xác nhận gửi phản ánh' }).click();
  const photoReference = (await submitted).postDataJSON().p_photo;
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã ghi nhận phản ánh cho đơn này.' }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Xem biên nhận', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã ghi nhận phản ánh cho đơn này.' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Gửi phản ánh về hoa' })).toHaveCount(0);
  expect(
    sql(
      `SELECT count(*) FROM ordering.disputes WHERE order_id='${order}' AND kind='COMPLAINT' AND status='OPEN' AND reported_by IS NULL;`,
    ),
  ).toBe('1');
  expect(
    sql(
      `SELECT count(*) FROM notify.attachments a JOIN ordering.disputes d ON a.owner_id=d.id WHERE d.order_id='${order}' AND a.owner_type='dispute' AND a.file_url LIKE 'https://res.cloudinary.com/browser-fixture/image/authenticated/%' AND a.size_bytes=${evidencePng.length};`,
    ),
  ).toBe('1');
  const repeated = await page.request.post('/api/receipts/flows/open_dispute', {
    data: {
      p_order: order,
      p_tracking: token,
      p_reason: 'Thử gửi phản ánh lần hai.',
      p_photo: photoReference,
    },
  });
  expect(repeated.status()).toBe(409);
  expect(repeated.headers()['cache-control']).toBe('no-store');

  const admin = randomUUID();
  const email = `complaint-${admin}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  sql(`
    INSERT INTO payment.payments(kind,purpose,checkout_id,gateway,idempotency_key,amount,status,paid_at)
    SELECT 'CHARGE','ORDER_CHECKOUT',checkout_id,'MANUAL','browser-complaint-${order}',350000,'SUCCEEDED',public.app_now() FROM ordering.orders WHERE id='${order}';
    INSERT INTO identity.users(id,email,full_name,role,password_hash) VALUES('${admin}','${email}','Complaint reviewer','ADMIN','!unprovisioned');
  `);
  const provisioned = spawnSync(
    'dotnet',
    [
      'run',
      '--project',
      'src/FloraBot.Api',
      '--no-build',
      '--no-launch-profile',
      '--',
      'provision-user',
      admin,
      email,
    ],
    {
      cwd: getBackendRoot(),
      input: password + '\n',
      encoding: 'utf8',
      windowsHide: true,
      env: {
        ...process.env,
        ASPNETCORE_ENVIRONMENT: 'Development',
        DATABASE_URL:
          'Host=localhost;Port=55436;Database=florabot_browser_tests;Username=florabot;Password=local-florabot-only',
      },
    },
  );
  expect(provisioned.status).toBe(0);
  await page.goto('/admin/login');
  await loginAdminWithPacing(page, email, password);
  await page.goto('/admin/complaints');
  const section = page.locator('.admin-complaints');
  await section.getByText(`Đơn BROWSER-${order}`, { exact: true }).click();
  await section.getByLabel('Số tiền đề nghị hoàn (đồng)').fill('100000');
  await section
    .getByLabel('Lý do và căn cứ xử lý')
    .fill('Đã đối chiếu ảnh khách và thông tin đơn.');
  await section.getByRole('button', { name: 'Kiểm tra quyết định' }).click();
  await section.getByRole('button', { name: 'Xác nhận quyết định' }).click();
  await expect(section.getByRole('status')).toContainText('Đã ghi nhận quyết định');
  expect(
    sql(`SELECT status FROM ordering.disputes WHERE order_id='${order}' AND kind='COMPLAINT';`),
  ).toBe('RESOLVED_REFUND');
  expect(
    sql(
      `SELECT count(*) FROM payment.payments WHERE order_id='${order}' AND kind='REFUND' AND amount=100000 AND status='PENDING' AND approved_by='${admin}' AND paid_at IS NULL;`,
    ),
  ).toBe('1');
  await section.getByLabel('Trạng thái phản ánh').selectOption('RESOLVED_REFUND');
  await section.getByText(`Đơn BROWSER-${order}`, { exact: true }).click();
  await expect(section.getByRole('heading', { name: 'Đã duyệt hoàn 100.000 đ' })).toBeVisible();

  const txn = `reconciliation-${randomUUID()}`;
  sql(`INSERT INTO payment.payments(kind,purpose,checkout_id,gateway,gateway_txn_id,idempotency_key,amount,status,paid_at)
    VALUES('CHARGE','ORDER_CHECKOUT','${randomUUID()}','PAYOS','${txn}','${txn}',100000,'SUCCEEDED','2003-03-02 12:00:00+07');`);
  const ledgerBefore = sql(
    'SELECT count(*) || chr(124) || coalesce(sum(amount),0) FROM payment.ledger_entries;',
  );
  await page.goto('/admin/reconciliation');
  const reconciliation = page.locator('.admin-reconciliation');
  await reconciliation.getByLabel('Ngày đối soát (giờ Việt Nam)').fill('2003-03-02');
  await reconciliation.getByRole('button', { name: 'Xem báo cáo ngày' }).click();
  await expect(
    reconciliation.getByRole('heading', { name: 'Báo cáo ngày 2003-03-02' }),
  ).toBeVisible();
  await reconciliation
    .getByLabel('Nội dung sao kê JSON')
    .fill(JSON.stringify([{ txn, amount: 120000 }]));
  await reconciliation.getByRole('button', { name: 'Kiểm tra sao kê', exact: true }).click();
  await reconciliation.getByRole('button', { name: 'Đối soát sao kê đã kiểm tra' }).click();
  await expect(reconciliation.getByRole('status')).toHaveText('Có 1 chênh lệch cần kiểm tra.');
  await expect(reconciliation.getByRole('heading', { name: 'Số tiền chưa khớp' })).toBeVisible();
  expect(
    sql(
      `SELECT payload->>'matched' || chr(124) || (payload->>'diff') FROM notify.audit_logs WHERE action='RECONCILED' AND actor_id='${admin}' AND payload->>'date'='2003-03-02';`,
    ),
  ).toBe('0|1');
  expect(
    sql(
      `SELECT count(*) FROM notify.audit_logs WHERE action='RECONCILED_DAILY' AND actor_id='${admin}' AND payload->>'date'='2003-03-02';`,
    ),
  ).toBe('1');
  expect(
    sql('SELECT count(*) || chr(124) || coalesce(sum(amount),0) FROM payment.ledger_entries;'),
  ).toBe(ledgerBefore);
  expect(sql(`SELECT amount FROM payment.payments WHERE gateway_txn_id='${txn}';`)).toBe('100000');
  const large = await page.request.post('/api/admin/flows/reconcile_gateway', {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      p_date: '2003-03-02',
      p_statement: Array.from({ length: 5000 }, (_, index) => ({
        txn: `large-statement-${index}`,
        amount: 100,
      })),
    },
  });
  expect(large.status()).toBe(200);
  expect(((await large.json()) as { result: unknown[] }).result).toHaveLength(5001);
  const tooLarge = await page.request.post('/api/admin/flows/reconcile_gateway', {
    headers: { Origin: new URL(page.url()).origin },
    data: {
      p_date: '2003-03-02',
      p_statement: [{ txn: 'x'.repeat(8 * 1024 * 1024), amount: 100 }],
    },
  });
  expect(tooLarge.status()).toBe(413);
  const ordinaryLimit = await page.request.post('/api/admin/flows/reconcile_daily', {
    headers: { Origin: new URL(page.url()).origin },
    data: { p_date: '2003-03-02', extra: 'x'.repeat(70000) },
  });
  expect(ordinaryLimit.status()).toBe(413);
});

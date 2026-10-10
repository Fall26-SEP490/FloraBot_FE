import { expect, test } from '@playwright/test';
import { createHash, randomBytes, randomInt, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { getBackendRoot } from './helpers';

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
    { cwd: getBackendRoot(), input, encoding: 'utf8', windowsHide: true },
  );
  expect(result.status, 'Disposable database fixture/check succeeds').toBe(0);
  return result.stdout.trim();
}

test('Real OTP, private history and confirmed identity erasure revoke the session', async ({
  page,
}) => {
  const kiosk = randomUUID();
  const key = randomBytes(24).toString('hex');
  const phone = `039${randomInt(1000000, 10000000)}`;
  const order = randomUUID();
  const customer = sql(`
    INSERT INTO kiosk_ops.kiosks(id,code,name,address,region,hardware_id,mqtt_client_id,status,last_heartbeat_at,api_key_hash)
    VALUES('${kiosk}','${kiosk}','Privacy fixture','Test','Test','${kiosk}','${kiosk}','ONLINE',public.app_now(),'${createHash('sha256').update(key).digest('hex')}');
    SELECT flow.customer_by_phone('${phone}');
  `);
  sql(`UPDATE identity.users SET loyalty_points=1234 WHERE id='${customer}';
    INSERT INTO ordering.orders(id,order_code,checkout_id,customer_id,seller_id,kiosk_id,status,subtotal,total_amount,tracking_token)
    VALUES('${order}','PRIVACY-${order}','${randomUUID()}','${customer}','20000000-0000-0000-0000-000000000001','${kiosk}','CANCELLED',100000,100000,flow.new_tracking_token());`);
  await page.addInitScript(
    (device) => sessionStorage.setItem('florabot-device', JSON.stringify(device)),
    { id: kiosk, key },
  );
  await page.goto('http://127.0.0.1:5184/');
  await page.locator('.customer-login summary').click();
  await page.getByLabel('Số điện thoại', { exact: true }).fill(phone);
  const issued = page.waitForResponse(
    (response) => response.url().endsWith('/otp/request') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Gửi mã xác thực', exact: true }).click();
  const otp = (await (await issued).json()) as { developmentCode: string };
  expect(otp.developmentCode).toMatch(/^\d{6}$/);
  await page.getByLabel('Mã xác thực', { exact: true }).fill(otp.developmentCode);
  const verified = page.waitForResponse((response) => response.url().endsWith('/otp/verify'));
  await page.getByRole('button', { name: 'Xác nhận đăng nhập' }).click();
  const session = (await (await verified).json()) as { accessToken: string };
  await page.getByRole('button', { name: 'Lịch sử mua và thông tin cá nhân' }).click();
  await page.getByRole('button', { name: 'Xem lịch sử mua' }).click();
  await expect(page.getByText(`Đơn PRIVACY-${order}`, { exact: true })).toBeVisible();
  await expect(page.getByText('1.234 điểm', { exact: true })).toBeVisible();
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain(phone);
  await page.getByRole('button', { name: 'Tìm hiểu và yêu cầu xóa' }).click();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Xác nhận xóa và kết thúc phiên' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã xóa thông tin định danh' }),
  ).toBeVisible();
  await expect(page.locator('.customer-login')).toBeVisible();
  expect(
    sql(
      `SELECT status||chr(124)||loyalty_points||chr(124)||(phone IS NULL)::text FROM identity.users WHERE id='${customer}';`,
    ),
  ).toBe('DISABLED|0|true');
  expect(
    sql(`SELECT count(*) FROM ordering.orders WHERE id='${order}' AND customer_id='${customer}';`),
  ).toBe('1');
  expect(
    sql(
      `SELECT count(*) FROM notify.audit_logs WHERE action='CUSTOMER_FORGOTTEN' AND actor_id='${customer}' AND entity_id='${customer}';`,
    ),
  ).toBe('1');
  const revoked = await page.request.get(
    `http://127.0.0.1:5184/api/kiosks/${kiosk}/customer/history`,
    { headers: { Authorization: `Bearer ${session.accessToken}` } },
  );
  expect(revoked.status()).toBe(401);
  expect(revoked.headers()['cache-control']).toBe('no-store');
});

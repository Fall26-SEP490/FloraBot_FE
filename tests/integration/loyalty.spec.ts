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

test('Real mixed basket, points, gift message and pickup recovery through the kiosk', async ({
  page,
}) => {
  const kiosk = randomUUID();
  const key = randomBytes(24).toString('hex');
  const seller = randomUUID();
  const product = randomUUID();
  const slot = randomUUID();
  const accessory = randomUUID();
  const phone = `038${randomInt(1000000, 10000000)}`;
  const customer = sql(`SELECT flow.customer_by_phone('${phone}');`);
  sql(`
    UPDATE identity.users SET loyalty_points=20000 WHERE id='${customer}';
    INSERT INTO kiosk_ops.kiosks(id,code,name,address,region,hardware_id,mqtt_client_id,status,last_heartbeat_at,api_key_hash)
    VALUES('${kiosk}','${kiosk}','Loyalty fixture','Test','Test','${kiosk}','${kiosk}','ONLINE',public.app_now(),'${createHash('sha256').update(key).digest('hex')}');
    INSERT INTO identity.sellers(id,shop_name,phone,status,package_id,package_expires_at)
    VALUES('${seller}','Loyalty fixture','0901112233','ACTIVE','20000000-0000-0000-0000-00000000000a',CURRENT_DATE+30);
    INSERT INTO catalog.flower_products(id,seller_id,name,price,shelf_life_hours,status)
    VALUES('${product}','${seller}','Bó cúc thử nghiệm',150000,48,'ACTIVE');
    INSERT INTO kiosk_ops.slots(id,kiosk_id,slot_code,relay_channel) VALUES('${slot}','${kiosk}','A01',0);
    INSERT INTO kiosk_ops.accessories(id,seller_id,kiosk_id,name,price,stock_quantity) VALUES('${accessory}','${seller}','${kiosk}','Nơ thử nghiệm',25000,5);
    SELECT flow.assign_slot('${slot}','${seller}','10000000-0000-0000-0000-000000000001');
    SELECT flow.stock_bouquet(flow.new_batch(),'${product}','${slot}','10000000-0000-0000-0000-000000000001','${product}');
  `);
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
  await page.getByRole('button', { name: 'Xác nhận đăng nhập' }).click();
  const balanceResponse = page.waitForResponse((response) =>
    response.url().endsWith('/customer/points'),
  );
  await page.getByRole('button', { name: 'Xem điểm có thể dùng' }).click();
  expect((await balanceResponse).headers()['cache-control']).toBe('no-store');
  await expect(page.getByText('Bạn có 20.000 điểm. Mỗi điểm giảm 1 đồng.')).toBeVisible();
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Xem phụ kiện tại tủ' }).click();
  await page.getByLabel('Số lượng Nơ thử nghiệm').fill('2');
  await page.getByLabel('Số điểm muốn dùng').fill('12000');
  const card = 'Tặng mẹ một ngày thật vui 🌼';
  await page.getByLabel('Lời nhắn tặng hoa (không bắt buộc)').fill(card);
  const created = page.waitForResponse((response) =>
    response.url().endsWith('/flows/kiosk_checkout'),
  );
  await page.getByRole('button', { name: 'Giữ hoa và thanh toán' }).click();
  const result = await created;
  expect(result.status()).toBe(200);
  expect(result.request().postDataJSON().p_points).toBe(12000);
  expect(result.request().postDataJSON().p_accessories).toEqual([{ id: accessory, qty: 2 }]);
  expect(result.request().postDataJSON().p_ecard).toBe(card);
  await expect(page.locator('.total')).toContainText('188.000');
  await expect(page.locator('.receipts')).toContainText('Đã dùng 12.000 điểm');
  await expect(page.locator('.receipts')).toContainText('Giảm 12.000');
  expect(sql(`SELECT loyalty_points FROM identity.users WHERE id='${customer}';`)).toBe('8000');
  expect(
    sql(
      `SELECT subtotal||chr(124)||discount_amount||chr(124)||total_amount||chr(124)||points_redeemed FROM ordering.orders WHERE customer_id='${customer}';`,
    ),
  ).toBe('200000|12000|188000|12000');
  expect(
    sql(
      `SELECT amount FROM payment.payments WHERE checkout_id IN (SELECT checkout_id FROM ordering.orders WHERE customer_id='${customer}');`,
    ),
  ).toBe('188000');
  expect(sql(`SELECT stock_quantity FROM kiosk_ops.accessories WHERE id='${accessory}';`)).toBe(
    '3',
  );
  expect(sql(`SELECT ecard_content FROM ordering.orders WHERE customer_id='${customer}';`)).toBe(
    card,
  );
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain(phone);
  await page.getByRole('button', { name: 'Kết thúc lượt mua' }).click();
  await expect(page.locator('.receipts')).toHaveCount(0);
  await expect(page.locator('.point-redemption')).toHaveCount(0);
  await expect(page.getByLabel('Lời nhắn tặng hoa (không bắt buộc)')).toHaveValue('');

  // Local payment fixture only; no provider charge or connected physical device.
  sql(`UPDATE kiosk_ops.kiosks SET status='OFFLINE' WHERE id='${kiosk}';
    SELECT flow.checkout_paid((SELECT checkout_id FROM ordering.orders WHERE customer_id='${customer}'),'pickup-fixture-${kiosk}',true,188000);
    UPDATE kiosk_ops.kiosks SET status='ONLINE',last_heartbeat_at=public.app_now() WHERE id='${kiosk}';`);
  expect(sql(`SELECT status FROM ordering.orders WHERE customer_id='${customer}';`)).toBe('PAID');
  expect(sql(`SELECT count(*) FROM kiosk_ops.unlock_tokens WHERE kiosk_id='${kiosk}';`)).toBe('0');
  const [orderId, trackingToken] = sql(
    `SELECT id||chr(124)||tracking_token FROM ordering.orders WHERE customer_id='${customer}';`,
  ).split('|');
  await page.getByRole('button', { name: 'Đã thanh toán nhưng chưa nhận hoa?' }).click();
  await page.getByLabel('ID biên nhận', { exact: true }).fill(orderId);
  await page.getByLabel('Mã biên nhận (8 ký tự)').fill(trackingToken);
  await page.getByRole('button', { name: 'Kiểm tra thông tin' }).click();
  const pickup = page.waitForResponse((response) =>
    response.url().endsWith('/flows/request_pickup'),
  );
  await page.getByRole('button', { name: 'Yêu cầu mở ô nhận hoa' }).click();
  const pickupResult = await pickup;
  expect(pickupResult.status()).toBe(200);
  expect(pickupResult.headers()['cache-control']).toBe('no-store');
  await expect(page.getByRole('status')).toContainText('Đã tiếp nhận yêu cầu mở ô');
  expect(sql(`SELECT status FROM ordering.orders WHERE customer_id='${customer}';`)).toBe(
    'DISPENSING',
  );
  expect(
    sql(
      `SELECT count(*) FROM kiosk_ops.unlock_tokens WHERE kiosk_id='${kiosk}' AND status='ISSUED';`,
    ),
  ).toBe('1');
  expect(
    sql(
      `SELECT amount FROM payment.payments WHERE checkout_id IN (SELECT checkout_id FROM ordering.orders WHERE customer_id='${customer}');`,
    ),
  ).toBe('188000');
  expect(
    await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage })),
  ).not.toContain(trackingToken);
});

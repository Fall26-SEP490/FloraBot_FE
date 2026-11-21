import { expect, test } from '@playwright/test';
import { chooseOption } from '../fixtures/select';
import { setupSellerUsability, sampleRequest, shopId, kioskId } from '../fixtures/seller-usability';

test('seller enters loading OTP on web before confirming the preorder bouquet', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await setupSellerUsability(page);
  const row = {
    ...sampleRequest,
    state: 'ORDERED',
    orderStatus: 'PAID',
    orderCode: 'FB-OTP',
    quotedPrice: 350000,
  };
  await page.route(`**/api/sellers/${shopId}/preorders?*`, (route) =>
    route.fulfill({ json: { items: [row], page: 1, hasMore: false } }),
  );
  await page.route(`**/api/me/kiosks/${kioskId}/slots`, (route) =>
    route.fulfill({
      json: [
        {
          id: 'slot-p',
          kioskId,
          slotCode: 'P01',
          zone: 'PREORDER',
          status: 'RENTED_EMPTY',
          sensorReady: true,
        },
      ],
    }),
  );
  await page.route(`**/api/me/preorders/${row.id}/loading-access`, (route) => {
    expect(route.request().postDataJSON()).toEqual({ slotId: 'slot-p' });
    return route.fulfill({
      json: {
        id: 'otp-loading',
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
        resendAfterSeconds: 30,
        requiresCode: true,
      },
    });
  });
  let confirmations = 0;
  await page.route('**/api/me/maintenance-access/otp-loading/confirm', (route) => {
    confirmations++;
    expect(route.request().postDataJSON()).toEqual({ code: '012345' });
    return route.fulfill({
      json: { status: 'ACCEPTED', expiresAt: new Date(Date.now() + 300_000).toISOString() },
    });
  });
  await page.goto('/seller/orders');
  await page.locator(`#preorder-${row.id} > summary > span`).last().click();
  await page.getByRole('button', { name: 'Nạp hoa cho đơn này', exact: true }).click();
  await chooseOption(page.getByLabel('Ô trống tại tủ nhận'), 'slot-p');
  await page.getByLabel('Mã định danh bó hoa').fill('BOUQUET-OTP');
  await page.getByRole('button', { name: 'Tiếp tục kiểm tra' }).click();
  const finish = page.getByRole('button', { name: 'Xác nhận nạp hoa', exact: true });
  await expect(finish).toBeDisabled();
  await page.getByRole('button', { name: 'Yêu cầu mở ô', exact: true }).click();
  await expect(finish).toBeDisabled();
  await page.getByLabel('Mã OTP 6 số').fill('012345');
  await page.getByRole('button', { name: 'Xác nhận mở ô', exact: true }).click();
  await expect(page.getByText('Đã gửi lệnh mở ô. Chờ tủ phản hồi.')).toBeVisible();
  await expect(finish).toBeEnabled();
  expect(confirmations).toBe(1);
});

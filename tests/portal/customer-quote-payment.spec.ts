import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mockPayos } from './payos.fixture';
const id = '70000000-0000-0000-0000-000000000001';
const makeRow = () => ({
  id,
  kind: 'CUSTOM',
  state: 'QUOTED',
  productId: 'p1',
  sellerId: 's1',
  kioskId: 'k1',
  instructions: 'Hoa hồng pastel, ngân sách 400000 đồng',
  pickupAt: '2030-11-10T03:00:00Z',
  pickupBefore: '2030-11-10T05:00:00Z',
  quotedPrice: 380000 as number | null,
  quoteVersion: undefined as number | undefined,
  quoteNote: 'Giá gồm hoa và phụ kiện, tông pastel.',
  quoteExpiresAt: '2030-11-09T03:00:00Z',
  orderId: null as string | null,
  checkoutId: null,
  orderCode: 'FB-QUOTE',
  orderStatus: null as string | null,
  trackingToken: null,
  ready: false,
  payBefore: '2030-11-09T05:00:00Z',
  productName: 'Bó hoa pastel',
  shopName: 'Tiệm Hoa An Nhiên',
  kioskName: 'Kiosk Nguyễn Huệ',
  address: '12 Nguyễn Huệ, TP.HCM',
});
async function fixture(page: Page) {
  const state = {
    row: makeRow(),
    acceptStatus: 200,
    acceptErrorDetail: 'Shop vừa cập nhật báo giá. Hãy kiểm tra lại.',
    writes: [] as { path: string; body: unknown }[],
  };
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') {
      state.writes.push({ path, body: route.request().postDataJSON() });
      if (path.endsWith('/accept')) {
        if (state.acceptStatus !== 200)
          return route.fulfill({
            status: state.acceptStatus,
            json: { detail: state.acceptErrorDetail },
          });
        state.row = {
          ...state.row,
          state: 'ORDERED',
          orderStatus: 'AWAITING_PAYMENT',
          orderId: 'order-1',
        };
        return route.fulfill({ json: { result: id } });
      }
      return route.abort();
    }
    if (path === '/api/auth/me')
      return route.fulfill({ json: { id: 'customer', name: 'Minh Anh', role: 'CUSTOMER' } });
    if (path === '/api/member/preorders')
      return route.fulfill({ json: { items: [state.row], page: 1, hasMore: false } });
    if (path === '/api/member/kiosk-applications/current')
      return route.fulfill({ status: 404, json: {} });
    if (path === '/api/member/profile') return route.fulfill({ json: { loyaltyPoints: 0 } });
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  return state;
}
for (const width of [390, 1440]) {
  test(`Customer reviews exact quote and explicitly accepts before seeing payOS payment at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    const state = await fixture(page);
    const original = {
      price: state.row.quotedPrice,
      pickupAt: state.row.pickupAt,
      note: state.row.quoteNote,
    };
    await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
    const quote = page.getByRole('region', { name: 'Báo giá của shop', exact: true });
    await expect(quote).toContainText('380.000 đ');
    await expect(quote).toContainText(state.row.address);
    await expect(quote).toContainText('Phản hồi báo giá trước');
    await expect(quote).toContainText(state.row.quoteNote);
    await expect(page.getByRole('button', { name: 'Thanh toán ngay', exact: true })).toHaveCount(0);
    await page.getByRole('button', { name: 'Xác nhận báo giá', exact: true }).click();
    const submit = page.getByRole('button', { name: 'Đồng ý báo giá', exact: true });
    await expect(submit).toBeDisabled();
    const confirmation = page.locator('.order-action-card[data-action="accept"]');
    await expect(confirmation).toHaveCSS('border-top-width', '0px');
    await expect(confirmation.locator('.payout-checkbox')).toHaveCSS('border-top-width', '0px');
    await page.getByRole('button', { name: 'Quay lại', exact: true }).click();
    await expect(confirmation).toHaveCount(0);
    expect(state.writes).toEqual([]);
    await page.getByRole('button', { name: 'Xác nhận báo giá', exact: true }).click();
    await expect(submit).toBeDisabled();
    await page
      .getByRole('checkbox', { name: 'Tôi đồng ý với giá, ghi chú và lịch nhận của shop.' })
      .check();
    await expect(submit).toBeEnabled();
    await quote.scrollIntoViewIfNeeded();
    expect(
      (
        await new AxeBuilder({ page })
          .include('#web-orders')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: test.info().outputPath(`quote-${width}.png`) });
    await submit.click();
    await expect(
      page.getByRole('region', { name: 'Thông tin thanh toán', exact: true }),
    ).toContainText('Số tiền cần thanh toán');
    await expect(
      page.getByRole('region', { name: 'Thông tin thanh toán', exact: true }),
    ).toContainText('thanh toán qua PayOS ngay tại đây');
    await expect(page.getByRole('button', { name: 'Thanh toán ngay', exact: true })).toBeEnabled();
    expect(state.writes).toEqual([{ path: `/api/member/preorders/${id}/accept`, body: original }]);
  });
}
test('A quote that expires during review cannot be accepted', async ({ page }) => {
  await page.clock.install({ time: new Date('2030-11-09T02:59:00Z') });
  const state = await fixture(page);
  await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
  await page.getByRole('button', { name: 'Xác nhận báo giá', exact: true }).click();
  await page
    .getByRole('checkbox', { name: 'Tôi đồng ý với giá, ghi chú và lịch nhận của shop.' })
    .check();
  await page.clock.fastForward(70_000);
  await expect(page.getByRole('button', { name: 'Đồng ý báo giá', exact: true })).toBeDisabled();
  await expect(page.getByRole('region', { name: 'Báo giá của shop', exact: true })).toContainText(
    'Báo giá đã hết hạn',
  );
  expect(state.writes).toEqual([]);
});
test('Missing quote amount is never displayed or accepted as zero', async ({ page }) => {
  const state = await fixture(page);
  state.row.quotedPrice = null;
  await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
  const quote = page.getByRole('region', { name: 'Báo giá của shop', exact: true });
  await expect(quote).toContainText('Chưa có báo giá');
  await expect(quote).toContainText('chưa có số tiền hợp lệ');
  await expect(page.getByRole('button', { name: 'Xác nhận báo giá', exact: true })).toBeDisabled();
  expect(state.writes).toEqual([]);
});
test('Changed quote returns a clear conflict and does not create a payment link', async ({
  page,
}) => {
  const state = await fixture(page);
  state.acceptStatus = 409;
  await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
  await page.getByRole('button', { name: 'Xác nhận báo giá', exact: true }).click();
  await page
    .getByRole('checkbox', { name: 'Tôi đồng ý với giá, ghi chú và lịch nhận của shop.' })
    .check();
  await page.getByRole('button', { name: 'Đồng ý báo giá', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Shop vừa cập nhật báo giá' }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].path).toMatch(/\/accept$/);
  await expect(page.getByRole('button', { name: 'Thanh toán ngay', exact: true })).toHaveCount(0);
});
for (const paid of [false, true]) {
  test(`payOS return uses BE ${paid ? 'PAID' : 'AWAITING_PAYMENT'} status rather than URL success`, async ({
    page,
  }) => {
    const state = await fixture(page);
    state.row = {
      ...state.row,
      state: 'ORDERED',
      orderId: 'order-1',
      orderStatus: paid ? 'PAID' : 'AWAITING_PAYMENT',
    };
    await page.goto(`/tai-khoan?requestId=${id}&paymentReturn=1&status=PAID#web-orders`);
    const banner = page.getByRole('status').filter({ hasText: 'Đã trở về từ payOS.' });
    await expect(banner).toContainText(
      paid ? 'Thanh toán đã được hệ thống xác nhận' : 'Hệ thống chưa xác nhận thanh toán',
    );
    await expect(page.getByRole('button', { name: 'Thanh toán ngay', exact: true })).toHaveCount(
      paid ? 0 : 1,
    );
    expect(state.writes).toEqual([]);
  });
}
test('An expired payment has an explanation and no enabled payment action', async ({ page }) => {
  const state = await fixture(page);
  state.row = {
    ...state.row,
    state: 'ORDERED',
    orderId: 'order-1',
    orderStatus: 'AWAITING_PAYMENT',
    payBefore: '2020-01-01T00:00:00Z',
  };
  await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
  await expect(
    page.getByRole('region', { name: 'Thông tin thanh toán', exact: true }),
  ).toContainText('Đã hết hạn thanh toán');
  await expect(page.getByRole('button', { name: 'Thanh toán ngay', exact: true })).toBeDisabled();
  const notice = page.locator('[data-tone="danger"]').filter({ hasText: 'Đã hết hạn thanh toán' });
  await expect(notice).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expect(page.getByText('Đã hết hạn thanh toán', { exact: true })).toHaveCount(1);
  await page.screenshot({
    path: test.info().outputPath('plain-expired-status.png'),
    fullPage: true,
  });
  expect(state.writes).toEqual([]);
});

test('Checking an expired QR reports a fresh verification time', async ({ page }) => {
  const state = await fixture(page);
  state.row = {
    ...state.row,
    state: 'ORDERED',
    orderId: 'order-expiring',
    orderStatus: 'AWAITING_PAYMENT',
  };
  await page.route(`**/api/member/preorders/${id}/payment-link`, (route) =>
    route.fulfill({
      json: {
        checkoutUrl: 'https://pay.payos.vn/web/expiring',
        orderCode: 123456,
        amount: 360000,
        qrCode: '000201TEST',
      },
    }),
  );
  await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
  await page.getByRole('button', { name: 'Thanh toán ngay', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Thanh toán đơn hoa' });
  await expect(dialog.getByRole('img', { name: 'Mã QR thanh toán PayOS' })).toBeVisible();
  state.row.payBefore = '2020-01-01T00:00:00Z';
  await dialog.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click();
  await expect(dialog.getByText(/Đã kiểm tra lúc/)).toBeVisible();
  await expect(dialog.getByText(/chưa ghi nhận thanh toán cho đơn hết hạn này/)).toBeVisible();
});

test('A refreshed quote cannot be confirmed with an older review snapshot', async ({ page }) => {
  const state = await fixture(page);
  state.row.quoteVersion = 1;
  await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
  await page.getByRole('button', { name: 'Xác nhận báo giá', exact: true }).click();
  await page
    .getByRole('checkbox', { name: 'Tôi đồng ý với giá, ghi chú và lịch nhận của shop.' })
    .check();
  state.row.quoteVersion = 2;
  await page.getByRole('button', { name: 'Tải lại đơn hàng', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Shop đã cập nhật báo giá trong lúc bạn xem' }),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đồng ý báo giá', exact: true })).toBeDisabled();
  expect(state.writes).toEqual([]);
});

test('An accessory stock conflict blocks confirmation until the shop sends a new quote', async ({
  page,
}) => {
  const state = await fixture(page);
  state.row.quoteVersion = 1;
  state.acceptStatus = 409;
  state.acceptErrorDetail = 'PREORDER_ACCESSORY_OUT_OF_STOCK';
  await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
  const review = page.getByRole('button', { name: 'Xác nhận báo giá', exact: true });
  await review.click();
  await page
    .getByRole('checkbox', { name: 'Tôi đồng ý với giá, ghi chú và lịch nhận của shop.' })
    .check();
  await page.getByRole('button', { name: 'Đồng ý báo giá', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Phụ kiện trong báo giá không còn đủ' }),
  ).toBeVisible();
  await expect(review).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Thanh toán ngay', exact: true })).toHaveCount(0);
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0].body).toMatchObject({ quoteVersion: 1 });
  state.row.quoteVersion = 2;
  await page.getByRole('button', { name: 'Tải lại đơn hàng', exact: true }).click();
  await expect(review).toBeEnabled();
  expect(state.writes).toHaveLength(1);
});

for (const width of [390, 1440]) {
  test(`One click opens bank QR payment without leaving FloraBot at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 900 });
    const state = await fixture(page);
    state.row = {
      ...state.row,
      state: 'ORDERED',
      orderId: 'order-1',
      orderStatus: 'AWAITING_PAYMENT',
    };
    await mockPayos(page);
    let links = 0;
    await page.route(`**/api/member/preorders/${id}/payment-link`, async (route) => {
      links++;
      await new Promise((resolve) => setTimeout(resolve, 650));
      return route.fulfill({
        json: {
          checkoutUrl: 'https://pay.payos.vn/web/test-order',
          orderCode: 123456,
          amount: 360000,
          qrCode: '000201010212TEST-BANK-QR',
          recipientName: 'TIEM HOA AN NHIEN',
          recipientAccountMasked: '******7766',
        },
      });
    });
    await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
    const originalUrl = page.url();
    await page.getByRole('button', { name: 'Thanh toán ngay', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Thanh toán đơn hoa' });
    await expect(dialog.getByRole('status').filter({ hasText: 'Đang tạo mã QR' })).toBeVisible();
    await expect(
      dialog.getByRole('img', { name: 'Mã QR thanh toán PayOS', exact: true }),
    ).toBeVisible();
    await expect(dialog).toContainText('360.000');
    if (width === 390) {
      for (const name of ['Kiểm tra trạng thái', 'Đóng']) {
        const bounds = await dialog.getByRole('button', { name, exact: true }).boundingBox();
        expect(bounds).not.toBeNull();
        expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(844);
      }
    }
    await expect(dialog).toContainText('TIEM HOA AN NHIEN · ******7766');
    const mobilePay = dialog.getByRole('link', { name: 'Thanh toán trên thiết bị này qua PayOS' });
    if (width === 390)
      await expect(mobilePay).toHaveAttribute('href', 'https://pay.payos.vn/web/test-order');
    else await expect(mobilePay).toHaveCount(0);
    await expect(page).toHaveURL(originalUrl);
    expect(page.context().pages()).toHaveLength(1);
    expect(links).toBe(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include('.payos-checkout-modal')
          .withTags(['wcag2a', 'wcag2aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`payos-${width}.png`) });
    let verificationError = false;
    await page.route('**/api/member/preorders?page=*', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (verificationError) return route.fulfill({ status: 503, json: {} });
      await route.fulfill({ json: { items: [state.row], page: 1, hasMore: false } });
    });
    await dialog.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click();
    await expect(dialog.getByRole('button', { name: 'Đang kiểm tra…' })).toBeDisabled();
    await expect(dialog.getByText(/đừng thanh toán lại/)).toBeVisible();
    expect(links).toBe(1);
    // Refresh never treats a client action as payment success.
    await expect(dialog).toBeVisible();
    if (width === 390) {
      verificationError = true;
      await dialog.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click();
      await expect(dialog.getByRole('alert')).toContainText('Chưa kiểm tra được giao dịch');
      verificationError = false;
    }
    state.row.orderStatus = 'PAID';
    await dialog
      .getByRole('button', {
        name: width === 390 ? 'Kiểm tra lại' : 'Kiểm tra trạng thái',
        exact: true,
      })
      .click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('Shop đang chuẩn bị hoa.', { exact: false })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thanh toán ngay', exact: true })).toHaveCount(0);
  });
}

test('Preorder cannot open a payment link while the seller channel is unavailable', async ({
  page,
}) => {
  const state = await fixture(page);
  state.row = {
    ...state.row,
    state: 'ORDERED',
    orderId: 'order-1',
    orderStatus: 'AWAITING_PAYMENT',
  };
  await page.route(`**/api/member/preorders/${id}/payment-link`, (route) =>
    route.fulfill({ status: 503, json: { detail: 'seller_channel_unavailable' } }),
  );
  await page.goto(`/tai-khoan?requestId=${id}#web-orders`);
  const pay = page.getByRole('button', { name: 'Thanh toán ngay', exact: true });
  await pay.click();
  const dialog = page.getByRole('dialog', { name: 'Thanh toán đơn hoa' });
  await expect(dialog.getByRole('alert')).toContainText('Kênh nhận tiền của shop chưa sẵn sàng');
  await expect(dialog.getByRole('button', { name: 'Kiểm tra trạng thái' })).toHaveCount(0);
  await expect(dialog.getByRole('link')).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(pay).toBeEnabled();
});

test('Payment callback resolves the exact preorder from shared browser storage', async ({
  page,
}) => {
  const state = await fixture(page);
  state.row = {
    ...state.row,
    state: 'ORDERED',
    orderId: 'order-1',
    orderStatus: 'AWAITING_PAYMENT',
  };
  await page.addInitScript((requestId) => {
    localStorage.setItem(
      'florabot-payment-return:customer',
      JSON.stringify([
        {
          code: '7654321',
          target: { kind: 'preorder', resourceId: requestId, page: 1 },
          savedAt: Date.now(),
        },
      ]),
    );
  }, id);
  await page.goto('/tai-khoan?orderCode=7654321&status=PAID');
  await expect(page).toHaveURL(new RegExp(`requestId=${id}.*#web-orders`));
  await expect(page.getByText(/Hệ thống chưa xác nhận thanh toán/)).toBeVisible();
  expect(state.writes).toEqual([]);
});

test('Payment callback with no saved transaction shows manual lookup without claiming success', async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto('/tai-khoan?orderCode=7654321&status=PAID');
  await expect(page.getByRole('main').getByRole('alert')).toContainText(
    'Trình duyệt này chưa lưu giao dịch',
  );
  await expect(page.getByRole('link', { name: 'Xem đơn đặt trước', exact: true })).toBeVisible();
  await expect(
    page.getByText('Thanh toán đã được hệ thống xác nhận', { exact: false }),
  ).toHaveCount(0);
  expect(state.writes).toEqual([]);
});

for (const qrCode of [null, 'https://pay.payos.vn/web/not-a-bank-qr']) {
  test(
    'Missing or non-bank QR retries inline without opening PayOS: ' + qrCode,
    async ({ page }) => {
      const state = await fixture(page);
      state.row = {
        ...state.row,
        state: 'ORDERED',
        orderId: 'order-1',
        orderStatus: 'AWAITING_PAYMENT',
      };
      let attempts = 0;
      await page.route('**/api/member/preorders/' + id + '/payment-link', (route) => {
        attempts++;
        return route.fulfill({
          json: {
            checkoutUrl: 'https://pay.payos.vn/web/test-order',
            orderCode: 123456,
            amount: 380000,
            qrCode: attempts === 1 ? qrCode : '000201RETRIED-BANK-QR',
          },
        });
      });
      await page.goto('/tai-khoan?requestId=' + id + '#web-orders');
      await page.getByRole('button', { name: 'Thanh toán ngay', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Thanh toán đơn hoa' });
      await expect(dialog.getByRole('alert')).toContainText('Chưa có mã VietQR');
      await expect(dialog.locator('svg.payos-qr-svg')).toHaveCount(0);
      await expect(dialog.getByRole('link')).toHaveCount(0);
      await dialog.getByRole('button', { name: 'Tải lại mã QR', exact: true }).click();
      await expect(dialog.getByRole('img', { name: 'Mã QR thanh toán PayOS' })).toBeVisible();
      expect(attempts).toBe(2);
      expect(page.context().pages()).toHaveLength(1);
      await dialog.getByRole('button', { name: 'Kiểm tra trạng thái', exact: true }).click();
      await expect(dialog).toBeVisible();
      expect(state.row.orderStatus).toBe('AWAITING_PAYMENT');
      await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
      expect(state.writes).toEqual([]);
    },
  );
}

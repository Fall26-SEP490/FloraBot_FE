import { expect, test, type Page } from '@playwright/test';

const pending = {
  id: 'pending-hcm',
  kioskId: 'hcm',
  status: 'PENDING_PAYMENT',
  price: 40000,
  periodFrom: '2027-11-08',
  periodTo: '2028-11-08',
};
async function fixture(page: Page, initialPending = true) {
  const state = {
    pending: initialPending,
    conflict: false,
    readError: false,
    paid: false,
    unsafeLink: false,
    qrCode: '000201TEST-RENEWAL-QR' as string | null,
    creates: 0,
    links: [] as string[],
  };
  await page.route('**/hub/**', (r) => r.abort());
  await page.route('**/api/**', (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path === '/api/auth/me')
      return r.fulfill({
        json: {
          id: 'renewal-user',
          role: 'SELLER',
          sellerId: 'shop',
          name: 'Test',
          sellerStatus: 'ACTIVE',
          packageExpiresAt: '2028-11-08',
        },
      });
    if (path === '/api/member/kiosk-applications/current')
      return r.fulfill({ status: 404, json: {} });
    if (path === '/api/me/kiosks')
      return r.fulfill({
        json: [
          { id: 'hcm', code: 'K-HCM', name: 'Kiosk HCM', status: 'OFFLINE', slotCount: 4 },
          { id: 'q1', code: 'K-Q1', name: 'Kiosk Q1', status: 'OFFLINE', slotCount: 2 },
        ],
      });
    if (path === '/api/sellers/shop/subscriptions')
      return state.readError
        ? r.fulfill({ status: 503, json: {} })
        : r.fulfill({
            json: {
              subscriptions: [
                {
                  id: 'active-hcm',
                  kioskId: 'hcm',
                  status: 'ACTIVE',
                  price: 40000,
                  periodFrom: '2026-11-08',
                  periodTo: '2027-11-08',
                },
                ...(state.pending
                  ? [{ ...pending, status: state.paid ? 'ACTIVE' : 'PENDING_PAYMENT' }]
                  : []),
              ],
            },
          });
    if (path === '/api/me/kiosks/hcm/renewals') {
      state.creates++;
      state.pending = true;
      return state.conflict
        ? r.fulfill({
            status: 409,
            json: { detail: 'Kiosk đã có yêu cầu gia hạn đang chờ thanh toán.' },
          })
        : r.fulfill({
            json: {
              subscriptionId: pending.id,
              kioskId: 'hcm',
              sellerId: 'shop',
              amount: 40000,
              periodFrom: pending.periodFrom,
              periodTo: pending.periodTo,
              status: 'PENDING_PAYMENT',
            },
          });
    }
    if (path.endsWith('/payment-link')) {
      state.links.push(path);
      return r.fulfill({
        json: {
          checkoutUrl: state.unsafeLink
            ? 'https://untrusted.example/pay'
            : 'https://pay.payos.vn/web/test-renewal',
          amount: 40000,
          orderCode: 123,
          qrCode: state.qrCode,
        },
      });
    }
    return r.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  return state;
}

test('Reload restores the pending kiosk renewal and pays its existing subscription', async ({
  page,
}) => {
  const state = await fixture(page);
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/seller/subscriptions');
  const card = page.getByRole('article', { name: 'Kiosk HCM', exact: true });
  await expect(card.getByRole('button', { name: 'Gia hạn thêm 12 tháng' })).toHaveCount(0);
  await expect(
    page
      .getByRole('article', { name: 'Kiosk Q1' })
      .getByRole('button', { name: 'Gia hạn thêm 12 tháng' }),
  ).toBeVisible();
  await page.reload();
  await card.getByRole('button', { name: 'Tiếp tục thanh toán' }).click();
  const dialog = page.getByRole('dialog', { name: 'Thanh toán gia hạn kiosk' });
  await expect(dialog.getByRole('img', { name: 'Mã QR thanh toán PayOS' })).toBeVisible();
  await expect(dialog.getByRole('link')).toHaveCount(0);
  expect(state.creates).toBe(0);
  expect(state.links).toEqual(['/api/sellers/shop/subscriptions/pending-hcm/payment-link']);
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(card.getByRole('button', { name: 'Tiếp tục thanh toán' })).toBeVisible();
  await card.getByRole('button', { name: 'Tiếp tục thanh toán' }).click();
  state.paid = true;
  await dialog.getByRole('button', { name: 'Kiểm tra thanh toán', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Gia hạn thêm 12 tháng' })).toBeVisible();
});

for (const conflict of [false, true]) {
  test(`Creation ${conflict ? 'conflict' : 'success'} reloads the authoritative pending renewal`, async ({
    page,
  }) => {
    const state = await fixture(page, false);
    state.conflict = conflict;
    await page.goto('/seller/subscriptions');
    const card = page.getByRole('article', { name: 'Kiosk HCM', exact: true });
    await card.getByRole('button', { name: 'Gia hạn thêm 12 tháng' }).click();
    await card.getByRole('button', { name: 'Tiếp tục thanh toán' }).click();
    await expect(page.getByRole('dialog', { name: 'Thanh toán gia hạn kiosk' })).toBeVisible();
    expect(state.creates).toBe(1);
    expect(state.links).toEqual(['/api/sellers/shop/subscriptions/pending-hcm/payment-link']);
  });
}

test('Unreadable subscriptions block duplicate creation and unsafe payment links are rejected', async ({
  page,
}) => {
  const state = await fixture(page);
  state.readError = true;
  await page.goto('/seller/subscriptions');
  const card = page.getByRole('article', { name: 'Kiosk HCM', exact: true });
  await expect(card.getByRole('button', { name: 'Gia hạn thêm 12 tháng' })).toBeDisabled();
  state.readError = false;
  await page.getByRole('button', { name: 'Tải lại kỳ thuê' }).click();
  state.unsafeLink = true;
  await card.getByRole('button', { name: 'Tiếp tục thanh toán' }).click();
  await expect(card.getByRole('alert')).toContainText('không thuộc cổng thanh toán');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(state.creates).toBe(0);
});

test('Missing renewal QR retries the same subscription without opening PayOS', async ({ page }) => {
  const state = await fixture(page);
  state.qrCode = null;
  await page.goto('/seller/subscriptions');
  await page
    .getByRole('article', { name: 'Kiosk HCM', exact: true })
    .getByRole('button', { name: 'Tiếp tục thanh toán' })
    .click();
  const dialog = page.getByRole('dialog', { name: 'Thanh toán gia hạn kiosk' });
  await expect(dialog.getByRole('alert')).toContainText('Chưa có mã VietQR');
  await expect(dialog.getByRole('link')).toHaveCount(0);
  state.qrCode = '000201TEST-RENEWAL-QR';
  await dialog.getByRole('button', { name: 'Tải lại mã QR', exact: true }).click();
  await expect(dialog.getByRole('img', { name: 'Mã QR thanh toán PayOS' })).toBeVisible();
  expect(state.creates).toBe(0);
  expect(state.links).toEqual(
    Array(2).fill('/api/sellers/shop/subscriptions/pending-hcm/payment-link'),
  );
  expect(page.context().pages()).toHaveLength(1);
});

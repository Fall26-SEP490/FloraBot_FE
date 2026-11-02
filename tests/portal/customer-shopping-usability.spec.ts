import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const productId = '30000000-0000-0000-0000-000000000001';
const kioskId = '40000000-0000-0000-0000-000000000001';
const flower = {
  productId,
  kioskId,
  sellerId: '20000000-0000-0000-0000-000000000001',
  name: 'Hoa hồng pastel',
  shopName: 'Tiệm Hoa An Nhiên',
  kioskName: 'Tủ Nguyễn Huệ',
  address: '12 Nguyễn Huệ, TP.HCM',
  description: 'Mẫu hoa theo yêu cầu',
  price: 250000,
  photo: null,
  bouquets: [],
  zone: 'PREORDER',
};
const row = {
  id: productId,
  kind: 'CUSTOM',
  state: 'QUOTED',
  productId,
  kioskId,
  sellerId: flower.sellerId,
  instructions: 'Hoa trắng',
  pickupAt: '2026-11-10T03:00:00Z',
  pickupBefore: '2026-11-10T05:00:00Z',
  quotedPrice: 350000,
  quoteNote: '',
  quoteExpiresAt: '2030-01-01T00:00:00Z',
  orderId: null,
  checkoutId: null,
  orderCode: 'FB-123',
  orderStatus: null,
  trackingToken: null,
  ready: false,
  payBefore: null,
  productName: flower.name,
  kioskName: flower.kioskName,
  shopName: flower.shopName,
};
async function fixture(page: Page, guest = false) {
  const state = { guest, refresh: 0 };
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/refresh') {
      state.refresh++;
      return route.fulfill({ status: 401, json: {} });
    }
    if (path === '/api/auth/login') {
      state.guest = false;
      return route.fulfill({ json: { id: 'customer', name: 'Minh Anh', role: 'CUSTOMER' } });
    }
    if (route.request().method() !== 'GET') return route.abort();
    if (path === '/api/auth/me')
      return route.fulfill(
        state.guest
          ? { status: 401, json: {} }
          : { json: { id: 'customer', name: 'Minh Anh', role: 'CUSTOMER' } },
      );
    if (path === '/api/auth/config')
      return route.fulfill({
        json: { googleEnabled: false, googleClientId: null, registrationEmailEnabled: true },
      });
    if (path === '/api/shop/catalog')
      return route.fulfill({
        json: {
          items: Array.from({ length: 14 }, (_, i) => ({
            ...flower,
            productId:
              i === 0 ? productId : '30000000-0000-0000-0000-' + String(i + 1).padStart(12, '0'),
            name: i === 0 ? flower.name : 'Hoa pastel ' + String(i + 1),
          })),
          page: 1,
          hasMore: false,
        },
      });
    if (path === '/api/member/preorders')
      return route.fulfill({
        json: {
          items: [
            row,
            {
              ...row,
              id: 'ready-order',
              state: 'ORDERED',
              orderStatus: 'PAID',
              ready: true,
              orderCode: 'FB-124',
            },
          ],
          page: 1,
          hasMore: false,
        },
      });
    if (path === '/api/member/profile')
      return route.fulfill({
        json: { fullName: 'Minh Anh', email: 'minh@example.test', loyaltyPoints: 0 },
      });
    if (path === '/api/member/history')
      return route.fulfill({
        json: {
          items: [
            {
              id: 'history-order',
              orderCode: 'FB-HISTORY',
              createdAt: '2026-10-30T03:00:00Z',
              status: 'COMPLETED',
              totalAmount: 350000,
              pointsEarned: 35,
              pointsRedeemed: 10,
              shopName: flower.shopName,
              items: [flower.name],
            },
          ],
          page: 1,
          hasMore: false,
        },
      });
    if (path === '/api/account/profile')
      return route.fulfill({
        json: {
          id: 'customer',
          fullName: 'Minh Anh',
          loginEmail: 'minh@example.test',
          phone: '0901234567',
          address: '12 Nguyễn Huệ',
          gender: null,
          dateOfBirth: null,
          contactEmail: 'minh@example.test',
          contactEmailIsDefault: true,
          contactEmailVerified: true,
          bank: null,
        },
      });
    if (path === '/api/member/chats/unread-count') return route.fulfill({ json: 0 });
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  return state;
}
for (const width of [390, 1440]) {
  test(`Customer catalog keeps filters, page, back navigation and honest imagery at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await fixture(page);
    await page.goto('/dat-hoa?search=pastel&price=under300&mode=custom&sort=name-asc&page=2');
    await expect(page.locator('.stock-actions')).toContainText('Trang 2');
    await expect(page.getByRole('searchbox')).toHaveValue('pastel');
    await expect(page.locator('.flower-card')).toHaveCount(2);
    await expect(page.locator('.flower-card').first()).toContainText('Ảnh minh họa');
    await expect(page.locator('.flower-card-img').first()).toHaveAttribute('alt', /minh họa/);
    await page.locator('.flower-card-title a').first().click();
    const back = page.getByRole('link', { name: 'Quay lại danh mục' });
    await expect(back).toHaveAttribute(
      'href',
      '/dat-hoa?search=pastel&price=under300&mode=custom&sort=name-asc&page=2',
    );
    await expect(
      page.getByRole('button', { name: 'Yêu cầu báo giá', exact: true }),
    ).toBeInViewport();
    expect(
      (await page.getByRole('button', { name: 'Yêu cầu báo giá', exact: true }).boundingBox())!
        .height,
    ).toBeLessThan(90);
    await expect(page.locator('.flower-detail-media figcaption')).toContainText('Ảnh minh họa');
    await page.screenshot({ path: test.info().outputPath(`detail-${width}.png`), fullPage: true });
    await back.click();
    await expect(page.locator('.stock-actions')).toContainText('Trang 2');
    await page.getByRole('combobox', { name: 'Sắp xếp sản phẩm' }).selectOption('price-desc');
    await expect(page).toHaveURL(/sort=price-desc/);
    await expect(page.locator('.stock-actions')).toContainText('Trang 1');
    await page.goBack();
    await expect(page.locator('.stock-actions')).toContainText('Trang 2');
    if (width === 390) {
      expect(
        (await page.getByRole('combobox', { name: 'Sắp xếp sản phẩm' }).boundingBox())!.height,
      ).toBeGreaterThanOrEqual(44);
      await page.getByRole('button', { name: 'Bộ lọc', exact: true }).click();
    }
    await expect(page.getByRole('button', { name: /Mua trực tiếp tại tủ/ })).toBeDisabled();
    if (width === 390) await page.getByRole('button', { name: 'Áp dụng bộ lọc' }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const result = await new AxeBuilder({ page })
      .include('#main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`catalog-${width}.png`), fullPage: true });
  });
  test(`Customer preorders expose product, price, pickup and next action at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await fixture(page);
    await page.goto('/tai-khoan#web-orders');
    const summary = page.locator('.customer-order-list > li > details > summary').first();
    await expect(summary).toContainText(flower.name);
    await expect(summary).toContainText(flower.kioskName);
    await expect(summary).toContainText('350.000 đ');
    await expect(summary).toContainText('Xem báo giá');
    await expect(
      page.locator('.customer-order-list > li > details > summary').nth(1),
    ).toContainText('Xem hướng dẫn nhận');
    await page.getByRole('combobox', { name: 'Lọc yêu cầu trong trang' }).selectOption('ready');
    await expect(page.locator('.customer-order-list > li')).toHaveCount(1);
    await page.screenshot({ path: test.info().outputPath(`orders-${width}.png`), fullPage: true });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    const result = await new AxeBuilder({ page })
      .include('#main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(result.violations).toEqual([]);
  });
}
test('Guest keeps account section through login and quote CTA has readable text', async ({
  page,
}) => {
  const state = await fixture(page, true);
  await page.goto(`/dat-hoa/${productId}/${kioskId}`);
  await page.getByRole('button', { name: 'Yêu cầu báo giá', exact: true }).click();
  const cta = page
    .getByRole('dialog')
    .getByRole('link', { name: /Đăng nhập/ })
    .first();
  await expect(cta).toHaveCSS('color', 'rgb(255, 255, 255)');
  await page.screenshot({ path: test.info().outputPath('guest-quote.png') });
  await page.goto('/tai-khoan#web-orders');
  await expect(page).toHaveURL(/dang-nhap\?returnUrl=/);
  expect(new URL(page.url()).searchParams.get('returnUrl')).toBe('/tai-khoan#web-orders');
  await page.getByLabel('Email', { exact: true }).fill('minh@example.test');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('TestPassword1234');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page).toHaveURL(/tai-khoan#web-orders$/);
  await expect(page.getByRole('heading', { name: 'Đơn đặt trước', exact: true })).toBeVisible();
  expect(state.guest).toBe(false);
});
test('Customer can inspect historical transaction facts without inventing receipt links', async ({
  page,
}) => {
  await fixture(page);
  await page.goto('/tai-khoan#member-orders');
  await page.getByText('Xem thông tin giao dịch', { exact: true }).click();
  await expect(page.locator('.account-history-details')).toContainText('35');
  await expect(page.locator('.account-history-details')).toContainText('10');
  await expect(page.locator('.account-history-details')).toContainText('FB-HISTORY');
  await expect(
    page.getByRole('link', { name: 'Liên hệ hỗ trợ', exact: true }).first(),
  ).toHaveAttribute('href', '/lien-he');
});
test('Customer security form is disclosed on demand and opens from its anchor', async ({
  page,
}) => {
  await fixture(page);
  await page.goto('/ho-so');
  await expect(page.getByLabel('Mật khẩu hiện tại', { exact: true })).toBeHidden();
  await page
    .getByRole('navigation', { name: 'Mục hồ sơ' })
    .getByRole('link', { name: 'Bảo mật', exact: true })
    .click();
  await expect(page.getByLabel('Mật khẩu hiện tại', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Bảo mật', exact: true })).toHaveAttribute(
    'aria-current',
    'location',
  );
});

test('Customer account keeps its layout when session resolution is delayed', async ({ page }) => {
  await fixture(page);
  let release: () => void = () => {};
  const sessionGate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/auth/me', async (route) => {
    await sessionGate;
    await route.fulfill({ json: { id: 'customer', name: 'Minh Anh', role: 'CUSTOMER' } });
  });
  await page.goto('/tai-khoan#web-orders');
  await expect(page.getByText('Đang kiểm tra phiên làm việc…', { exact: true })).toBeVisible();
  release();
  await expect(page.locator('.customer-order-list > li > details > summary').first()).toBeVisible();
  await expect(page.locator('.customer-account-shell')).toHaveCSS('display', 'grid');
  await expect(
    page.locator('.customer-order-list > li > details > summary').first().locator('> span'),
  ).toHaveCSS('display', 'flex');
});

test('Account route includes layout styles before client-side session checks', async ({
  request,
}) => {
  const response = await request.get('/tai-khoan');
  expect(response.status()).toBe(200);
  const html = await response.text();
  const paths = [...html.matchAll(/<link[^>]+href="([^"]+\.css[^"]*)"[^>]*>/g)].map((match) =>
    match[1].replaceAll('&amp;', '&'),
  );
  const sheets = await Promise.all(paths.map(async (path) => (await request.get(path)).text()));
  expect(sheets.some((css) => css.includes('.customer-account-shell'))).toBe(true);
  expect(sheets.some((css) => css.includes('.member-orders'))).toBe(true);
});

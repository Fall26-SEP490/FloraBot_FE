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
  address: '12 Nguyễn Huệ, TP. Hồ Chí Minh',
  description: 'Mẫu hoa theo yêu cầu',
  price: 350000,
  photo: '/images/floral-white-online.webp',
  bouquets: [],
  zone: 'PREORDER',
};
const row = {
  id: 'request-1',
  kind: 'CUSTOM',
  state: 'REQUESTED',
  productId,
  kioskId,
  sellerId: flower.sellerId,
  instructions: 'Hoa trắng tặng sinh nhật',
  pickupAt: '2026-11-10T03:00:00Z',
  pickupBefore: null,
  quotedPrice: null,
  quoteNote: null,
  quoteExpiresAt: null,
  orderId: null,
  checkoutId: null,
  orderCode: null,
  orderStatus: null,
  trackingToken: null,
  ready: false,
  payBefore: null,
  productName: flower.name,
  kioskName: flower.kioskName,
  shopName: flower.shopName,
};
async function fixture(page: Page) {
  const state = {
    failOrders: false,
    loadingOrders: false,
    writes: [] as Record<string, unknown>[],
    items: [row],
    hasMore: false,
  };
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (request.method() !== 'GET') return route.abort();
    if (path === '/api/auth/me')
      return route.fulfill({
        json: { id: 'customer-polish', name: 'Nguyễn Minh Anh', role: 'CUSTOMER' },
      });
    if (path === '/api/account/profile')
      return route.fulfill({
        json: {
          id: 'customer-polish',
          fullName: 'Nguyễn Minh Anh',
          loginEmail: 'minhanh@example.test',
          phone: '0901234567',
          address: '12 Nguyễn Huệ',
          contactEmail: 'minhanh@example.test',
          contactEmailIsDefault: true,
          contactEmailVerified: true,
          bank: null,
          gender: null,
          dateOfBirth: null,
        },
      });
    if (path === '/api/kiosk-packages' || path === '/api/kiosk-locations')
      return route.fulfill({ json: [] });
    if (path === '/api/member/profile')
      return route.fulfill({
        json: { fullName: 'Nguyễn Minh Anh', email: 'minhanh@example.test', loyaltyPoints: 120 },
      });
    if (path === '/api/shop/catalog')
      return route.fulfill({ json: { items: [flower], page: 1, hasMore: false } });
    if (path === '/api/member/preorders')
      return route.fulfill(
        state.failOrders
          ? { status: 503, json: { detail: 'Tạm gián đoạn' } }
          : { json: { items: state.items, page: 1, hasMore: state.hasMore } },
      );
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  return state;
}
async function openRequest(page: Page) {
  await page.goto(`/dat-hoa/${productId}/${kioskId}`);
  await page.getByRole('button', { name: 'Yêu cầu báo giá', exact: true }).click();
  return page.getByRole('dialog');
}
async function fillRequest(page: Page) {
  const local = await page.evaluate(() => {
    const date = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  });
  await page.getByLabel('Thời gian mong muốn nhận hoa').fill(local);
  await page
    .getByLabel('Dịp tặng, màu hoa, ngân sách và lời nhắn')
    .fill('Hoa trắng tặng sinh nhật, ngân sách 400.000 đồng');
  await page.getByRole('checkbox').check();
}
for (const width of [390, 1440]) {
  test(`Quotation protects drafts on Escape, scrim and close at ${width}px`, async ({ page }) => {
    const state = await fixture(page);
    await page.setViewportSize({ width, height: 950 });
    const dialog = await openRequest(page);
    await expect(dialog.getByText('email đăng nhập của bạn', { exact: true })).toBeVisible();
    await expect(dialog.getByText(/SMS/)).toHaveCount(0);
    await page.screenshot({ path: test.info().outputPath(`quotation-${width}.png`) });
    const pickup = await page.getByLabel('Thời gian mong muốn nhận hoa').boundingBox();
    expect(pickup && pickup.y < 500).toBeTruthy();
    const brief = page.getByLabel('Dịp tặng, màu hoa, ngân sách và lời nhắn');
    await brief.fill('Bản nháp cần giữ lại khi đóng nhầm');
    await page.keyboard.press('Escape');
    const discard = page.getByRole('dialog', { name: 'Bạn muốn bỏ nội dung đang nhập?' });
    await expect(discard).toBeVisible();
    await expect(discard.getByRole('button', { name: 'Tiếp tục nhập' })).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(brief).toBeFocused();
    await expect(brief).toHaveValue('Bản nháp cần giữ lại khi đóng nhầm');
    await page.locator('.flower-request-scrim').click({ position: { x: 1, y: 1 } });
    await expect(discard).toBeVisible();
    await discard.getByRole('button', { name: 'Tiếp tục nhập' }).click();
    await page.getByRole('button', { name: 'Đóng mẫu đang chọn' }).click();
    await expect(discard).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`discard-${width}.png`) });
    await discard.getByRole('button', { name: 'Bỏ nội dung và đóng' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Yêu cầu báo giá', exact: true })).toBeFocused();
    expect(state.writes).toEqual([]);
  });
  test(`Compact profile keeps editing and account navigation reachable at ${width}px`, async ({
    page,
  }) => {
    await fixture(page);
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/ho-so');
    await expect(page.getByLabel('Họ và tên *')).toHaveValue('Nguyễn Minh Anh');
    await expect(page.locator('.profile-page')).toHaveClass(/profile-refined/);
    await expect(page.locator('.profile-page')).toHaveClass(/profile-embedded/);
    const nav = page.getByRole('navigation', { name: 'Điều hướng tài khoản' });
    if (width === 390) {
      await expect(nav).toBeHidden();
      const toggle = page.getByRole('button', { name: 'Mục tài khoản', exact: true });
      await toggle.click();
      await expect(nav).toBeVisible();
      await expect(nav).toHaveClass(/customer-account-navigation/);
      await expect(nav).toHaveCSS('display', 'grid');
      await page.keyboard.press('Escape');
      await expect(nav).toBeHidden();
      await expect(toggle).toBeFocused();
      const name = await page.getByLabel('Họ và tên *').boundingBox();
      expect(name && name.y < 750).toBeTruthy();
    } else await expect(nav).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`profile-${width}.png`) });
    const profileNav = page.getByRole('navigation', { name: 'Mục hồ sơ' });
    for (const label of ['Ngân hàng', 'Thông tin cá nhân', 'Tài khoản']) {
      const link = profileNav.getByRole('link', { name: label, exact: true });
      await link.click();
      await expect(link).toHaveAttribute('aria-current', 'location');
    }
    for (const [id, label] of [
      ['contact-email-heading', 'Email liên hệ'],
      ['personal-bank-heading', 'Ngân hàng'],
      ['basic-info-heading', 'Thông tin cá nhân'],
    ]) {
      const delta = await page.evaluate((headingId) => {
        const nav = document.querySelector('.profile-quick-nav')!;
        const section = document.getElementById(headingId)!.closest('.profile-section')!;
        const stickyBottom =
          parseFloat(getComputedStyle(nav).top) + nav.getBoundingClientRect().height;
        return section.getBoundingClientRect().top - stickyBottom - 72;
      }, id);
      await page.mouse.move(width - 40, 450);
      await page.mouse.wheel(0, delta);
      await expect(profileNav.getByRole('link', { name: label, exact: true })).toHaveAttribute(
        'aria-current',
        'location',
      );
    }
    const results = await new AxeBuilder({ page })
      .include('#main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
test('Submitted quotation links directly to its request and leaves the API payload unchanged', async ({
  page,
}) => {
  const state = await fixture(page);
  await page.route('**/api/member/preorders', async (route) => {
    const body = route.request().postDataJSON();
    state.writes.push(body);
    state.items = [{ ...row, id: body.id }];
    await route.fulfill({ json: { result: body.id } });
  });
  await openRequest(page);
  await fillRequest(page);
  await page.getByRole('button', { name: 'Gửi yêu cầu để shop báo giá', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đã nhận yêu cầu của bạn' })).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(Object.keys(state.writes[0]).sort()).toEqual(
    ['id', 'kind', 'productId', 'kioskId', 'pickupAt', 'instructions'].sort(),
  );
  expect(state.writes[0]).toMatchObject({ kind: 'CUSTOM', productId, kioskId });
  const link = page.getByRole('link', { name: 'Xem yêu cầu vừa gửi', exact: true });
  await expect(link).toHaveAttribute(
    'href',
    `/tai-khoan?requestId=${state.writes[0].id}#web-orders`,
  );
  await link.click();
  await expect(page.locator(`[id="preorder-${state.writes[0].id}"]`)).toHaveAttribute('open', '');
});
test('Uncertain quotation retries the same id and payload after closing confirmation is cancelled', async ({
  page,
}) => {
  const state = await fixture(page);
  await page.route('**/api/member/preorders', async (route) => {
    const body = route.request().postDataJSON();
    state.writes.push(body);
    await route.fulfill(
      state.writes.length === 1
        ? { status: 503, json: { detail: 'Chưa xác nhận gửi thành công' } }
        : { json: { result: body.id } },
    );
  });
  await openRequest(page);
  await fillRequest(page);
  await page.getByRole('button', { name: 'Gửi yêu cầu để shop báo giá', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Gửi lại cùng yêu cầu', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: 'Đóng mẫu đang chọn' }).click();
  await expect(page.getByText('Kết quả gửi chưa được xác nhận.', { exact: false })).toBeVisible();
  await page.getByRole('button', { name: 'Tiếp tục nhập' }).click();
  await page.getByRole('button', { name: 'Gửi lại cùng yêu cầu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đã nhận yêu cầu của bạn' })).toBeVisible();
  expect(state.writes).toHaveLength(2);
  expect(state.writes[1]).toEqual(state.writes[0]);
});
test('Quotation cannot be dismissed or submitted again while its request is in flight', async ({
  page,
}) => {
  const state = await fixture(page);
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/member/preorders', async (route) => {
    state.writes.push(route.request().postDataJSON());
    await pending;
    await route.fulfill({ json: {} });
  });
  await openRequest(page);
  await fillRequest(page);
  await page.getByRole('button', { name: 'Gửi yêu cầu để shop báo giá', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đóng mẫu đang chọn' })).toBeDisabled();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(state.writes).toHaveLength(1);
  release();
  await expect(page.getByRole('heading', { name: 'Đã nhận yêu cầu của bạn' })).toBeVisible();
});
test('Overview prioritizes actionable orders with direct links and distinguishes partial results', async ({
  page,
}) => {
  const state = await fixture(page);
  state.items = [
    row,
    { ...row, id: 'quote-1', state: 'QUOTED', quotedPrice: 350000 },
    { ...row, id: 'ready-1', state: 'ORDERED', orderStatus: 'PAID', ready: true },
    { ...row, id: 'closed-1', state: 'ORDERED', orderStatus: 'COMPLETED' },
  ] as typeof state.items;
  state.hasMore = true;
  await page.goto('/tai-khoan');
  const region = page.getByRole('region', { name: 'Đơn đang theo dõi' });
  await expect(region.getByRole('listitem')).toHaveCount(3);
  await expect(region.getByRole('link', { name: 'Xem báo giá' })).toHaveAttribute(
    'href',
    '/tai-khoan?requestId=quote-1#web-orders',
  );
  await expect(region.getByRole('link', { name: 'Xem hướng dẫn nhận' })).toHaveAttribute(
    'href',
    '/tai-khoan?requestId=ready-1#web-orders',
  );
  await expect(region.getByText('danh sách đầy đủ', { exact: false })).toBeVisible();
  const pending = await region.boundingBox();
  const points = await page.locator('.account-home-status').boundingBox();
  expect(pending && points && pending.y < points.y).toBeTruthy();
  await page.screenshot({ path: test.info().outputPath('overview.png') });
});
test('Overview isolates order API errors, retries and never invents an empty global list', async ({
  page,
}) => {
  const state = await fixture(page);
  state.failOrders = true;
  await page.goto('/tai-khoan');
  const region = page.getByRole('region', { name: 'Đơn đang theo dõi' });
  await expect(region.getByRole('alert')).toBeVisible();
  await expect(page.getByText('120', { exact: true })).toBeVisible();
  state.failOrders = false;
  state.items = [];
  state.hasMore = true;
  await region.getByRole('button', { name: 'Tải lại đơn' }).click();
  await expect(region.getByText('Chưa thấy đơn đang xử lý', { exact: false })).toBeVisible();
  await expect(region.getByText('Chưa có đơn đặt trước đang xử lý.', { exact: false })).toHaveCount(
    0,
  );
});

test('Homepage pickup guidance uses the same email channel as the quotation and order flow', async ({
  page,
}) => {
  await fixture(page);
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'Hoa sẵn sàng, bạn ghé nhận', exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/OTP.*SMS|SMS.*OTP/)).toHaveCount(0);
  await expect(page.getByText('tới email đăng nhập của bạn.', { exact: false })).toBeVisible();
});

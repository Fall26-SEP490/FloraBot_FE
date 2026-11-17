import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function fixture(page: Page) {
  const state = {
    failPreorders: false,
    historyPage2: false,
    writes: [] as { path: string; body: Record<string, unknown> }[],
    profile: {
      id: 'customer-simplified',
      fullName: 'Trần Phong',
      loginEmail: 'phong@example.test',
      contactEmail: 'phong@example.test',
      contactEmailIsDefault: true,
      contactEmailVerified: false,
      phone: '0901234567',
      address: '12 Nguyễn Huệ, TP.HCM',
      gender: null,
      dateOfBirth: null,
      bank: {
        hasAccount: false,
        status: 'EMPTY',
        bankName: null,
        accountHolder: null,
        accountLast4: null,
      },
    },
  };
  const quoted = {
    id: 'request-quoted',
    kind: 'CUSTOM',
    state: 'QUOTED',
    productId: 'p1',
    kioskId: 'k1',
    sellerId: 's1',
    instructions: 'Hoa hồng đỏ tặng kỷ niệm ngày cưới',
    pickupAt: '2030-11-17T04:05:00Z',
    pickupBefore: '2030-11-17T06:05:00Z',
    quotedPrice: 20000,
    quotedFlowerPrice: 10000,
    quotedAccessoryTotal: 10000,
    quoteVersion: 1,
    requestedAccessories: [{ accessoryId: 'bow', name: 'Nơ', quantity: 1 }],
    quotedAccessories: [
      { accessoryId: 'bow', name: 'Nơ', quantity: 1, unitPrice: 10000, lineTotal: 10000 },
    ],
    quoteNote: 'Hoa hồng đỏ, nơ trắng như yêu cầu.',
    quoteExpiresAt: '2030-11-16T04:00:00Z',
    orderId: null,
    checkoutId: null,
    orderCode: null,
    orderStatus: null,
    trackingToken: null,
    ready: false,
    payBefore: null,
    productName: 'Bó hoa tươi – Only rose 18',
    shopName: 'Shop Hoa Của Tâm',
    kioskName: 'Kiosk HCM 09',
    address: '12 Nguyễn Huệ, TP.HCM',
  };
  const completed = {
    ...quoted,
    id: 'request-completed',
    state: 'ORDERED',
    orderId: 'purchase-preorder',
    orderCode: 'FB-PRE',
    orderStatus: 'COMPLETED',
  };
  const history = [
    {
      id: 'purchase-preorder',
      orderCode: 'FB-PRE',
      createdAt: '2030-11-10T02:00:00Z',
      status: 'COMPLETED',
      totalAmount: 20000,
      shopName: 'Shop Hoa Của Tâm',
      items: ['Hoa đã đặt trước'],
      pointsEarned: 2,
      pointsRedeemed: 0,
    },
    {
      id: 'purchase-walkin',
      orderCode: 'FB-WALK',
      createdAt: '2030-11-11T02:00:00Z',
      status: 'COMPLETED',
      totalAmount: 250000,
      shopName: 'Shop Hoa Xinh',
      items: ['Bó cúc mua tại tủ'],
      pointsEarned: 25,
      pointsRedeemed: 0,
    },
  ];
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    if (req.method() !== 'GET') {
      state.writes.push({ path, body: req.postDataJSON() });
      if (path === '/api/account/profile' && req.method() === 'PUT') {
        state.profile = { ...state.profile, ...req.postDataJSON() };
        return route.fulfill({ json: state.profile });
      }
      return route.fulfill({ status: 500, json: {} });
    }
    if (path === '/api/auth/me')
      return route.fulfill({
        json: { id: state.profile.id, name: state.profile.fullName, role: 'CUSTOMER' },
      });
    if (path === '/api/account/profile') return route.fulfill({ json: state.profile });
    if (path === '/api/member/preorders')
      return route.fulfill(
        state.failPreorders
          ? { status: 503, json: { detail: 'Tạm gián đoạn' } }
          : {
              json: {
                items: url.searchParams.get('page') === '2' ? [] : [quoted, completed],
                page: 1,
                hasMore: false,
              },
            },
      );
    if (path === '/api/member/history')
      return route.fulfill({
        json: {
          items:
            url.searchParams.get('page') === '2'
              ? [{ ...history[1], id: 'older-purchase', orderCode: 'FB-OLDER' }]
              : history,
          page: 1,
          hasMore: state.historyPage2 && url.searchParams.get('page') !== '2',
        },
      });
    if (path === '/api/member/kiosk-applications/current')
      return route.fulfill({ status: 404, json: {} });
    if (path === '/api/member/loyalty')
      return route.fulfill({
        json: {
          items: [{ sellerId: 's1', shopName: 'Shop Hoa Của Tâm', balance: 20 }],
          hasMore: false,
        },
      });
    return route.fulfill({ json: { items: [], page: 1, hasMore: false, unreadCount: 0 } });
  });
  return state;
}

for (const width of [390, 1440]) {
  test(`Customer account combines orders and shows a compact quote and profile at ${width}px`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/tai-khoan');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Đơn hàng', exact: true }),
    ).toBeAttached();
    await expect(page.getByRole('searchbox', { name: 'Tìm đơn hàng trong trang' })).toBeVisible();
    await expect(page.getByRole('combobox', { name: 'Lọc đơn hàng' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Làm mới', exact: true })).toHaveCount(0);
    const nav = page.getByRole('navigation', { name: 'Điều hướng tài khoản' });
    if (width === 390) await page.getByRole('button', { name: 'Mục tài khoản' }).click();
    await expect(nav.getByRole('link')).toHaveCount(4);
    await expect(nav.getByRole('link', { name: 'Đơn hàng', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    if (width === 390) await page.keyboard.press('Escape');
    const rows = page.locator('.customer-order-list > li');
    await expect(rows).toHaveCount(3);
    await expect(page.getByLabel('Lọc yêu cầu trong trang')).toHaveCount(0);
    await page.locator('#preorder-request-quoted > summary').click();
    await expect(page.getByRole('list', { name: 'Tiến độ đơn đặt hoa' })).toHaveCount(0);
    const quote = page.getByRole('region', { name: 'Báo giá của shop' });
    await expect(quote).toContainText('20.000 đ');
    await expect(quote.getByText('20.000 đ', { exact: true })).toHaveCount(1);
    await expect(quote).toContainText('Nơ');
    await expect(quote).toContainText('Phản hồi báo giá trước');
    await expect(page.getByRole('button', { name: 'Xác nhận báo giá', exact: true })).toBeVisible();
    await expect(page.getByText('Bước tiếp theo', { exact: true })).toHaveCount(0);
    expect(
      (
        await new AxeBuilder({ page })
          .include('.customer-account-shell')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({ path: test.info().outputPath(`orders-${width}.png`), fullPage: true });
    const history = page.locator('details[data-order-history]');
    await expect(history).not.toHaveAttribute('open');
    await history.locator(':scope > summary').click();
    await expect(history.locator('.customer-order-list > li')).toHaveCount(2);
    await expect(page.getByText('FB-PRE', { exact: false })).toHaveCount(1);
    await history.locator('#preorder-request-completed > summary').click();
    await expect(page.locator('#preorder-request-quoted')).not.toHaveAttribute('open');
    await expect(history.locator('#preorder-request-completed')).toHaveAttribute('open', '');
    await page.goto('/ho-so');
    await expect(page.getByRole('heading', { level: 1, name: 'Hồ sơ', exact: true })).toBeVisible();
    await expect(page.getByLabel('Họ và tên *')).toBeHidden();
    const groups = page.getByRole('navigation', { name: 'Mục hồ sơ' });
    await expect(groups.getByRole('link')).toHaveCount(3);
    await expect(groups).toHaveCSS('flex-wrap', 'wrap');
    const groupBounds = await groups.boundingBox();
    const bankBounds = await groups
      .getByRole('link', { name: 'Ngân hàng', exact: true })
      .boundingBox();
    expect(
      groupBounds &&
        bankBounds &&
        bankBounds.x + bankBounds.width <= groupBounds.x + groupBounds.width + 1,
    ).toBeTruthy();
    await expect(page.getByRole('region', { name: 'Tài khoản ngân hàng cá nhân' })).toBeHidden();
    await page.screenshot({ path: test.info().outputPath(`profile-${width}.png`), fullPage: true });
    await page.getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true }).click();
    await page.getByLabel('Họ và tên *').fill('Trần Phong Mới');
    await page.getByRole('button', { name: 'Lưu thông tin cá nhân', exact: true }).click();
    await expect(page.getByLabel('Họ và tên *')).toBeHidden();
    await expect(page.locator('.profile-personal-summary')).toContainText('Trần Phong Mới');
    expect(state.writes).toHaveLength(1);
    expect(state.writes[0].path).toBe('/api/account/profile');
    await groups.getByRole('link', { name: 'Đăng nhập & bảo mật' }).click();
    await expect(page.getByRole('region', { name: 'Thông tin cá nhân' })).toBeHidden();
    await expect(page.getByRole('region', { name: 'Bảo mật tài khoản' })).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath(`security-${width}.png`),
      fullPage: true,
    });
    await groups.getByRole('link', { name: 'Ngân hàng', exact: true }).click();
    await expect(page.getByRole('region', { name: 'Tài khoản ngân hàng cá nhân' })).toBeVisible();
    await page.screenshot({ path: test.info().outputPath(`bank-${width}.png`), fullPage: true });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
  });
}

test('Purchase history remains available when preorders fail and has independent older records', async ({
  page,
}) => {
  const state = await fixture(page);
  state.failPreorders = true;
  state.historyPage2 = true;
  await page.goto('/tai-khoan#member-orders');
  await expect(page.locator('.customer-order-list')).toContainText('FB-WALK');
  await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
  await expect(page.locator('.customer-order-list')).toContainText('FB-OLDER');
  await expect(page.getByRole('button', { name: 'Trang trước', exact: true })).toBeEnabled();
  expect(state.writes).toEqual([]);
});

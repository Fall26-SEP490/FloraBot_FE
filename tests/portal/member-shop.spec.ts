import { expect, test, type Page } from '@playwright/test';

async function mockMember(page: Page, role = 'CUSTOMER') {
  await page.route('**/api/**', (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/api/auth/me')
      return route.fulfill({
        json: { id: 'member', name: 'Lan', role, sellerId: role === 'SELLER' ? 'shop' : null },
      });
    if (url.pathname === '/api/member/profile')
      return route.fulfill({
        json: { id: 'member', fullName: 'Lan', email: 'lan@example.com', loyaltyPoints: 12000 },
      });
    if (url.pathname.endsWith('/current')) return route.fulfill({ status: 404, json: {} });
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
}

test('Customer uses the kiosk application route and keeps only purchase tabs', async ({ page }) => {
  await mockMember(page);
  const retiredCalls: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === '/api/member/shop') retiredCalls.push(request.url());
  });
  await page.goto('/tai-khoan');
  const main = page.locator('#main');
  await expect(
    main.getByRole('navigation', { name: 'Trong tài khoản' }).getByRole('link'),
  ).toHaveCount(4);
  await expect(main.getByRole('link', { name: 'Chỉnh sửa hồ sơ' })).toHaveCount(0);
  await expect(main.getByText('Hồ sơ & Tài khoản Google')).toHaveCount(0);
  await expect(main.getByText('Bảo mật tài khoản')).toHaveCount(0);
  await expect(main.getByText('Thành viên FloraBot', { exact: true })).toHaveCount(0);
  await expect(main.getByText('Điểm tích lũy', { exact: true })).toHaveCount(1);
  const application = main.getByRole('link', { name: 'Xem hồ sơ thuê kiosk' });
  await expect(application).toHaveAttribute('href', '/thue-kiosk');
  await application.click();
  await expect(page).toHaveURL(/\/thue-kiosk$/);
  expect(retiredCalls).toEqual([]);
});

test('Seller has no shop registration or customer chat calls in the purchase area', async ({
  page,
}) => {
  await mockMember(page, 'SELLER');
  const chatCalls: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/member/chats'))
      chatCalls.push(request.url());
  });
  await page.goto('/tai-khoan#member-chats');
  const main = page.locator('#main');
  await expect(
    main.getByRole('navigation', { name: 'Trong tài khoản' }).getByRole('link'),
  ).toHaveCount(3);
  await expect(main.getByRole('link', { name: 'Xem hồ sơ thuê kiosk' })).toHaveCount(0);
  await expect(main.getByRole('link', { name: /Tin nhắn/ })).toHaveCount(0);
  await expect(main.getByText('12.000', { exact: true })).toBeVisible();
  await main.getByRole('link', { name: 'Lịch sử mua', exact: true }).click();
  await expect(main.getByRole('heading', { name: 'Lịch sử mua hoa' })).toBeVisible();
  expect(chatCalls).toEqual([]);
});

test('Unread total includes later pages and failures do not display fake zero values', async ({
  page,
}) => {
  await mockMember(page);
  await page.route('**/api/member/chats?*', (route) => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get('page'));
    return route.fulfill({
      json: {
        items: [{ id: 'chat-' + pageNumber, unreadCount: pageNumber === 1 ? 2 : 3 }],
        page: pageNumber,
        hasMore: pageNumber === 1,
      },
    });
  });
  await page.goto('/tai-khoan');
  await expect(page.getByText('5 chưa đọc', { exact: true })).toBeVisible();
  await page.route('**/api/member/profile', (route) => route.fulfill({ status: 503, json: {} }));
  await page.route('**/api/member/chats?*', (route) => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get('page'));
    return route.fulfill(
      pageNumber === 1
        ? { json: { items: [{ id: 'chat-1', unreadCount: 2 }], page: 1, hasMore: true } }
        : { status: 503, json: {} },
    );
  });
  await page.reload();
  await expect(page.getByText('Chưa tải được thông tin mua hoa và điểm tích lũy.')).toBeVisible();
  await expect(page.getByText('Chưa tải được số tin chưa đọc.')).toBeVisible();
  await expect(page.getByText('0 chưa đọc', { exact: true })).toHaveCount(0);
  await expect(page.getByText('2 chưa đọc', { exact: true })).toHaveCount(0);
});

for (const [role, hash, destination] of [
  ['CUSTOMER', 'member-shop', '/thue-kiosk'],
  ['SELLER', 'member-shop', '/seller'],
  ['CUSTOMER', 'member-kiosks', '/tim-kiosk'],
]) {
  test(`Legacy ${hash} redirects ${role} to ${destination}`, async ({ page }) => {
    await mockMember(page, role);
    await page.goto('/tai-khoan#' + hash);
    await expect(page).toHaveURL(new RegExp(destination + '$'));
  });
}

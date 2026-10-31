import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const flower = {
  productId: '30000000-0000-0000-0000-000000000001',
  sellerId: '20000000-0000-0000-0000-000000000001',
  kioskId: '40000000-0000-0000-0000-000000000001',
  name: 'Hoa hồng pastel',
  shopName: 'Tiệm hoa nhỏ',
  description: 'Bó hoa dành tặng người bạn yêu thương.',
  kioskName: 'Kiosk Nhà Văn hóa Thanh Niên',
  address: '4 Phạm Ngọc Thạch, phường Bến Nghé, Quận 1, Thành phố Hồ Chí Minh',
  price: 350000,
  photo: null,
  bouquets: [],
  zone: 'PREORDER',
};
const detailPath = `/dat-hoa/${flower.productId}/${flower.kioskId}`;

test.beforeEach(async ({ page }) => {
  await page.route('**/hub/**', (route) => route.abort());
  // All API traffic stays in the fixture, including accidental writes.
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() !== 'GET') return route.abort();
    if (path === '/api/auth/me')
      return route.fulfill({
        json: { id: 'customer-ui', name: 'Khách yêu hoa', role: 'CUSTOMER' },
      });
    if (path === '/api/shop/catalog')
      return route.fulfill({ json: { items: [flower], page: 1, hasMore: false } });
    if (path === '/api/account/profile')
      return route.fulfill({
        json: {
          id: 'customer-ui',
          fullName: 'Khách yêu hoa',
          loginEmail: 'customer@example.test',
          phone: '',
          address: '',
          contactEmail: 'customer@example.test',
          contactEmailIsDefault: true,
          contactEmailVerified: false,
          bank: null,
          gender: null,
          dateOfBirth: null,
        },
      });
    if (path === '/api/member/profile')
      return route.fulfill({
        json: { fullName: 'Khách yêu hoa', email: 'customer@example.test', loyaltyPoints: 0 },
      });
    if (path === '/api/auth/config')
      return route.fulfill({ json: { googleEnabled: false, emailEnabled: false } });
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
});

async function mockConversation(page: Page) {
  const chat = {
    id: 'chat-target',
    otherPartyName: flower.shopName,
    productContext: flower.name,
    createdAt: '2026-10-29T10:00:00Z',
    lastMessageAt: null,
    lastMessage: null,
    lastMessageHasImage: false,
    unreadCount: 0,
  };
  await page.route('**/api/member/chats?*', (route) =>
    route.fulfill({ json: { items: [chat], page: 1, hasMore: false } }),
  );
  await page.route('**/api/chats/*/messages?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  return chat;
}

for (const width of [390, 1440]) {
  test(`order summaries fit and clearly describe the displayed page at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const base = {
      kind: 'CUSTOM',
      productId: flower.productId,
      sellerId: flower.sellerId,
      kioskId: flower.kioskId,
      instructions: 'Hoa tặng sinh nhật',
      pickupAt: '2026-11-01T10:00:00Z',
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
    };
    await page.route('**/api/member/preorders?*', (route) =>
      route.fulfill({
        json: {
          items: [
            { ...base, id: 'order-1', state: 'REQUESTED' },
            { ...base, id: 'order-2', state: 'QUOTED', quotedPrice: 350000 },
            { ...base, id: 'order-3', state: 'ACCEPTED', orderStatus: 'PAID' },
            { ...base, id: 'order-4', state: 'ACCEPTED', orderStatus: 'PAID', ready: true },
          ],
          page: 1,
          hasMore: false,
        },
      }),
    );
    await page.goto('/tai-khoan#web-orders');
    const orders = page.locator('#web-orders');
    await expect(orders.getByLabel('Tóm tắt trang đơn đang xem')).toBeVisible();
    await expect(
      orders.locator('.operations-metric').filter({ hasText: 'Đơn đang xem' }).locator('strong'),
    ).toHaveText('4');
    await expect(
      orders.locator('.operations-metric').filter({ hasText: 'Đang chuẩn bị' }).locator('strong'),
    ).toHaveText('1');
    await expect(
      orders.locator('.operations-metric').filter({ hasText: 'Sẵn sàng tại tủ' }).locator('strong'),
    ).toHaveText('1');
    await expect(orders.getByText('Thống kê và bộ lọc tính trên 4 đơn ở trang 1.')).toBeVisible();
    expect(await orders.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect((await new AxeBuilder({ page }).include('#web-orders').analyze()).violations).toEqual(
      [],
    );
  });
}

test('detail opens the selected shop directly without catalog or overview flashes', async ({
  page,
}) => {
  const chat = await mockConversation(page);
  let opens = 0;
  await page.route('**/api/member/chats/open', async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      sellerId: flower.sellerId,
      productId: flower.productId,
    });
    opens++;
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({ json: chat });
  });
  await page.goto(detailPath);
  await expect(page.getByRole('button', { name: 'Chat với shop', exact: true })).toBeVisible();
  await page.evaluate(() => {
    document.documentElement.dataset.overviewFlashed = 'false';
    new MutationObserver((records) => {
      if (
        records.some((record) =>
          Array.from(record.addedNodes).some(
            (node) =>
              node instanceof Element &&
              (node.matches('.account-overview-panel') ||
                node.querySelector('.account-overview-panel')),
          ),
        )
      ) {
        document.documentElement.dataset.overviewFlashed = 'true';
      }
    }).observe(document.body, { childList: true, subtree: true });
  });
  const paths: string[] = [];
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame()) paths.push(new URL(frame.url()).pathname);
  });
  await page.getByRole('button', { name: 'Chat với shop', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Đang mở chat…', exact: true })).toBeDisabled();
  await expect(page).toHaveURL(/\/tai-khoan\?chat=chat-target#member-chats$/);
  await expect(page.locator('#member-chats .chat-conversation-header')).toContainText(
    flower.shopName,
  );
  await expect(page.locator('#member-chats .chat-conversation-header')).toContainText(flower.name);
  expect(paths).not.toContain('/dat-hoa');
  expect(await page.locator('html').getAttribute('data-overview-flashed')).toBe('false');
  expect(opens).toBe(1);
});

test('chat query wins over a stale overview hash and other tabs clear that query', async ({
  page,
}) => {
  await mockConversation(page);
  await page.goto('/tai-khoan?chat=chat-target#overview');
  await expect(page.locator('#member-chats')).toBeVisible();
  await expect(page.locator('.account-overview-panel')).toHaveCount(0);
  await page
    .getByRole('navigation', { name: 'Trong tài khoản' })
    .getByRole('link', { name: 'Tổng quan', exact: true })
    .click();
  await expect(page).toHaveURL(/\/tai-khoan#overview$/);
  await expect(page.locator('.account-overview-panel')).toBeVisible();
  await page.evaluate(() =>
    history.pushState(null, '', '/tai-khoan?chat=chat-target#member-chats'),
  );
  await expect(page.locator('#member-chats')).toBeVisible();
  await expect(page.locator('.chat-conversation-header')).toContainText(flower.shopName);
});

test('composer has one focus indicator and empty orders avoid zero-filled metric cards', async ({
  page,
}) => {
  await mockConversation(page);
  await page.goto('/tai-khoan?chat=chat-target#member-chats');
  const textarea = page.locator('textarea.chat-composer-textarea');
  await textarea.click();
  await expect(textarea).toHaveCSS('outline-width', '0px');
  await expect(textarea).toHaveCSS('box-shadow', 'none');
  expect(await textarea.evaluate((el) => el.scrollHeight <= el.clientHeight + 1)).toBe(true);
  await textarea.press('Shift+Tab');
  await page.keyboard.press('Tab');
  await expect(textarea).toBeFocused();
  await expect(textarea).toHaveCSS('outline-width', '0px');
  await expect(page.locator('.chat-composer-controls')).toHaveCSS('border-top-width', '1px');
  await expect(page.locator('.chat-composer-controls')).not.toHaveCSS('box-shadow', 'none');
  await page
    .getByRole('navigation', { name: 'Trong tài khoản' })
    .getByRole('link', { name: 'Đơn đặt trước', exact: true })
    .click();
  await expect(page.locator('#web-orders .operations-empty')).toBeVisible();
  await expect(page.locator('#web-orders .order-summary-strip')).toHaveCount(0);
  await expect(
    page.locator('#web-orders').getByRole('button', { name: 'Làm mới', exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('#web-orders').getByRole('link', { name: 'Khám phá hoa' }),
  ).toBeVisible();
  expect((await new AxeBuilder({ page }).include('#web-orders').analyze()).violations).toEqual([]);
});

for (const width of [320, 390, 790, 1440]) {
  test(`ordering dialog fits and preserves background scroll at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 700 });
    await page.goto(detailPath);
    const order = page.getByRole('button', { name: 'Đặt hoa', exact: true });
    await expect(order).toBeVisible();
    await order.scrollIntoViewIfNeeded();
    const beforeScroll = await page.evaluate(() => scrollY);
    await order.click();
    const dialog = page.getByRole('dialog', { name: `Đặt ${flower.name}` });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Tủ nhận hoa')).toBeEnabled();
    await page.evaluate(() => document.fonts.ready);
    expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    expect(
      await dialog
        .locator('fieldset, input, select, textarea, .flower-request-footer')
        .evaluateAll((elements) =>
          elements.every((el) => {
            const box = el.getBoundingClientRect();
            const parent = el.closest('[role="dialog"]')!.getBoundingClientRect();
            return box.left >= parent.left && box.right <= parent.right + 1;
          }),
        ),
    ).toBe(true);
    const header = await dialog.locator('.flower-request-heading').boundingBox();
    const footer = await dialog.locator('.flower-request-footer').boundingBox();
    expect(header!.y).toBeGreaterThanOrEqual(0);
    expect(footer!.y + footer!.height).toBeLessThanOrEqual(700);
    await dialog.locator('.flower-request-scroll').hover();
    await page.mouse.wheel(0, 1800);
    await expect
      .poll(() => dialog.locator('.flower-request-scroll').evaluate((el) => el.scrollTop))
      .toBeGreaterThan(0);
    expect(await dialog.locator('.flower-request-heading').boundingBox()).toEqual(header);
    expect(await dialog.locator('.flower-request-footer').boundingBox()).toEqual(footer);
    expect(await page.evaluate(() => scrollY)).toBe(beforeScroll);
    expect(
      (await new AxeBuilder({ page }).include('.flower-request').analyze()).violations,
    ).toEqual([]);
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(order).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBe(beforeScroll);
  });

  test(`profile, activity and detail share a continuous surface at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/ho-so', '/tai-khoan', detailPath]) {
      await page.goto(path);
      await expect(page.locator('h1')).toBeVisible();
      if (path === '/tai-khoan') {
        const avatar = await page.locator('.account-avatar').boundingBox();
        const info = await page.locator('.account-hero-info').boundingBox();
        expect(info!.x).toBeGreaterThanOrEqual(avatar!.x + avatar!.width);
      }
      const dimensions = await page.evaluate(() => {
        const header = document.querySelector('.site-header')!.getBoundingClientRect();
        const content = document.querySelector('.site-content')!;
        const root = document.querySelector('.workspace-portal-root');
        return {
          headerBottom: header.bottom,
          contentTop: content.getBoundingClientRect().top,
          rootTop: root?.getBoundingClientRect().top,
          background: getComputedStyle(content).backgroundColor,
          overflowing: document.documentElement.scrollWidth > innerWidth + 1,
        };
      });
      expect(dimensions.contentTop).toBe(dimensions.headerBottom);
      if (dimensions.rootTop !== undefined) expect(dimensions.rootTop).toBe(dimensions.contentTop);
      expect(dimensions.background).toBe('rgb(245, 248, 242)');
      expect(dimensions.overflowing).toBe(false);
    }
  });
}

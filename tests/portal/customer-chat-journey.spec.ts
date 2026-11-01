import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const row = {
  id: 'request-1',
  kind: 'CUSTOM',
  state: 'ORDERED',
  orderStatus: 'PAID',
  ready: true,
  productId: 'product-1',
  kioskId: 'kiosk-1',
  sellerId: 'seller-1',
  pickupAt: '2030-11-10T03:00:00Z',
  pickupBefore: '2030-11-10T05:00:00Z',
  quotedPrice: 350000,
  quoteNote: 'Bó hoa màu trắng',
  quoteExpiresAt: null,
  orderId: 'order-1',
  checkoutId: null,
  orderCode: 'FB-CHAT',
  trackingToken: null,
  payBefore: null,
  productName: 'Hoa hồng trắng',
  shopName: 'Shop Hoa An Nhiên',
  kioskName: 'Kiosk Nguyễn Huệ',
  address: '12 Nguyễn Huệ',
  instructions: 'Hoa màu trắng',
};
const flower = {
  productId: row.productId,
  kioskId: row.kioskId,
  sellerId: row.sellerId,
  name: row.productName,
  shopName: row.shopName,
  description: 'Mẫu hoa của shop',
  price: 350000,
  kioskName: row.kioskName,
  address: row.address,
  zone: 'PREORDER',
  photo: null,
  bouquets: [],
};
const chats = [
  {
    id: 'chat-1',
    otherPartyName: row.shopName,
    productContext: row.productName,
    createdAt: '2026-10-15T08:00:00Z',
    lastMessageAt: '2026-10-15T09:30:00Z',
    lastMessage: 'Shop đã nhận mong muốn của bạn.',
    lastMessageHasImage: false,
    unreadCount: 0,
  },
  {
    id: 'chat-2',
    otherPartyName: 'Shop Hoa Bình Minh',
    productContext: 'Hoa cẩm tú cầu',
    createdAt: '2026-10-15T08:00:00Z',
    lastMessageAt: null,
    lastMessage: null,
    lastMessageHasImage: false,
    unreadCount: 0,
  },
];
async function setup(page: Page) {
  const state = {
    opens: [] as unknown[],
    writes: [] as string[],
    openStatus: 200,
    listStatus: 200,
    messageStatus: 200,
    empty: false,
    delay: Promise.resolve(),
  };
  await page.route('**/hub/**', (r) => r.abort());
  await page.route('**/api/**', async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      path = url.pathname;
    if (path === '/api/member/chats/open') {
      state.opens.push(req.postDataJSON());
      await state.delay;
      return route.fulfill({
        status: state.openStatus,
        json: state.openStatus === 200 ? chats[0] : { detail: 'Không thể mở cuộc trò chuyện.' },
      });
    }
    if (path.endsWith('/read'))
      return route.fulfill({ json: { messagesMarkedRead: 0, unreadCount: 0 } });
    if (req.method() !== 'GET') {
      state.writes.push(path);
      return route.abort();
    }
    if (path === '/api/auth/me')
      return route.fulfill({ json: { id: 'customer', name: 'Minh Anh', role: 'CUSTOMER' } });
    if (path === '/api/member/profile') return route.fulfill({ json: { loyaltyPoints: 0 } });
    if (path === '/api/member/kiosk-applications/current')
      return route.fulfill({ status: 404, json: {} });
    if (path === '/api/member/preorders')
      return route.fulfill({
        json: { items: [row], page: Number(url.searchParams.get('page') || 1), hasMore: false },
      });
    if (path === '/api/shop/catalog')
      return route.fulfill({ json: { items: [flower], page: 1, hasMore: false } });
    if (path === '/api/member/chats')
      return route.fulfill({
        status: state.listStatus,
        json:
          state.listStatus === 200
            ? { items: state.empty ? [] : chats, page: 1, hasMore: false }
            : { detail: 'Unavailable' },
      });
    if (/^\/api\/chats\/[^/]+\/messages$/.test(path)) {
      const index = path.includes('chat-2') ? 1 : 0;
      return route.fulfill({
        status: state.messageStatus,
        json:
          state.messageStatus === 200
            ? {
                items: [
                  {
                    id: 'message-' + index,
                    senderName: chats[index].otherPartyName,
                    isMine: false,
                    content: 'Nội dung từ ' + chats[index].otherPartyName,
                    createdAt: '2026-10-15T09:30:00Z',
                    imageUrl: null,
                    readAt: null,
                  },
                ],
                page: 1,
                hasMore: false,
              }
            : { detail: 'Unavailable' },
      });
    }
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  return state;
}
for (const width of [390, 1440]) {
  test(`Order opens the correct shop chat and returns to its page and filter at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 950 });
    const state = await setup(page);
    const origin = '/tai-khoan?requestId=request-1&page=2&filter=ready#web-orders';
    await page.goto(origin);
    await expect(page.locator('#preorder-request-1')).toHaveAttribute('open', '');
    await page.getByRole('button', { name: 'Nhắn shop về đơn này', exact: true }).click();
    await expect(page).toHaveURL(/#member-chats$/);
    expect(state.opens).toEqual([{ sellerId: row.sellerId, productId: row.productId }]);
    expect(new URL(page.url()).searchParams.get('chatReturn')).toBe(origin);
    await expect(page.getByRole('heading', { name: row.shopName, exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tổng quan', exact: true })).toHaveCount(0);
    await expect(page.locator('.chat-conversation-context')).toContainText(row.productName);
    const textarea = page.getByLabel('Nội dung tin nhắn');
    await textarea.fill('Mình muốn trao đổi về đơn hoa.');
    expect(
      await textarea.evaluate((el) => parseFloat(getComputedStyle(el).fontSize)),
    ).toBeGreaterThanOrEqual(16);
    expect(
      (await page.getByRole('button', { name: 'Chọn ảnh đính kèm' }).boundingBox())!.height,
    ).toBeGreaterThanOrEqual(44);
    await expect(page.locator('.site-hotline-button')).toBeHidden();
    await expect(page.getByRole('button', { name: 'Gửi', exact: true })).toBeEnabled();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include('#main')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page
      .locator('.customer-chat-section')
      .screenshot({ path: test.info().outputPath(`chat-${width}.png`) });
    await textarea.fill('');
    await page.getByRole('link', { name: 'Quay lại đơn đặt trước', exact: true }).click();
    await expect(page).toHaveURL(origin);
    await expect(page.locator('#preorder-request-1')).toHaveAttribute('open', '');
    await expect(page.getByLabel('Lọc yêu cầu trong trang')).toHaveValue('ready');
    expect(state.writes).toEqual([]);
  });
}
test('Product chat preserves the selected model and catalog filters when returning', async ({
  page,
}) => {
  const state = await setup(page);
  const from = '/dat-hoa?price=under300&page=2';
  const origin = '/dat-hoa/product-1/kiosk-1?from=' + encodeURIComponent(from) + '&zone=PREORDER';
  await page.goto(origin);
  await page.getByRole('button', { name: 'Chat với shop', exact: true }).click();
  await expect(page).toHaveURL(/#member-chats$/);
  expect(new URL(page.url()).searchParams.get('chatReturn')).toBe(origin);
  await page.getByRole('link', { name: 'Quay lại mẫu hoa', exact: true }).click();
  await expect(page.getByRole('heading', { name: row.productName, exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Quay lại danh mục', exact: true }).click();
  await expect(page).toHaveURL(from);
  expect(state.opens).toEqual([{ sellerId: row.sellerId, productId: row.productId }]);
  expect(state.writes).toEqual([]);
});
test('Switching conversations removes stale order context and reloads the selected shop on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 950 });
  const state = await setup(page);
  await page.goto(
    '/tai-khoan?chat=chat-1&chatReturn=' +
      encodeURIComponent('/tai-khoan?requestId=request-1#web-orders') +
      '#member-chats',
  );
  await expect(page.getByRole('link', { name: 'Quay lại đơn đặt trước' })).toBeVisible();
  await page
    .getByRole('button', { name: 'Quay lại danh sách cuộc trò chuyện', exact: true })
    .click();
  await page.getByRole('button', { name: /Cuộc trò chuyện với Shop Hoa Bình Minh/ }).click();
  await expect(
    page.getByRole('heading', { name: 'Shop Hoa Bình Minh', exact: true }),
  ).toBeVisible();
  expect(new URL(page.url()).searchParams.get('chat')).toBe('chat-2');
  expect(new URL(page.url()).searchParams.has('chatReturn')).toBe(false);
  await expect(page.getByRole('link', { name: 'Quay lại đơn đặt trước' })).toHaveCount(0);
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Shop Hoa Bình Minh', exact: true }),
  ).toBeVisible();
  await expect(page.locator('.chat-messages-list')).toContainText('Nội dung từ Shop Hoa Bình Minh');
  expect(state.opens).toEqual([]);
  expect(state.writes).toEqual([]);
});
test('Opening a chat is locked in flight, and an API error leaves the order available for explicit retry', async ({
  page,
}) => {
  const state = await setup(page);
  state.openStatus = 503;
  let release!: () => void;
  state.delay = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.goto('/tai-khoan?requestId=request-1#web-orders');
  const open = page.getByRole('button', { name: 'Nhắn shop về đơn này', exact: true });
  await open.click();
  await expect(page.getByRole('button', { name: 'Đang mở trò chuyện…' })).toBeDisabled();
  expect(state.opens).toHaveLength(1);
  release();
  await expect(
    page.locator('#preorder-request-1 [role="alert"]').filter({ hasText: 'Dịch vụ chat' }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#web-orders$/);
  state.openStatus = 200;
  await open.click();
  await expect(page).toHaveURL(/#member-chats$/);
  expect(state.opens).toHaveLength(2);
  expect(state.writes).toEqual([]);
});
test('Empty inbox and failed chat list provide a recovery without invented conversations', async ({
  page,
}) => {
  const state = await setup(page);
  state.empty = true;
  await page.goto('/tai-khoan#member-chats');
  await expect(
    page.getByRole('heading', { name: 'Chưa có cuộc trò chuyện nào', exact: true }),
  ).toBeVisible();
  await expect(page.getByRole('link', { name: 'Khám phá hoa', exact: true })).toBeVisible();
  state.empty = false;
  state.listStatus = 503;
  await page.reload();
  await expect(page.getByRole('button', { name: 'Tải lại danh sách', exact: true })).toBeVisible();
  state.listStatus = 200;
  await page.getByRole('button', { name: 'Tải lại danh sách', exact: true }).click();
  await expect(
    page.getByRole('button', { name: /Cuộc trò chuyện với Shop Hoa An Nhiên/ }),
  ).toBeVisible();
  await page.getByLabel('Tìm kiếm cuộc trò chuyện').fill('khong-co-shop-nay');
  await expect(page.getByText('Không tìm thấy cuộc trò chuyện nào', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Xóa bộ lọc hội thoại' }).click();
  await expect(
    page.getByRole('button', { name: /Cuộc trò chuyện với Shop Hoa An Nhiên/ }),
  ).toBeVisible();
  expect(state.writes).toEqual([]);
});
test('External return URLs never render a return link', async ({ page }) => {
  await setup(page);
  await page.goto('/tai-khoan?chat=chat-1&chatReturn=https%3A%2F%2Fevil.test#member-chats');
  await expect(page.getByRole('heading', { name: row.shopName, exact: true })).toBeVisible();
  await expect(page.locator('.customer-chat-origin')).toHaveCount(0);
});

test('A forbidden order chat explains the error without redirecting or sending a message', async ({
  page,
}) => {
  const state = await setup(page);
  state.openStatus = 403;
  await page.goto('/tai-khoan?requestId=request-1#web-orders');
  await page.getByRole('button', { name: 'Nhắn shop về đơn này', exact: true }).click();
  await expect(
    page
      .locator('#preorder-request-1')
      .getByText('Bạn không có quyền tham gia cuộc trò chuyện này.', { exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#web-orders$/);
  expect(state.opens).toHaveLength(1);
  expect(state.writes).toEqual([]);
});

test('A failed message history disables sending and recovers within the selected conversation', async ({
  page,
}) => {
  const state = await setup(page);
  state.messageStatus = 503;
  await page.goto('/tai-khoan?chat=chat-1#member-chats');
  await expect(page.getByRole('button', { name: 'Tải lại tin nhắn', exact: true })).toBeVisible();
  await expect(page.getByLabel('Nội dung tin nhắn')).toBeDisabled();
  state.messageStatus = 200;
  await page.getByRole('button', { name: 'Tải lại tin nhắn', exact: true }).click();
  await expect(page.getByLabel('Nội dung tin nhắn')).toBeEnabled();
  await expect(page.locator('.chat-messages-list')).toContainText('Nội dung từ Shop Hoa An Nhiên');
  expect(state.writes).toEqual([]);
});
test('Quick replies only fill the composer; a message is sent only by explicit submission', async ({
  page,
}) => {
  const state = await setup(page),
    sent: unknown[] = [];
  await page.route('**/api/chats/chat-1/messages', async (route) => {
    const body = route.request().postDataJSON();
    sent.push(body);
    await route.fulfill({
      json: {
        id: 'sent-1',
        senderName: 'Minh Anh',
        isMine: true,
        content: body.content,
        imageUrl: null,
        createdAt: '2026-11-02T01:00:00Z',
        readAt: null,
      },
    });
  });
  await page.goto('/tai-khoan?chat=chat-1#member-chats');
  const textarea = page.getByLabel('Nội dung tin nhắn');
  await expect(textarea).toBeEnabled();
  await expect(page.getByRole('button', { name: 'Gửi', exact: true })).toBeDisabled();
  await page.getByRole('button', { name: 'Lịch nhận hoa', exact: true }).click();
  await expect(textarea).not.toHaveValue('');
  expect(sent).toEqual([]);
  await textarea.fill('Liên hệ 0901234567');
  await textarea.blur();
  await expect(page.locator('.chat-composer-error')).toContainText(
    'không được chứa email, số điện thoại',
  );
  expect(sent).toEqual([]);
  await textarea.fill('Shop cho mình hỏi thời gian nhận hoa.');
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect(page.locator('.chat-messages-list')).toContainText(
    'Shop cho mình hỏi thời gian nhận hoa.',
  );
  expect(sent).toEqual([
    { content: 'Shop cho mình hỏi thời gian nhận hoa.', imageReference: null },
  ]);
  await expect(textarea).toHaveValue('');
  expect(state.writes).toEqual([]);
});

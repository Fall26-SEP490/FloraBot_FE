import { expect, test, type WebSocketRoute } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const customerUser = {
  id: '10000000-0000-0000-0000-000000000010',
  name: 'Nguyễn Văn A',
  role: 'CUSTOMER',
  sellerId: null,
  sellerStatus: null,
  packageExpiresAt: null,
};

const sellerUser = {
  id: '10000000-0000-0000-0000-000000000020',
  name: 'Chủ Tiệm Hoa Nhỏ',
  role: 'SELLER',
  sellerId: '20000000-0000-0000-0000-000000000001',
  sellerStatus: 'ACTIVE',
  packageExpiresAt: '2030-01-01',
};

const sellerNoShop = {
  id: '10000000-0000-0000-0000-000000000030',
  name: 'Chủ Chưa Có Shop',
  role: 'SELLER',
  sellerId: null,
  sellerStatus: null,
  packageExpiresAt: null,
};

const mockFlower = {
  productId: '30000000-0000-0000-0000-000000000001',
  sellerId: '20000000-0000-0000-0000-000000000001',
  shopName: 'Tiệm Hoa Nhỏ',
  name: 'Hoa hồng pastel',
  description: 'Bó hồng sinh nhật trang nhã',
  price: 350000,
  kioskId: '40000000-0000-0000-0000-000000000001',
  kioskName: 'Tủ FPT',
  address: 'Thủ Đức',
  photo: null,
  bouquets: ['50000000-0000-0000-0000-000000000001'],
};

const mockChat = {
  id: '90000000-0000-0000-0000-000000000001',
  otherPartyName: 'Tiệm Hoa Nhỏ',
  createdAt: '2026-10-15T08:00:00Z',
  lastMessageAt: '2026-10-15T09:30:00Z',
  lastMessage: 'Dạ shop sẵn sàng làm bó hoa theo yêu cầu của bạn ạ!',
  lastMessageHasImage: false,
  productContext: 'Hoa hồng pastel',
  unreadCount: 1,
};

const mockMessages = [
  {
    id: '80000000-0000-0000-0000-000000000001',
    senderName: 'Nguyễn Văn A',
    isMine: true,
    content: 'Shop ơi mình muốn đặt thêm nơ màu hồng được không?',
    createdAt: '2026-10-15T09:00:00Z',
    imageUrl: null,
    readAt: '2026-10-15T09:10:00Z',
  },
  {
    id: '80000000-0000-0000-0000-000000000002',
    senderName: 'Tiệm Hoa Nhỏ',
    isMine: false,
    content: 'Dạ shop sẵn sàng làm bó hoa theo yêu cầu của bạn ạ!',
    createdAt: '2026-10-15T09:30:00Z',
    imageUrl: null,
    readAt: null,
  },
];

for (const width of [1440, 390]) {
  test(`Customer chat composer stays usable at ${width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: customerUser }));
    await page.route('**/api/member/profile', (route) =>
      route.fulfill({
        json: { id: customerUser.id, fullName: customerUser.name, loyaltyPoints: 100 },
      }),
    );
    await page.route('**/api/member/chats?*', (route) =>
      route.fulfill({ json: { items: [mockChat], page: 1, hasMore: false } }),
    );
    await page.route(`**/api/chats/${mockChat.id}/messages?*`, (route) =>
      route.fulfill({ json: { items: mockMessages, page: 1, hasMore: false } }),
    );
    await page.route(`**/api/chats/${mockChat.id}/read`, (route) =>
      route.fulfill({ json: { messagesMarkedRead: 0 } }),
    );
    await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
    await page.goto('/tai-khoan#member-chats');
    if (width < 768)
      await page.getByRole('button', { name: /Cuộc trò chuyện với Tiệm Hoa Nhỏ/ }).click();
    const textarea = page.getByLabel('Nội dung tin nhắn');
    const attach = page.getByRole('button', { name: 'Chọn ảnh đính kèm' });
    const send = page.getByRole('button', { name: 'Gửi', exact: true });
    await expect(textarea).toBeVisible();
    await textarea.fill('Chào shop');
    await expect(send).toBeEnabled();
    const [a, b, c] = await Promise.all([
      attach.boundingBox(),
      textarea.boundingBox(),
      send.boundingBox(),
    ]);
    expect(a && b && c && Math.abs(a.y - b.y) < 10 && Math.abs(c.y - b.y) < 10).toBeTruthy();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page
      .locator('#member-chats .chat-layout')
      .screenshot({ path: testInfo.outputPath('chat.png') });
  });
}

test('Unauthenticated user confirms login before opening shop chat', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401 }));
  await page.route('**/api/shop/catalog?*', (route) =>
    route.fulfill({ json: { items: [mockFlower], page: 1, hasMore: false } }),
  );

  await page.goto('/dat-hoa');
  const chatBtn = page.getByRole('button', { name: 'Nhắn tin với shop' }).first();
  await expect(chatBtn).toBeVisible();
  await chatBtn.click();
  const notice = page.getByRole('dialog', { name: 'Đăng nhập để nhắn tin' });
  await expect(notice).toBeVisible();
  await expect(page).toHaveURL(/\/dat-hoa/);
  await notice.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(/\/dang-nhap\?returnUrl=%2Fdat-hoa/);
});

test('Seller sees a role notice instead of an inline catalog error when opening chat', async ({
  page,
}) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: sellerUser }));
  await page.route('**/api/shop/catalog?*', (route) =>
    route.fulfill({ json: { items: [mockFlower], page: 1, hasMore: false } }),
  );

  await page.goto('/dat-hoa');
  await page.getByRole('button', { name: 'Nhắn tin với shop' }).first().click();
  const notice = page.getByRole('dialog', { name: 'Không thể nhắn tin bằng tài khoản này' });
  await expect(notice).toContainText('Chỉ tài khoản khách hàng thành viên');
  await expect(notice.locator('.management-modal-header')).toHaveCSS('border-bottom-width', '0px');
  await expect(notice.locator('.catalog-chat-notice-actions')).toHaveCSS('border-top-width', '0px');
  await notice.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(notice).not.toBeVisible();
  await expect(page.locator('.flower-shop-page > .error')).toHaveCount(0);
});

test('Unauthenticated user sees the login notice from a flower detail page', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401 }));
  await page.route('**/api/shop/catalog?*', (route) =>
    route.fulfill({ json: { items: [mockFlower], page: 1, hasMore: false } }),
  );

  await page.goto(`/dat-hoa/${mockFlower.productId}/${mockFlower.kioskId}`);
  await page.getByRole('button', { name: 'Chat với shop' }).click();
  const notice = page.getByRole('dialog', { name: 'Đăng nhập để nhắn tin' });
  await expect(notice).toBeVisible();
  await notice.getByRole('button', { name: 'Để sau' }).click();
  await expect(notice).not.toBeVisible();
  await expect(page).toHaveURL(
    new RegExp(`/dat-hoa/${mockFlower.productId}/${mockFlower.kioskId}`),
  );
});

test('Customer opens chat from product and enters conversation in account area', async ({
  page,
}) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: customerUser }));
  await page.route('**/api/shop/catalog?*', (route) =>
    route.fulfill({ json: { items: [mockFlower], page: 1, hasMore: false } }),
  );

  let openedPayload: { sellerId: string; productId: string } | null = null;
  await page.route('**/api/member/chats/open', async (route) => {
    openedPayload = route.request().postDataJSON();
    await route.fulfill({ json: mockChat });
  });

  await page.route('**/api/member/profile', (route) =>
    route.fulfill({
      json: {
        id: customerUser.id,
        fullName: customerUser.name,
        email: 'customer@example.com',
        loyaltyPoints: 100,
      },
    }),
  );
  await page.route('**/api/member/history?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/member/preorders?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/member/chats?*', (route) =>
    route.fulfill({ json: { items: [mockChat], page: 1, hasMore: false } }),
  );
  await page.route(`**/api/chats/${mockChat.id}/messages?*`, (route) =>
    route.fulfill({ json: { items: mockMessages, page: 1, hasMore: false } }),
  );
  await page.route(`**/api/chats/${mockChat.id}/read`, (route) =>
    route.fulfill({
      json: {
        chatId: mockChat.id,
        messagesMarkedRead: 1,
        unreadCount: 0,
        readThroughMessageId: mockMessages[1].id,
        readThroughCreatedAt: mockMessages[1].createdAt,
        readAt: '2026-10-15T09:35:00Z',
      },
    }),
  );
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));

  await page.goto('/dat-hoa');
  const chatBtn = page.getByRole('button', { name: 'Nhắn tin với shop' }).first();
  await chatBtn.click();

  await expect(page).toHaveURL(new RegExp(`/tai-khoan\\?chat=${mockChat.id}#member-chats`));
  expect(openedPayload).toEqual({
    sellerId: mockFlower.sellerId,
    productId: mockFlower.productId,
  });

  // Verify conversation view renders with counterparty and messages
  await expect(page.getByRole('heading', { name: mockChat.otherPartyName })).toBeVisible();
  await expect(page.getByText('Hoa: Hoa hồng pastel')).toBeVisible();
  await expect(
    page.locator('.chat-messages-list').getByText('Shop ơi mình muốn đặt thêm nơ'),
  ).toBeVisible();
  await expect(
    page.locator('.chat-messages-list').getByText('Dạ shop sẵn sàng làm bó hoa'),
  ).toBeVisible();
  await expect(page.getByText('Đã xem')).toBeVisible();
});

test('Customer views chat list with unread badge and sends a text message', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: customerUser }));
  await page.route('**/api/member/profile', (route) =>
    route.fulfill({
      json: {
        id: customerUser.id,
        fullName: customerUser.name,
        email: 'customer@example.com',
        loyaltyPoints: 100,
      },
    }),
  );
  await page.route('**/api/member/history?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/member/preorders?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/member/chats?*', (route) =>
    route.fulfill({ json: { items: [mockChat], page: 1, hasMore: false } }),
  );
  await page.route(`**/api/chats/${mockChat.id}/messages?*`, (route) =>
    route.fulfill({ json: { items: mockMessages, page: 1, hasMore: false } }),
  );
  let readTriggered = false;
  await page.route(`**/api/chats/${mockChat.id}/read`, (route) => {
    readTriggered = true;
    return route.fulfill({
      json: {
        chatId: mockChat.id,
        messagesMarkedRead: 1,
        unreadCount: 0,
        readThroughMessageId: mockMessages[1].id,
        readThroughCreatedAt: mockMessages[1].createdAt,
        readAt: '2026-10-15T09:35:00Z',
      },
    });
  });

  let sentBody: { content?: string; imageReference?: string } | null = null;
  await page.route(`**/api/chats/${mockChat.id}/messages`, async (route) => {
    sentBody = route.request().postDataJSON();
    await route.fulfill({
      json: {
        id: '80000000-0000-0000-0000-000000000099',
        senderName: customerUser.name,
        isMine: true,
        content: sentBody?.content,
        createdAt: '2026-10-15T10:00:00Z',
        imageUrl: null,
        readAt: null,
      },
    });
  });
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));

  await page.goto('/tai-khoan#member-chats');
  await expect(page.getByText('Tin nhắn với các shop')).toBeVisible();

  // Verify conversation list item
  await expect(
    page.locator('.chat-list-item-name').getByText(mockChat.otherPartyName),
  ).toBeVisible();
  await expect(page.getByLabel('1 tin nhắn chưa đọc')).toBeVisible();

  // Click on the conversation to open
  await page.getByRole('button', { name: new RegExp(mockChat.otherPartyName) }).click();
  await expect(page.getByRole('heading', { name: mockChat.otherPartyName })).toBeVisible();
  expect(readTriggered).toBe(true);

  // Type message and submit
  const textarea = page.getByPlaceholder('Nhập tin nhắn...');
  await textarea.fill('Mình cảm ơn shop nhiều nhé!');
  await page.getByRole('button', { name: 'Gửi' }).click();

  expect(sentBody).toEqual({
    content: 'Mình cảm ơn shop nhiều nhé!',
    imageReference: null,
  });
  await expect(page.getByText('Mình cảm ơn shop nhiều nhé!')).toBeVisible();
});

test('Message validation: blocks empty message and contact info', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: customerUser }));
  await page.route('**/api/member/profile', (route) =>
    route.fulfill({
      json: {
        id: customerUser.id,
        fullName: customerUser.name,
        email: 'test@example.com',
        loyaltyPoints: 0,
      },
    }),
  );
  await page.route('**/api/member/history?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/member/preorders?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/member/chats?*', (route) =>
    route.fulfill({ json: { items: [mockChat], page: 1, hasMore: false } }),
  );
  await page.route(`**/api/chats/${mockChat.id}/messages?*`, (route) =>
    route.fulfill({ json: { items: mockMessages, page: 1, hasMore: false } }),
  );
  await page.route(`**/api/chats/${mockChat.id}/read`, (route) =>
    route.fulfill({ json: { chatId: mockChat.id, messagesMarkedRead: 0, unreadCount: 0 } }),
  );
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));

  await page.goto('/tai-khoan#member-chats');
  await page.getByRole('button', { name: new RegExp(mockChat.otherPartyName) }).click();

  const textarea = page.getByPlaceholder('Nhập tin nhắn...');
  const submitBtn = page.getByRole('button', { name: 'Gửi' });

  // 1. Initially disabled when empty
  await expect(submitBtn).toBeDisabled();

  // 2. Contact info validation
  await textarea.fill('Liên hệ mình qua 0901234567 nhé');
  await textarea.blur();
  await expect(page.locator('.chat-composer-error[role="alert"]')).toContainText(
    'không được chứa email, số điện thoại',
  );
});

test('Seller views chat list strictly for their sellerId and sees unread badge in navigation', async ({
  page,
}) => {
  const sellerChat = {
    ...mockChat,
    id: '90000000-0000-0000-0000-000000000002',
    otherPartyName: 'Trần Thị B',
    lastMessage: 'Shop có giao hoa vào sáng mai được không?',
    unreadCount: 2,
  };

  const requestedUrls: string[] = [];
  await page.route('**/api/**', (route) => {
    const url = route.request().url();
    requestedUrls.push(url);
    if (url.endsWith('/auth/me')) return route.fulfill({ json: sellerUser });
    if (url.includes(`/sellers/${sellerUser.sellerId}/chats`)) {
      return route.fulfill({ json: { items: [sellerChat], page: 1, hasMore: false } });
    }
    if (url.includes(`/chats/${sellerChat.id}/messages`)) {
      return route.fulfill({
        json: {
          items: [
            {
              id: '80000000-0000-0000-0000-000000000010',
              senderName: 'Trần Thị B',
              isMine: false,
              content: 'Shop có giao hoa vào sáng mai được không?',
              createdAt: '2026-10-15T10:00:00Z',
              imageUrl: null,
              readAt: null,
            },
          ],
          page: 1,
          hasMore: false,
        },
      });
    }
    if (url.includes(`/chats/${sellerChat.id}/read`)) {
      return route.fulfill({
        json: { chatId: sellerChat.id, messagesMarkedRead: 1, unreadCount: 0 },
      });
    }
    if (url.endsWith('/wallet')) {
      return route.fulfill({
        json: {
          balance: { availableBalance: 500000, pendingBalance: 0 },
          bankConfigured: true,
          entries: [],
          withdrawals: [],
        },
      });
    }
    if (url.endsWith('/products')) return route.fulfill({ json: [] });
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));

  await page.goto('/seller/chats');

  // Verify conversation view renders counterparty name
  await expect(page.getByRole('heading', { name: 'Trần Thị B' })).toBeVisible();

  // Verify URL requested uses sellerId
  expect(requestedUrls.some((u) => u.includes(`/api/sellers/${sellerUser.sellerId}/chats`))).toBe(
    true,
  );

  // Verify navigation has unread badge
  const chatsNavLink = page.getByRole('link', { name: /Tin nhắn/ }).first();
  await expect(chatsNavLink).toBeVisible();
  await expect(chatsNavLink.getByLabel('2 tin nhắn chưa đọc')).toBeVisible();

  await expect(
    page.locator('.chat-messages-list').getByText('Shop có giao hoa vào sáng mai được không?'),
  ).toBeVisible();
});

test('Seller session without sellerId displays safe error state without API calls', async ({
  page,
}) => {
  let attemptedChatApiCall = false;
  await page.route('**/api/**', (route) => {
    const url = route.request().url();
    if (url.endsWith('/auth/me')) return route.fulfill({ json: sellerNoShop });
    if (url.includes('/chats')) {
      attemptedChatApiCall = true;
    }
    if (url.endsWith('/wallet')) {
      return route.fulfill({
        json: {
          balance: { availableBalance: 0, pendingBalance: 0 },
          bankConfigured: false,
          entries: [],
          withdrawals: [],
        },
      });
    }
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));

  await page.goto('/seller/chats');
  await expect(page.locator('.chat-seller-safe-error[role="alert"]')).toContainText(
    'Tài khoản chưa được liên kết với shop',
  );
  expect(attemptedChatApiCall).toBe(false);
});

test('Realtime SignalR: receives ChatMessageReceived and updates messages without duplicate', async ({
  page,
}) => {
  let sockets: WebSocketRoute[] = [];
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: customerUser }));
  await page.route('**/api/member/profile', (route) =>
    route.fulfill({
      json: {
        id: customerUser.id,
        fullName: customerUser.name,
        email: 'customer@example.com',
        loyaltyPoints: 10,
      },
    }),
  );
  await page.route('**/api/member/history?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/member/preorders?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/member/chats?*', (route) =>
    route.fulfill({ json: { items: [mockChat], page: 1, hasMore: false } }),
  );
  await page.route(`**/api/chats/${mockChat.id}/messages?*`, (route) =>
    route.fulfill({ json: { items: mockMessages, page: 1, hasMore: false } }),
  );
  await page.route(`**/api/chats/${mockChat.id}/read`, (route) =>
    route.fulfill({ json: { chatId: mockChat.id, messagesMarkedRead: 1, unreadCount: 0 } }),
  );

  await page.route('**/hub/chat/negotiate?*', (route) =>
    route.fulfill({
      json: {
        negotiateVersion: 1,
        connectionId: 'chat-test',
        connectionToken: 'chat-test',
        availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text'] }],
      },
    }),
  );

  await page.routeWebSocket('**/hub/chat?*', (socket) => {
    socket.onMessage((message) => {
      if (String(message).includes('"protocol"')) {
        sockets = [...sockets, socket];
        socket.send('{}\u001e');
      }
    });
  });

  await page.goto('/tai-khoan#member-chats');
  await page.getByRole('button', { name: new RegExp(mockChat.otherPartyName) }).click();
  await expect.poll(() => sockets.length).toBeGreaterThan(0);

  // Broadcast realtime message
  const realtimeIncoming = {
    chatId: mockChat.id,
    id: '80000000-0000-0000-0000-000000000088',
    senderName: 'Tiệm Hoa Nhỏ',
    senderRole: 'SELLER',
    content: 'Shop đã bắt đầu cắm hoa cho bạn rồi nhé!',
    createdAt: '2026-10-15T10:15:00Z',
    imageUrl: null,
    unreadCount: 0,
  };

  sockets.at(-1)!.send(
    JSON.stringify({
      type: 1,
      target: 'ChatMessageReceived',
      arguments: [realtimeIncoming],
    }) + '\u001e',
  );

  await expect(
    page.locator('.chat-messages-list').getByText('Shop đã bắt đầu cắm hoa cho bạn rồi nhé!'),
  ).toBeVisible();

  // Send the same message again to verify deduplication
  sockets.at(-1)!.send(
    JSON.stringify({
      type: 1,
      target: 'ChatMessageReceived',
      arguments: [realtimeIncoming],
    }) + '\u001e',
  );

  await expect(
    page.locator('.chat-messages-list').getByText('Shop đã bắt đầu cắm hoa cho bạn rồi nhé!'),
  ).toHaveCount(1);
});

test('Accessibility and responsive 200% zoom check', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: customerUser }));
  await page.route('**/api/member/profile', (route) =>
    route.fulfill({
      json: {
        id: customerUser.id,
        fullName: customerUser.name,
        email: 'customer@example.com',
        loyaltyPoints: 10,
      },
    }),
  );
  await page.route('**/api/member/history?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/member/preorders?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/member/chats?*', (route) =>
    route.fulfill({ json: { items: [mockChat], page: 1, hasMore: false } }),
  );
  await page.route(`**/api/chats/${mockChat.id}/messages?*`, (route) =>
    route.fulfill({ json: { items: mockMessages, page: 1, hasMore: false } }),
  );
  await page.route(`**/api/chats/${mockChat.id}/read`, (route) =>
    route.fulfill({ json: { chatId: mockChat.id, messagesMarkedRead: 0, unreadCount: 0 } }),
  );
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));

  // Check desktop accessibility
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/tai-khoan#member-chats');
  await page.getByRole('button', { name: new RegExp(mockChat.otherPartyName) }).click();
  await expect(page.getByRole('heading', { name: mockChat.otherPartyName })).toBeVisible();

  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);

  // Check true 200% zoom reflow (:root font-size 32px equivalent to 200% text zoom)
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/tai-khoan#member-chats');
  await page.evaluate(() => document.fonts.ready);
  await page.addStyleTag({ content: ':root { font-size: 32px !important; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await expect(page.getByRole('heading', { name: mockChat.otherPartyName })).toBeVisible();

  // Check mobile responsiveness (390px)
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/tai-khoan?chat=${mockChat.id}#member-chats`);
  // On mobile with active conversation, conversation view is displayed
  await expect(page.getByRole('heading', { name: mockChat.otherPartyName })).toBeVisible();

  // Clicking back button returns to chat list
  const backBtn = page.getByRole('button', { name: 'Quay lại danh sách' });
  await expect(backBtn).toBeVisible();
  await backBtn.click();
  await expect(
    page.locator('.chat-list-item-name').getByText(mockChat.otherPartyName),
  ).toBeVisible();

  // No horizontal overflow
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

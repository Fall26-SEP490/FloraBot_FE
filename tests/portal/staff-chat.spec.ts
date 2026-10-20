import { expect, test, type Page, type WebSocketRoute } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const chatId = '91000000-0000-0000-0000-000000000001';
const otherId = '91000000-0000-0000-0000-000000000002';
const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
const initialMessage = {
  id: 'message-1',
  senderName: 'Lan Nhân Viên',
  senderRole: 'SELLER_STAFF',
  isMine: false,
  content: 'Em đã nạp hoa xong.',
  createdAt: '2026-10-20T08:00:00Z',
  imageUrl: null as string | null,
  readAt: null as string | null,
};

async function fixture(
  page: Page,
  options: {
    role?: string;
    empty?: boolean;
    inactive?: boolean;
    more?: boolean;
    failUpload?: boolean;
    failHistory?: boolean;
  } = {},
) {
  const role = options.role ?? 'SELLER';
  const calls: { path: string; method: string; body: string | null }[] = [];
  let opened = !options.empty;
  let failHistory = !!options.failHistory;
  let failedUpload = false;
  const sent: Record<string, unknown>[] = [];
  const item = {
    id: chatId,
    otherPartyName: role === 'SELLER' ? 'Lan Nhân Viên' : 'Tiệm Hoa Nhà',
    otherPartyRole: role === 'SELLER' ? 'SELLER_STAFF' : 'SELLER',
    otherPartyActive: !options.inactive,
    createdAt: '2026-10-20T07:00:00Z',
    lastMessageAt: initialMessage.createdAt,
    lastMessage: initialMessage.content,
    lastMessageHasImage: false,
    unreadCount: 1,
  };
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const { pathname: path, searchParams } = new URL(request.url());
    const method = request.method();
    calls.push({ path, method, body: request.postData() });
    if (path === '/api/auth/me')
      return route.fulfill({
        json: {
          id: role === 'SELLER' ? 'seller-user' : 'staff-user',
          name: 'Tài Khoản Thử',
          role,
          sellerId: ['SELLER', 'SELLER_STAFF'].includes(role) ? 'shop-1' : null,
          sellerStatus: 'ACTIVE',
          packageExpiresAt: '2030-01-01',
        },
      });
    if (path === '/api/sellers/shop-1/staff/accounts')
      return route.fulfill({
        json: [
          {
            id: 'staff-1',
            fullName: 'Lan Nhân Viên',
            email: 'lan@example.test',
            phone: '0901234567',
            role: 'SELLER_STAFF',
            status: 'ACTIVE',
            createdAt: '2026-10-01',
          },
          {
            id: 'staff-disabled',
            fullName: 'Nhân Viên Đã Khóa',
            role: 'SELLER_STAFF',
            status: 'LOCKED',
          },
        ],
      });
    if (path.endsWith('/chat/open') || path === '/api/staff/chats/open') {
      opened = true;
      return route.fulfill({ json: item });
    }
    if (path === '/api/seller-staff/chats')
      return route.fulfill({
        json: {
          items: opened
            ? searchParams.get('page') === '2'
              ? [{ ...item, id: otherId, otherPartyName: 'Bình Nhân Viên' }]
              : [item]
            : [],
          page: Number(searchParams.get('page') ?? 1),
          hasMore: !!options.more && searchParams.get('page') !== '2',
        },
      });
    if (path === `/api/seller-staff/chats/${chatId}/images`) {
      if (options.failUpload && !failedUpload) {
        failedUpload = true;
        return route.fulfill({ status: 503, json: { detail: 'Kho ảnh chưa sẵn sàng' } });
      }
      return route.fulfill({ json: { reference: 'evidence:v1:private-fixture' } });
    }
    if (path.endsWith('/image')) return route.fulfill({ contentType: 'image/png', body: png });
    if (path.endsWith('/read'))
      return route.fulfill({ json: { chatId, messagesMarkedRead: 1, unreadCount: 0 } });
    if (path.endsWith('/messages')) {
      if (method === 'POST') {
        const body = request.postDataJSON();
        sent.push(body);
        return route.fulfill({
          json: {
            ...initialMessage,
            id: `sent-${sent.length}`,
            isMine: true,
            senderRole: role,
            content: body.content,
            imageUrl: body.imageReference
              ? `/api/seller-staff/chats/${chatId}/messages/sent-${sent.length}/image`
              : null,
          },
        });
      }
      if (failHistory) {
        failHistory = false;
        return route.fulfill({ status: 503, json: { detail: 'Lịch sử tạm ngưng' } });
      }
      return route.fulfill({
        json: {
          items: [
            {
              ...initialMessage,
              id: searchParams.get('page') === '2' ? 'old-message' : initialMessage.id,
              content:
                searchParams.get('page') === '2' ? 'Tin nhắn công việc cũ' : initialMessage.content,
            },
          ],
          page: Number(searchParams.get('page') ?? 1),
          hasMore: !!options.more && searchParams.get('page') !== '2',
        },
      });
    }
    if (
      path.endsWith('/chats') ||
      path.endsWith('/staff-tasks') ||
      path.endsWith('/kiosk-applications')
    )
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    if (path.endsWith('/technicians') || path.endsWith('/eligible-kiosks'))
      return route.fulfill({ json: [] });
    return route.fulfill({ json: [] });
  });
  return { calls, sent, item };
}

async function selectConversation(page: Page, name = 'Lan Nhân Viên') {
  await page.getByRole('button', { name: new RegExp(`Cuộc trò chuyện với ${name}`) }).click();
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
}

test('Seller opens chat from staff directory and sends contact information through private API', async ({
  page,
}) => {
  const { calls, sent } = await fixture(page, { empty: true });
  await page.goto('/seller/staff');
  await page.getByRole('link', { name: 'Nhắn tin Lan Nhân Viên' }).click();
  await expect(page.getByLabel('Chọn nhân viên đang hoạt động')).toHaveValue('staff-1');
  await expect(page.getByRole('option', { name: 'Nhân Viên Đã Khóa' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Nhắn với nhân viên' }).click();
  await expect(page.getByRole('heading', { name: 'Lan Nhân Viên', exact: true })).toBeVisible();
  const content = 'Gọi 0901234567 hoặc shop@example.vn, xem https://example.vn';
  await page.getByLabel('Nội dung tin nhắn').fill(content);
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toEqual({ content, imageReference: null });
  expect(
    calls.some(
      (call) =>
        call.path === '/api/sellers/shop-1/staff/staff-1/chat/open' &&
        call.method === 'POST' &&
        call.body === null,
    ),
  ).toBe(true);
  expect(calls.some((call) => /^\/api\/chats\//.test(call.path))).toBe(false);
});

test('Seller staff opens its shop conversation without a tenant or staff ID in the request', async ({
  page,
}) => {
  const { calls, sent } = await fixture(page, { role: 'SELLER_STAFF', empty: true });
  await page.goto('/staff/chats');
  await page.getByRole('button', { name: 'Nhắn với chủ shop', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Tiệm Hoa Nhà', exact: true })).toBeVisible();
  await page.getByLabel('Nội dung tin nhắn').fill('Em nhận việc rồi ạ.');
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(calls.find((call) => call.path === '/api/staff/chats/open')).toMatchObject({
    method: 'POST',
    body: null,
  });
  expect(calls.some((call) => call.path.includes('/staff/accounts'))).toBe(false);
});

test('Image upload failure retains the draft and retries via authenticated image endpoint', async ({
  page,
}) => {
  const { calls, sent } = await fixture(page, { failUpload: true });
  await page.goto('/seller/staff-chats');
  await selectConversation(page);
  await page.getByLabel('Nội dung tin nhắn').fill('Ảnh tình trạng ô tủ');
  await page
    .getByLabel('Đính kèm ảnh', { exact: true })
    .setInputFiles({ name: 'slot.png', mimeType: 'image/png', buffer: png });
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect(page.locator('.chat-composer-error')).toContainText('gián đoạn');
  await expect(page.getByLabel('Nội dung tin nhắn')).toHaveValue('Ảnh tình trạng ô tủ');
  expect(sent).toHaveLength(0);
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  expect(sent[0]).toMatchObject({ imageReference: 'evidence:v1:private-fixture' });
  await expect(page.locator('.chat-message-media img').first()).toHaveClass(/is-loaded/);
  await page.getByRole('button', { name: 'Xem ảnh phóng to', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Xem ảnh phóng to', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Xem ảnh phóng to', exact: true })).toHaveCount(0);
  expect(calls.some((call) => call.path === `/api/seller-staff/chats/${chatId}/images`)).toBe(true);
  expect(calls.some((call) => call.path.endsWith('/messages/sent-1/image'))).toBe(true);
});

test('Inactive counterpart remains readable and cannot receive new messages', async ({ page }) => {
  const { sent } = await fixture(page, { inactive: true });
  await page.goto('/seller/staff-chats');
  await selectConversation(page);
  await expect(page.getByText(/hiện không hoạt động/)).toBeVisible();
  await expect(page.getByText(initialMessage.content, { exact: true }).last()).toBeVisible();
  await expect(page.getByLabel('Nội dung tin nhắn')).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Gửi', exact: true })).toBeDisabled();
  expect(sent).toHaveLength(0);
});

test('Read failures retry; paginating the list retains the active conversation and unsent draft', async ({
  page,
}) => {
  await fixture(page, { failHistory: true, more: true });
  await page.goto('/seller/staff-chats');
  await selectConversation(page);
  await page.getByRole('button', { name: 'Tải lại tin nhắn', exact: true }).click();
  await expect(page.locator('.chat-messages-list').getByText(initialMessage.content)).toBeVisible();
  await page.getByLabel('Nội dung tin nhắn').fill('Bản nháp chưa gửi');
  await page.getByRole('button', { name: 'Tải thêm tin nhắn cũ hơn' }).click();
  await expect(
    page.locator('.chat-messages-list').getByText('Tin nhắn công việc cũ'),
  ).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Phân trang cuộc trò chuyện' })
    .getByRole('button', { name: 'Trang sau' })
    .click();
  await expect(page.getByLabel('Nội dung tin nhắn')).toHaveValue('Bản nháp chưa gửi');
  await expect(page.getByRole('heading', { name: 'Lan Nhân Viên', exact: true })).toBeVisible();
});

test('Mobile list does not mark hidden messages read', async ({ page }) => {
  const { calls } = await fixture(page, { role: 'SELLER_STAFF' });
  await page.setViewportSize({ width: 390, height: 900 });
  await page.goto('/staff/chats');
  await expect(
    page.getByRole('button', { name: /Cuộc trò chuyện với Tiệm Hoa Nhà/ }),
  ).toBeVisible();
  expect(calls.filter((call) => call.path.endsWith('/read'))).toHaveLength(0);
  await selectConversation(page, 'Tiệm Hoa Nhà');
  await expect
    .poll(() => calls.filter((call) => call.path.endsWith('/read')).length)
    .toBeGreaterThan(0);
});

test('SignalR delivers private messages once and applies read receipts', async ({ page }) => {
  await fixture(page);
  const sockets: WebSocketRoute[] = [];
  await page.route('**/hub/chat/negotiate?*', (route) =>
    route.fulfill({
      json: {
        negotiateVersion: 1,
        connectionId: 'private-chat',
        connectionToken: 'private-chat-token',
        availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text'] }],
      },
    }),
  );
  await page.routeWebSocket('**/hub/chat?*', (socket) => {
    socket.onMessage((message) => {
      if (String(message).includes('"protocol"')) {
        sockets.push(socket);
        socket.send('{}\u001e');
      }
    });
  });
  await page.goto('/seller/staff-chats');
  await selectConversation(page);
  await expect.poll(() => sockets.length).toBeGreaterThan(0);
  const event = {
    chatId,
    id: 'live-message',
    senderName: 'Lan Nhân Viên',
    senderRole: 'SELLER_STAFF',
    content: 'Em vừa kiểm tra tủ xong.',
    createdAt: '2026-10-20T10:00:00Z',
    imageUrl: null,
    unreadCount: 1,
  };
  const wire =
    JSON.stringify({ type: 1, target: 'ChatMessageReceived', arguments: [event] }) + '\u001e';
  sockets.at(-1)!.send(wire);
  sockets.at(-1)!.send(wire);
  await expect(page.locator('.chat-messages-list').getByText(event.content)).toHaveCount(1);
  await page.getByLabel('Nội dung tin nhắn').fill('Cảm ơn em.');
  await page.getByRole('button', { name: 'Gửi', exact: true }).click();
  await expect(page.locator('[data-message-id="sent-1"]')).toBeVisible();
  sockets.at(-1)!.send(
    JSON.stringify({
      type: 1,
      target: 'ChatMessagesRead',
      arguments: [
        {
          chatId,
          readerName: 'Lan',
          readerRole: 'SELLER_STAFF',
          readThroughMessageId: 'sent-1',
          readThroughCreatedAt: '2026-10-20T12:00:00Z',
          readAt: '2026-10-20T12:01:00Z',
          messagesMarkedRead: 1,
        },
      ],
    }) + '\u001e',
  );
  await expect(page.locator('[data-message-id="sent-1"]').getByText('Đã xem')).toBeVisible();
});

for (const role of ['CUSTOMER', 'ADMIN', 'OPERATIONS_MANAGER', 'TECHNICIAN']) {
  test(`${role} cannot access seller-staff chat APIs`, async ({ page }) => {
    const { calls } = await fixture(page, { role });
    await page.goto('/staff/chats');
    await expect(page).not.toHaveURL(/\/staff\/chats$/);
    expect(
      calls.some(
        (call) =>
          call.path.startsWith('/api/seller-staff/') || call.path === '/api/staff/chats/open',
      ),
    ).toBe(false);
  });
}

for (const width of [390, 1440]) {
  test(`Private chat is accessible and reflows at ${width}px`, async ({ page }) => {
    await fixture(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/seller/staff-chats');
    await selectConversation(page);
    await expect(page.getByLabel('Nội dung tin nhắn')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
    await page.screenshot({ path: `artifacts/staff-chat-${width}.png`, fullPage: true });
  });
}

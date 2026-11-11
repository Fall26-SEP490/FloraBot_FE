import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { setupSellerUsability, shopId, kioskId, productId } from '../fixtures/seller-usability';

const chatId = '90000000-0000-0000-0000-000000000001';
const chat = {
  id: chatId,
  otherPartyName: 'Đặng Lan',
  createdAt: '2026-10-20T08:00:00Z',
  lastMessageAt: '2026-10-20T09:00:00Z',
  lastMessage: 'Mình muốn xem mẫu hoa',
  lastMessageHasImage: false,
  productContext: 'Hồng pastel',
  unreadCount: 1,
};
async function chatFixture(page: Page) {
  const base = await setupSellerUsability(page);
  const sent: unknown[] = [];
  const state = { incomingVersion: 1, historyReads: 0, readWrites: 0 };
  await page.route(`**/api/sellers/${shopId}/chats?*`, (route) => {
    const current = Number(new URL(route.request().url()).searchParams.get('page') ?? 1);
    return route.fulfill({
      json: {
        items:
          current === 1
            ? [chat]
            : current === 2
              ? [{ ...chat, id: 'chat-b', otherPartyName: 'Bình', unreadCount: 0 }]
              : [],
        page: current,
        hasMore: current < 3,
      },
    });
  });
  await page.route('**/api/chats/**', (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path.endsWith('/read')) {
      state.readWrites++;
      return route.fulfill({ json: { messagesMarkedRead: 1 } });
    }
    const message = {
      id: `message-${state.incomingVersion}`,
      content: 'Mình muốn xem mẫu hoa',
      senderName: 'Đặng Lan',
      isMine: false,
      createdAt: '2026-10-20T09:00:00Z',
      imageUrl: null,
      readAt: null,
    };
    if (req.method() === 'GET') {
      state.historyReads++;
      return route.fulfill({ json: { items: [message], page: 1, hasMore: false } });
    }
    sent.push(req.postDataJSON());
    return route.fulfill({
      json: { ...message, ...req.postDataJSON(), id: 'sent-a', isMine: true },
    });
  });
  return { base, sent, state };
}
async function accessible(page: Page) {
  expect(
    (
      await new AxeBuilder({ page })
        .include('#main')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
}

for (const width of [390, 1440]) {
  test(`Seller chat keeps drafts while paging and optional customer info works at ${width}`, async ({
    page,
  }) => {
    const model = await chatFixture(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/seller/chats');
    if (width === 390)
      await page.getByRole('button', { name: /Cuộc trò chuyện với Đặng Lan/ }).click();
    await expect(page.getByLabel('Nội dung tin nhắn')).toBeVisible();
    await expect(page.getByText('Trực tuyến', { exact: true })).toHaveCount(0);
    await expect(page.locator('.chat-details-panel')).toHaveCount(0);
    await page.getByRole('button', { name: 'Kiểm tra mẫu hoa', exact: true }).click();
    await expect(page.getByLabel('Nội dung tin nhắn')).not.toHaveValue(
      /30-45|có sẵn|đã chuẩn bị xong/,
    );
    await page.getByLabel('Nội dung tin nhắn').fill('Bản nháp cần giữ');
    await page.getByRole('button', { name: 'Xem thông tin khách hàng', exact: true }).click();
    const details = page.getByRole('complementary', { name: 'Thông tin chi tiết khách hàng' });
    await expect(details).toBeVisible();
    await expect(details).toContainText('chưa đồng bộ với tài khoản hoặc thiết bị khác');
    await expect(
      details.getByRole('button', { name: 'Thu gọn bảng thông tin', exact: true }),
    ).toBeFocused();
    await details.getByLabel('Ghi chú khách hàng trên trình duyệt').fill('Ghi chú kiểm thử riêng');
    await details.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
    await expect(details.getByRole('status')).toHaveText('Đã lưu ghi chú trên trình duyệt này.');
    await accessible(page);
    await details.press('Escape');
    await expect(
      page.getByRole('button', { name: 'Xem thông tin khách hàng', exact: true }),
    ).toBeFocused();
    await expect(page.getByLabel('Nội dung tin nhắn')).toHaveValue('Bản nháp cần giữ');
    if (width === 390)
      await page
        .getByRole('button', { name: 'Quay lại danh sách cuộc trò chuyện', exact: true })
        .click();
    await page.getByLabel('Tìm kiếm cuộc trò chuyện', { exact: true }).fill('dang lan');
    await expect(page.getByRole('button', { name: /Cuộc trò chuyện với Đặng Lan/ })).toBeVisible();
    await page.getByLabel('Tìm kiếm cuộc trò chuyện', { exact: true }).fill('khongco');
    await page.getByRole('button', { name: /^Chưa đọc/ }).click();
    await expect(page.locator('.chat-list-empty-search')).toContainText('Thử từ khóa khác');
    await page.getByRole('button', { name: 'Xóa bộ lọc hội thoại', exact: true }).click();
    await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
    await expect(page.locator('.chat-list-scope')).toContainText('Trang 2');
    await page.getByRole('button', { name: 'Trang sau', exact: true }).click();
    await expect(page.locator('.chat-list-scope')).toContainText('0/0 hội thoại · Trang 3');
    await expect(page.getByRole('button', { name: 'Trang trước', exact: true })).toBeEnabled();
    if (width === 390) {
      await page.getByRole('button', { name: 'Trang trước', exact: true }).click();
      await page.getByRole('button', { name: 'Trang trước', exact: true }).click();
      await page.getByRole('button', { name: /Cuộc trò chuyện với Đặng Lan/ }).click();
    }
    await expect(page.getByLabel('Nội dung tin nhắn')).toHaveValue('Bản nháp cần giữ');
    expect(model.sent).toEqual([]);
    expect(model.base.writes).toEqual([]);
  });

  test(`Seller selects a valid empty slot from details before stocking at ${width}`, async ({
    page,
  }) => {
    const model = await setupSellerUsability(page);
    await page.setViewportSize({ width, height: 1000 });
    let stockWrites = 0;
    await page.route('**/api/me/flows/stock_bouquet', (route) => {
      stockWrites++;
      expect(route.request().postDataJSON()).toEqual({
        productId,
        slotId: '60000000-0000-0000-0000-000000000001',
      });
      return route.fulfill({ json: { result: 'stocked-test' } });
    });
    await page.goto('/seller/stock');
    await expect(page.getByLabel('Thống kê ô tủ')).toHaveCount(0);
    await page.getByRole('button', { name: 'Xem chi tiết ô A01', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Chi tiết ô A01', exact: true });
    await modal.getByRole('button', { name: 'Chọn ô này để nạp hoa', exact: true }).click();
    await expect(modal).toBeHidden();
    await expect(page.getByLabel('1. Chọn ô Walk-in trống', { exact: true })).toHaveValue(
      '60000000-0000-0000-0000-000000000001',
    );
    await expect(page.getByLabel('2. Chọn mẫu hoa', { exact: true })).toBeFocused();
    expect(stockWrites).toBe(0);
    await page.getByLabel('2. Chọn mẫu hoa', { exact: true }).selectOption(productId);
    await expect(page.getByRole('note', { name: 'Kiểm tra trước khi nạp hoa' })).toContainText(
      'chỉ mua trực tiếp tại kiosk',
    );
    await accessible(page);
    await page.getByRole('button', { name: 'Nạp hoa vào ô', exact: true }).click();
    await expect(page.locator('.seller-stock')).toContainText('Đã ghi nhận');
    expect(stockWrites).toBe(1);
    expect(model.writes).toEqual([]);
  });

  test(`Seller kiosk editor is optional, keeps drafts, and uses unchanged location PUT at ${width}`, async ({
    page,
    context,
  }) => {
    const model = await setupSellerUsability(page);
    await page.setViewportSize({ width, height: 1000 });
    await page.route('https://**', (route) =>
      route.fulfill({ status: 503, body: 'Test external map unavailable' }),
    );
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 10.8, longitude: 106.7 });
    let writes = 0;
    await page.route(`**/api/sellers/${shopId}/kiosks/${kioskId}/location`, (route) => {
      writes++;
      expect(route.request().method()).toBe('PUT');
      expect(route.request().postDataJSON()).toEqual({
        address: 'Địa chỉ mới kiểm thử',
        latitude: 10.8,
        longitude: 106.7,
      });
      return route.fulfill({ json: { id: kioskId, name: 'Tủ kiểm thử Seller' } });
    });
    await page.goto('/seller/kiosks');
    const card = page.locator('.kiosk-card');
    await expect(card).toContainText('Địa chỉ kiểm thử');
    await expect(card.locator('.kiosk-form')).toHaveCount(0);
    await expect(
      card.getByRole('region', { name: 'Bản đồ vị trí của Tủ kiểm thử Seller' }),
    ).toBeVisible();
    const info = await card.locator('.kiosk-card-information').boundingBox();
    const map = await card.locator('.kiosk-map-column').boundingBox();
    expect(info).not.toBeNull();
    expect(map).not.toBeNull();
    if (width < 1050) {
      expect(map!.y).toBeGreaterThanOrEqual(info!.y + info!.height);
    } else {
      expect(map!.x).toBeGreaterThanOrEqual(info!.x + info!.width);
    }
    await card.getByText('Chỉnh địa chỉ và ghim bản đồ', { exact: true }).click();
    await card.getByLabel('Tìm địa chỉ kiosk', { exact: false }).fill('Địa chỉ mới kiểm thử');
    await card.getByText('Chỉnh địa chỉ và ghim bản đồ', { exact: true }).click();
    await card.getByText('Chỉnh địa chỉ và ghim bản đồ', { exact: true }).click();
    await expect(card.getByLabel('Tìm địa chỉ kiosk', { exact: false })).toHaveValue(
      'Địa chỉ mới kiểm thử',
    );
    await card.getByRole('button', { name: 'Dùng vị trí hiện tại', exact: true }).click();
    await expect(card.locator('.kiosk-location-selection')).toContainText('Đã chọn vị trí ghim');
    await expect(card.locator('.kiosk-disclaimer')).toContainText(
      'việc chuyển tủ thực tế cần phối hợp',
    );
    await accessible(page);
    await card.getByRole('button', { name: 'Lưu vị trí kiosk', exact: true }).click();
    await expect(card.locator('.kiosk-feedback-success')).toContainText('Đã lưu vị trí');
    expect(writes).toBe(1);
    expect(model.writes).toEqual([]);
  });
}

test('Seller local notes preserve draft and report a storage failure instead of false success', async ({
  page,
}) => {
  await chatFixture(page);
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith('florabot_chat_notes_')) throw new Error('Test blocked storage');
      return original.call(this, key, value);
    };
  });
  await page.goto('/seller/chats');
  await page.getByRole('button', { name: 'Xem thông tin khách hàng', exact: true }).click();
  const details = page.getByRole('complementary', { name: 'Thông tin chi tiết khách hàng' });
  await details.getByLabel('Ghi chú khách hàng trên trình duyệt').fill('Nội dung cần giữ');
  await details.getByRole('button', { name: 'Lưu ghi chú', exact: true }).click();
  await expect(details.getByRole('alert')).toContainText('Chưa lưu được trên trình duyệt');
  await expect(details.getByLabel('Ghi chú khách hàng trên trình duyệt')).toHaveValue(
    'Nội dung cần giữ',
  );
  await expect(details.getByRole('status')).toBeEmpty();
});

test('Seller only reads new messages after returning from compact customer information', async ({
  page,
}) => {
  const model = await chatFixture(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/seller/chats');
  await expect(page.getByLabel('Nội dung tin nhắn')).toBeVisible();
  await expect.poll(() => model.state.readWrites).toBe(1);
  const initialReads = model.state.historyReads;
  await page.getByRole('button', { name: 'Xem thông tin khách hàng', exact: true }).click();
  await expect(page.locator('.chat-layout-main')).toBeHidden();
  model.state.incomingVersion = 2;
  const refresh = page.getByRole('button', { name: 'Làm mới danh sách tin nhắn', exact: true });
  await refresh.click();
  await expect(refresh).toBeEnabled();
  expect(model.state.historyReads).toBe(initialReads);
  expect(model.state.readWrites).toBe(1);
  await page.getByRole('button', { name: 'Thu gọn bảng thông tin', exact: true }).click();
  await expect(page.getByLabel('Nội dung tin nhắn')).toBeVisible();
  await expect.poll(() => model.state.historyReads).toBeGreaterThan(initialReads);
  await expect.poll(() => model.state.readWrites).toBe(2);
  expect(model.sent).toEqual([]);
});

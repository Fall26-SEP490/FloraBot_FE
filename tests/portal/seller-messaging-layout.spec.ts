import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const routeName of ['chats', 'staff-chats']) {
  for (const width of [390, 820, 1440]) {
    test(`seller ${routeName} layout at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 960 });
      let sent = 0;
      await page.route('**/hub/**', (route) => route.abort());
      const item = {
        id: 'chat-ui-1',
        otherPartyName: 'Lan kiểm thử',
        otherPartyActive: true,
        otherPartyRole: routeName === 'chats' ? 'CUSTOMER' : 'SELLER_STAFF',
        productContext: routeName === 'chats' ? 'Bó hồng pastel' : null,
        lastMessage: 'Hoa đã sẵn sàng tại kiosk.',
        lastMessageAt: new Date().toISOString(),
        unreadCount: routeName === 'chats' ? 0 : 1,
        createdAt: new Date().toISOString(),
      };
      await page.route('**/api/**', (route) => {
        const path = new URL(route.request().url()).pathname;
        if (path === '/api/auth/me')
          return route.fulfill({
            json: {
              id: 'seller-ui',
              sellerId: 'shop-ui',
              role: 'SELLER',
              sellerStatus: 'ACTIVE',
              name: 'Shop kiểm thử',
            },
          });
        if (path.endsWith('/staff/accounts'))
          return route.fulfill({
            json: [{ id: 'staff-1', fullName: 'Lan kiểm thử', status: 'ACTIVE' }],
          });
        if (path.endsWith('/chat/open')) return route.fulfill({ json: item });
        if (path.endsWith('/chats'))
          return route.fulfill({ json: { items: [item], page: 1, hasMore: false } });
        if (path.endsWith('/read'))
          return route.fulfill({ json: { messagesMarkedRead: 1, unreadCount: 0 } });
        if (path.endsWith('/messages')) {
          const message = {
            id: 'message-ui',
            senderName: 'Lan kiểm thử',
            senderRole: item.otherPartyRole,
            content: item.lastMessage,
            createdAt: item.lastMessageAt,
            isMine: false,
            imageUrl: null,
            readAt: null,
          };
          if (route.request().method() === 'POST') {
            sent++;
            return route.fulfill({
              json: {
                ...message,
                id: `sent-${sent}`,
                isMine: true,
                content: route.request().postDataJSON().content,
              },
            });
          }
          return route.fulfill({ json: { items: [message], page: 1, hasMore: false } });
        }
        return route.fulfill({ json: [] });
      });
      await page.goto(`/seller/${routeName}`);
      await page.locator('.chat-list-item').first().click();
      await expect(page.getByLabel('Nội dung tin nhắn', { exact: true })).toBeVisible();
      if (routeName === 'chats') {
        await expect(page.getByRole('button', { name: 'Chào bạn', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Hỏi tiến độ', exact: true })).toHaveCount(0);
      } else {
        await expect(page.getByRole('button', { name: 'Hỏi tiến độ', exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Chào bạn', exact: true })).toHaveCount(0);
      }
      await page.getByLabel('Nội dung tin nhắn', { exact: true }).fill('Tin nhắn kiểm tra bố cục');
      await page.getByRole('button', { name: 'Gửi', exact: true }).click();
      await expect(page.locator('.chat-messages-list')).toContainText('Tin nhắn kiểm tra bố cục');
      expect(sent).toBe(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      const composer = await page.locator('.chat-composer-controls').boundingBox();
      expect(composer!.width).toBeLessThan(width);
      expect(
        (await page.locator('.chat-composer-submit-btn').boundingBox())!.height,
      ).toBeLessThanOrEqual(36);
      expect(
        await page
          .locator('.chat-composer-image-btn')
          .evaluate((element) => getComputedStyle(element).borderTopWidth),
      ).toBe('0px');
      const audit = await new AxeBuilder({ page }).include('.seller-messaging').analyze();
      expect(audit.violations).toEqual([]);
      const activeTab = page.locator('.seller-stage-tabs a[aria-current="page"]');
      expect(
        await activeTab.evaluate((element) => getComputedStyle(element).borderBottomWidth),
      ).toBe('2px');
      expect(await activeTab.evaluate((element) => getComputedStyle(element).borderRadius)).toBe(
        '0px',
      );
      if (routeName === 'chats') {
        await page.locator('.chat-details-toggle-btn').click();
        const panel = page.getByRole('complementary', { name: 'Thông tin chi tiết khách hàng' });
        await expect(panel).toBeVisible();
        await expect(panel.getByRole('heading', { name: 'Ghi chú riêng' })).toBeVisible();
        await panel
          .getByRole('textbox', { name: 'Ghi chú khách hàng trên trình duyệt' })
          .fill('Khách thích hoa hồng');
        await panel.getByRole('button', { name: 'Lưu ghi chú' }).click();
        await expect(panel.locator('.chat-note-card')).toContainText('Khách thích hoa hồng');
        expect(
          (await new AxeBuilder({ page }).include('.seller-messaging').analyze()).violations,
        ).toEqual([]);
        await panel.getByRole('button', { name: 'Xóa ghi chú' }).click();
        await expect(panel.getByText('Chưa có ghi chú.', { exact: true })).toBeVisible();
        await panel.getByRole('button', { name: 'Thu gọn bảng thông tin' }).click();
        await expect(panel).toBeHidden();
      }
      if (width === 390) {
        await page.getByRole('button', { name: 'Quay lại danh sách cuộc trò chuyện' }).click();
        await expect(page.locator('.chat-layout-sidebar')).toBeVisible();
        await expect(page.locator('.chat-layout-main')).toBeHidden();
      }
      if (routeName === 'chats') {
        const unreadTab = page.getByRole('button', { name: /^Chưa đọc/ });
        const clear = page.getByRole('button', { name: 'Xóa bộ lọc hội thoại', exact: true });
        await unreadTab.click();
        await expect(page.getByText('Không có tin nhắn chưa đọc', { exact: true })).toBeVisible();
        await expect(clear).toHaveCount(0);
        const search = page.getByRole('searchbox', { name: 'Tìm kiếm cuộc trò chuyện' });
        await search.fill('Không khớp');
        await expect(clear).toBeVisible();
        await clear.click();
        await expect(search).toHaveValue('');
        await expect(unreadTab).toHaveAttribute('aria-pressed', 'true');
        await expect(clear).toHaveCount(0);
        await page.getByRole('button', { name: /^Tất cả/ }).click();
        await expect(page.locator('.chat-list-item')).toHaveCount(1);
      }
    });
  }
}

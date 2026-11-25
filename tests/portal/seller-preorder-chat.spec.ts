import { expect, test } from '@playwright/test';
import { setupSellerUsability, sampleRequest, shopId } from '../fixtures/seller-usability';

for (const width of [390, 1440]) {
  test(`accessory changes preserve quote draft during chat at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setupSellerUsability(page);
    await page.route(`**/api/sellers/${shopId}/preorders?*`, (route) =>
      route.fulfill({
        json: {
          items: [
            {
              ...sampleRequest,
              requestedAccessories: [{ accessoryId: 'ribbon', name: 'Nơ', quantity: 2 }],
            },
          ],
          hasMore: false,
        },
      }),
    );
    await page.route(`**/api/sellers/${shopId}/accessories?*`, (route) =>
      route.fulfill({
        json: [
          {
            id: 'ribbon',
            name: 'Nơ',
            price: 1000,
            stockQuantity: 10,
            status: 'ACTIVE',
            scope: 'SHOP',
            kioskId: null,
          },
        ],
      }),
    );
    await page.route('**/chat/open', (route) =>
      route.fulfill({
        json: { id: 'draft-chat', otherPartyName: 'Khách báo giá', unreadCount: 0 },
      }),
    );
    await page.route('**/api/chats/draft-chat/messages?*', (route) =>
      route.fulfill({ json: { items: [], hasMore: false } }),
    );
    await page.route('**/api/chats/draft-chat/read', (route) => route.fulfill({ json: {} }));
    await page.goto('/seller/orders');
    await page.locator('#web-orders summary').first().click();
    await page.getByRole('button', { name: 'Báo giá hoặc từ chối', exact: true }).click();
    const warning = page.getByRole('status').filter({ hasText: 'Phụ kiện đã thay đổi' });
    await expect(warning).toHaveCount(0);
    await page.getByLabel('Giá bó hoa (đồng)', { exact: true }).fill('25000');
    await page.getByLabel('Ghi chú cho khách', { exact: true }).fill('Ghi chú bản nháp');
    await page.getByText('Điều chỉnh phụ kiện', { exact: true }).click();
    const quantityInput = page.getByRole('spinbutton', { name: 'Số lượng xác nhận Nơ' });
    await quantityInput.fill('');
    await expect(quantityInput).toHaveValue('');
    await quantityInput.fill('1');
    await quantityInput.blur();
    await expect(quantityInput).toHaveValue('1');
    await expect(warning).toBeVisible();
    await quantityInput.fill('2');
    await quantityInput.blur();
    await expect(warning).toHaveCount(0);
    await page.getByRole('button', { name: 'Bỏ Nơ khỏi báo giá', exact: true }).click();
    await expect(warning).toBeVisible();
    await page.getByRole('button', { name: 'Nhắn khách', exact: true }).click();
    const chat = page.getByRole('dialog', { name: 'Nhắn khách', exact: true });
    await expect(chat).toContainText('Khách báo giá');
    await chat.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click();
    await expect(page.getByLabel('Giá bó hoa (đồng)', { exact: true })).toHaveValue('25000');
    await expect(page.getByLabel('Ghi chú cho khách', { exact: true })).toHaveValue(
      'Ghi chú bản nháp',
    );
    await expect(warning).toBeVisible();
    await page.getByRole('button', { name: 'Thêm lại Nơ vào báo giá', exact: true }).click();
    await expect(warning).toHaveCount(0);
    await expect(page).toHaveURL(/\/seller\/orders/);
  });
  test(`seller opens the correct preorder customer chat at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setupSellerUsability(page);
    let opens = 0;
    await page.route(`**/api/sellers/${shopId}/preorders?*`, (route) =>
      route.fulfill({
        json: {
          items: [{ ...sampleRequest, id: 'chat-request', orderCode: 'FB-CHAT' }],
          hasMore: false,
        },
      }),
    );
    await page.route(`**/api/sellers/${shopId}/preorders/chat-request/chat/open`, (route) => {
      expect(route.request().method()).toBe('POST');
      opens++;
      return route.fulfill({
        json: {
          id: 'target-chat',
          otherPartyName: 'Khách đúng đơn',
          productContext: 'Hoa của đơn',
          createdAt: '2026-11-25T00:00:00Z',
          unreadCount: 0,
        },
      });
    });
    await page.route(`**/api/sellers/${shopId}/chats?*`, (route) =>
      route.fulfill({
        json: {
          items: [{ id: 'unrelated-chat', otherPartyName: 'Khách khác', unreadCount: 0 }],
          hasMore: false,
        },
      }),
    );
    await page.route('**/api/chats/target-chat/messages?*', (route) =>
      route.fulfill({ json: { items: [], hasMore: false } }),
    );
    await page.route('**/api/chats/target-chat/read', (route) => route.fulfill({ json: {} }));
    await page.goto('/seller/orders');
    await page.locator('#web-orders summary').first().click();
    const button = page.getByRole('button', { name: 'Nhắn khách', exact: true });
    await expect(button).toBeVisible();
    await page.route(`**/api/sellers/${shopId}/preorders/chat-request/chat/open`, (route) =>
      route.fulfill({ status: 404, json: { detail: 'Not found' } }),
    );
    await button.click();
    const feedback = page.getByRole('alert').filter({ hasText: 'Chưa mở được chat từ đơn này.' });
    await expect(feedback).toBeVisible();
    await expect(page).toHaveURL(/\/seller\/orders/);
    expect(
      await feedback.evaluate((el) => el.parentElement?.classList.contains('stock-actions')),
    ).toBe(false);
    const actions = button.locator('..');
    expect(await actions.evaluate((el) => getComputedStyle(el).borderTopWidth)).toBe('0px');
    const cancel = page.getByRole('button', { name: 'Hủy yêu cầu', exact: true });
    await expect(cancel).toBeVisible();
    expect(await cancel.evaluate((el) => getComputedStyle(el).borderTopColor)).not.toBe(
      'rgba(0, 0, 0, 0)',
    );
    await page.unroute(`**/api/sellers/${shopId}/preorders/chat-request/chat/open`);
    await page.route(`**/api/sellers/${shopId}/preorders/chat-request/chat/open`, (route) => {
      opens++;
      return route.fulfill({
        json: {
          id: 'target-chat',
          otherPartyName: 'Khách đúng đơn',
          productContext: 'Hoa của đơn',
          createdAt: '2026-11-25T00:00:00Z',
          unreadCount: 0,
        },
      });
    });
    await button.click();
    await expect(page).toHaveURL(/\/seller\/chats\?chat=target-chat/);
    await expect(page.locator('.chat-layout-main')).toContainText('Khách đúng đơn');
    await expect(page.locator('.chat-layout-main')).not.toContainText('Khách khác');
    expect(opens).toBe(1);
  });
}

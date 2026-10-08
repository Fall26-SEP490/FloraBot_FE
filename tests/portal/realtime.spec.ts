import { expect, test, type WebSocketRoute } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/admin/withdrawals?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
});

test('Realtime refresh preserves filters and focus, reconnects, and stops on logout', async ({
  page,
}) => {
  let sockets: WebSocketRoute[] = [];
  let reads = 0;
  let name = 'Hoa ban đầu';
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { id: 'admin', name: 'Quản trị', role: 'ADMIN' } }),
  );
  await page.route('**/api/auth/logout', (route) => route.fulfill({ status: 204 }));
  await page.route('**/api/packages', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/admin/slots', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/admin/sellers?*', (route) => {
    reads++;
    return route.fulfill({
      json: [{ id: 'shop', shopName: name, phone: '0901234567', status: 'PENDING' }],
    });
  });
  await page.route('**/hub/portal/negotiate?*', (route) =>
    route.fulfill({
      json: {
        negotiateVersion: 1,
        connectionId: 'test',
        connectionToken: 'test',
        availableTransports: [{ transport: 'WebSockets', transferFormats: ['Text'] }],
      },
    }),
  );
  await page.routeWebSocket('**/hub/portal?*', (socket) => {
    socket.onMessage((message) => {
      if (String(message).includes('"protocol"')) {
        sockets = [...sockets, socket];
        socket.send('{}\u001e');
      }
    });
  });
  await page.goto('/admin');
  await expect.poll(() => sockets.length).toBeGreaterThan(0);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  const search = page.getByLabel('Tìm tên shop hoặc số điện thoại');
  await search.fill('Hoa');
  name = 'Hoa vừa đăng ký';
  sockets.at(-1)!.send('{"type":1,"target":"Refresh","arguments":[]}\u001e');
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await expect(search).toHaveValue('Hoa');
  await expect(search).toBeFocused();
  const count = sockets.length;
  name = 'Hoa sau kết nối lại';
  sockets.at(-1)!.close({ code: 1011, reason: 'test reconnect' });
  await expect.poll(() => sockets.length).toBeGreaterThan(count);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  const readsAfterLogout = reads;
  await page.clock.install();
  await page.clock.fastForward(35_000);
  expect(reads).toBe(readsAfterLogout);
});

test('Unavailable realtime retains periodic API refresh', async ({ page }) => {
  let name = 'Hoa trước cập nhật';
  await page.clock.install();
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { id: 'admin', name: 'Quản trị', role: 'ADMIN' } }),
  );
  await page.route('**/api/packages', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/admin/slots', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/admin/sellers?*', (route) =>
    route.fulfill({
      json: [{ id: 'shop', shopName: name, phone: '0901234567', status: 'PENDING' }],
    }),
  );
  await page.goto('/admin');
  await expect(page.getByText(name, { exact: true })).toBeVisible();
  name = 'Hoa sau cập nhật định kỳ';
  await page.clock.fastForward(30_100);
  await expect(page.getByText(name, { exact: true })).toBeVisible();
});

import { expect, test } from '@playwright/test';

for (const role of ['ADMIN', 'SELLER'] as const) {
  for (const failure of ['refresh503', 'network', 'timeout'] as const) {
    test(`${role} keeps the dashboard and recovers after ${failure}`, async ({ page }) => {
      const path = role === 'ADMIN' ? '/admin' : '/seller/stock';
      const heading = role === 'ADMIN' ? 'Tổng quan quản trị' : 'Hoa tại tủ';
      const session = {
        id: '10000000-0000-0000-0000-000000000003',
        name: 'Session test',
        role,
        sellerId: role === 'SELLER' ? '20000000-0000-0000-0000-000000000001' : null,
        sellerStatus: 'ACTIVE',
        packageExpiresAt: '2027-11-18',
      };
      let failing = false;
      let meCalls = 0;
      let refreshCalls = 0;
      await page.route('**/api/**', async (route) => {
        const url = new URL(route.request().url());
        if (url.pathname === '/api/auth/me') {
          meCalls++;
          if (failing && failure === 'network') return route.abort('connectionfailed');
          return route.fulfill(failing ? { status: 401 } : { json: session });
        }
        if (url.pathname === '/api/auth/refresh') {
          refreshCalls++;
          return route.fulfill({ status: 503 });
        }
        if (url.pathname.endsWith('/wallet'))
          return route.fulfill({ json: { entries: [], withdrawals: [] } });
        if (url.pathname.endsWith('/subscriptions'))
          return route.fulfill({ json: { package: null, subscriptions: [] } });
        if (/notifications|incidents|withdrawals/.test(url.pathname))
          return route.fulfill({ json: { items: [], unreadCount: 0, hasMore: false } });
        return route.fulfill({ json: [] });
      });
      if (failure === 'timeout') {
        // Deliver the same rejection as AbortSignal.timeout without a held Playwright route.
        await page.addInitScript(() => {
          const state = window as Window & { sessionTimeout?: boolean };
          const originalFetch = window.fetch.bind(window);
          window.fetch = (input, init) => {
            if (state.sessionTimeout && String(input) === '/api/auth/me')
              return Promise.reject(new DOMException('Timeout', 'TimeoutError'));
            return originalFetch(input, init);
          };
        });
      }
      await page.clock.install();
      await page.goto(path);
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      const initial = meCalls;
      failing = true;
      if (failure === 'timeout')
        await page.evaluate(() => {
          (window as Window & { sessionTimeout?: boolean }).sessionTimeout = true;
        });
      await page.clock.fastForward(61_000);
      if (failure !== 'timeout') await expect.poll(() => meCalls).toBeGreaterThan(initial);
      for (let i = 0; i < 4; i++) {
        await page.clock.runFor(3000);
        await page.waitForTimeout(50);
      }
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
      await expect(page.getByText('Kết nối đang gián đoạn.', { exact: false })).toBeVisible({
        timeout: 5000,
      });
      expect(new URL(page.url()).pathname).toBe(path);
      if (failure === 'refresh503') expect(refreshCalls).toBeGreaterThan(0);
      failing = false;
      if (failure === 'timeout')
        await page.evaluate(() => {
          (window as Window & { sessionTimeout?: boolean }).sessionTimeout = false;
        });
      await page.clock.runFor(16_000);
      await expect(page.getByText('Kết nối đang gián đoạn.', { exact: false })).toHaveCount(0, {
        timeout: 20_000,
      });
      await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
    });
  }
}

test('Initial connection failure retries while the error screen remains mounted', async ({
  page,
}) => {
  let available = false;
  let calls = 0;
  await page.route('**/api/**', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/auth/me', (route) => {
    calls++;
    return route.fulfill(
      available ? { json: { id: 'test', name: 'Admin', role: 'ADMIN' } } : { status: 503 },
    );
  });
  await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 401 }));
  await page.clock.install();
  await page.goto('/admin');
  await expect.poll(() => calls).toBeGreaterThan(0);
  await page.clock.runFor(5000);
  await expect(page.getByRole('heading', { name: 'Chưa kết nối được FloraBot' })).toBeVisible();
  available = true;
  await page.clock.runFor(12_000);
  await expect(page.getByRole('heading', { name: 'Tổng quan quản trị' })).toBeVisible();
});

for (const role of ['ADMIN', 'SELLER'] as const) {
  test(`${role} redirects when refresh is rejected despite a cached session`, async ({ page }) => {
    let revoked = false;
    await page.route('**/api/**', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/auth/me', (route) =>
      route.fulfill(
        revoked
          ? { status: 401 }
          : {
              json: {
                id: 'test',
                name: 'Session test',
                role,
                sellerId: role === 'SELLER' ? '20000000-0000-0000-0000-000000000001' : null,
              },
            },
      ),
    );
    await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 401 }));
    await page.clock.install();
    await page.goto(role === 'ADMIN' ? '/admin' : '/seller');
    await expect(
      page.getByRole('heading', {
        name: role === 'ADMIN' ? 'Tổng quan quản trị' : 'Tổng quan cửa hàng',
        exact: true,
      }),
    ).toBeVisible();
    revoked = true;
    await page.clock.fastForward(61_000);
    await expect
      .poll(() => new URL(page.url()).pathname)
      .toBe(role === 'ADMIN' ? '/admin/login' : '/dang-nhap');
  });
}

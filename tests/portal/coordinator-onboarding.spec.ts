import { expect, test, type Page } from '@playwright/test';

const customer = {
  id: 'e0100000-0000-0000-0000-000000000001',
  name: 'Khách kiểm thử',
  role: 'CUSTOMER',
  sellerId: null,
  sellerStatus: null,
  packageExpiresAt: null,
};
const trial = {
  id: '20000000-0000-0000-0000-00000000000c',
  name: 'Trial',
  annualFee: 10000,
  walkInSlots: 1,
  preorderSlots: 1,
  totalSlots: 2,
  termMonths: 12,
  status: 'ACTIVE',
  description: 'Gói một năm từ khi bàn giao.',
};
const application = {
  id: 'e0200000-0000-0000-0000-000000000001',
  customerId: customer.id,
  packageId: trial.id,
  packageName: 'Trial',
  annualFee: 10000,
  walkInSlots: 1,
  preorderSlots: 1,
  totalSlots: 2,
  shopName: 'Shop kiểm thử',
  phone: '0901234567',
  contactEmail: 'shop@example.invalid',
  installationAddress: 'Địa chỉ kiểm thử, không có thiết bị thật',
  latitude: 10.8,
  longitude: 106.8,
  bankName: 'Ngân hàng kiểm thử',
  bankHolder: 'NGUOI KIEM THU',
  bankAccountSuffix: '1234',
  status: 'AWAITING_PAYMENT',
  createdAt: '2026-10-15T01:00:00Z',
  updatedAt: '2026-10-15T01:00:00Z',
  paymentStatus: 'PENDING',
  canVoluntaryCancel: true,
};

async function mockGoongPlaces(page: Page, lat = 10.8, lng = 106.8) {
  await page.route(/rsapi\.goong\.io\/Place\/AutoComplete/, async (route) => {
    const input = new URL(route.request().url()).searchParams.get('input') || 'Địa chỉ gợi ý';
    return route.fulfill({
      status: 200,
      json: {
        status: 'OK',
        predictions: [
          {
            place_id: 'mock-place-id',
            description: input,
            structured_formatting: {
              main_text: input,
              secondary_text: 'TP.HCM',
            },
          },
        ],
      },
    });
  });

  await page.route(/rsapi\.goong\.io\/Place\/Detail/, async (route) =>
    route.fulfill({
      status: 200,
      json: {
        status: 'OK',
        result: {
          place_id: 'mock-place-id',
          name: 'Địa điểm kiểm thử',
          formatted_address: 'Địa điểm kiểm thử, TP.HCM',
          geometry: { location: { lat, lng } },
        },
      },
    }),
  );
}

async function selectAddressSuggestion(page: Page, addressText: string) {
  const input = page.getByLabel('Địa chỉ lắp đặt cụ thể');
  await input.fill(addressText);
  const option = page
    .getByRole('listbox', { name: 'Gợi ý địa chỉ Goong' })
    .getByRole('option')
    .first();
  await expect(option).toBeVisible();
  await option.click();
}

async function mockCustomer(
  page: Page,
  options: { checkoutUrl?: string; hasApplication?: boolean } = {},
) {
  const calls = { create: 0, reconcile: 0, lastPayload: null as Record<string, unknown> | null };
  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ json: customer });
    if (path === '/api/kiosk-packages') return route.fulfill({ json: [trial] });
    if (path === '/api/member/kiosk-applications/current') {
      return options.hasApplication === false && calls.create === 0
        ? route.fulfill({ status: 404, json: {} })
        : route.fulfill({ json: application });
    }
    if (path === '/api/member/kiosk-applications' && request.method() === 'POST') {
      calls.create++;
      calls.lastPayload = request.postDataJSON() as Record<string, unknown>;
      return route.fulfill({ status: 201, json: application });
    }
    if (path.endsWith('/payment-link'))
      return route.fulfill({
        json: { orderCode: 808080, amount: 10000, checkoutUrl: options.checkoutUrl },
      });
    if (path.endsWith('/reconcile')) {
      calls.reconcile++;
      return route.fulfill({ status: 409, json: { detail: 'Chưa thanh toán.' } });
    }
    return route.fulfill({ json: [] });
  });
  return calls;
}

test.describe('Coordinator onboarding acceptance boundaries', () => {
  for (const width of [390, 1024]) {
    test(`annual package layout is usable at ${width}px`, async ({ page }, testInfo) => {
      await mockCustomer(page, { hasApplication: false });
      await page.route('**/api/kiosk-packages', (route) =>
        route.fulfill({
          json: [
            trial,
            {
              ...trial,
              id: '20000000-0000-0000-0000-00000000000d',
              name: 'Pro',
              annualFee: 15000,
              walkInSlots: 4,
              preorderSlots: 4,
              totalSlots: 8,
            },
            {
              ...trial,
              id: '20000000-0000-0000-0000-00000000000e',
              name: 'Max',
              annualFee: 20000,
              walkInSlots: 6,
              preorderSlots: 6,
              totalSlots: 12,
            },
          ],
        }),
      );
      await page.setViewportSize({ width, height: 900 });
      await page.goto('/thue-kiosk');
      await expect(page.getByRole('radio')).toHaveCount(3);
      await expect(page.getByText('Max', { exact: true })).toBeVisible();
      const map = page.getByRole('region', {
        name: 'Bản đồ chọn tọa độ lắp đặt kiosk',
        exact: true,
      });
      await expect(map).toHaveClass(/(leaflet-container|maplibregl-map)/);
      await expect(map.locator('.leaflet-control-zoom-in, .maplibregl-ctrl-zoom-in')).toBeVisible();
      expect((await map.boundingBox())?.height).toBeGreaterThanOrEqual(280);
      await expect(page.getByLabel('Vĩ độ (Latitude)')).toHaveCount(0);
      await expect(page.getByLabel('Kinh độ (Longitude)')).toHaveCount(0);
      await map.click({ position: { x: 130, y: 140 } });
      await expect(map).toHaveAttribute('data-has-pin', 'true');
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
      ).toBe(false);
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
      await page.screenshot({
        path: testInfo.outputPath(`annual-packages-fixture-${width}.png`),
        fullPage: true,
      });
    });
  }

  for (const checkoutUrl of [
    'javascript:alert(1)',
    'https://evilpayos.vn/web/checkout',
    'https://pay.payos.vn.evil.example/web/checkout',
    'https://user:password@pay.payos.vn/web/checkout',
    'http://pay.payos.vn/web/checkout',
    'https://pay.payos.vn:8443/web/checkout',
    'http://localhost:20128/dashboard',
  ]) {
    test(`rejects unsafe checkout without navigation: ${checkoutUrl}`, async ({ page }) => {
      await mockCustomer(page, { checkoutUrl });
      await page.goto('/thue-kiosk');
      await expect(page.getByRole('heading', { name: /Hồ sơ thuê: Shop kiểm thử/ })).toBeVisible();
      const currentUrl = page.url();
      const popups: Page[] = [];
      page.on('popup', (popup) => popups.push(popup));
      await page
        .getByRole('button', { name: 'Tạo liên kết thanh toán payOS', exact: true })
        .click();
      await expect(page.locator('.kiosk-onboarding-container').getByRole('alert')).toBeVisible();
      await expect(page.getByRole('link', { name: /Mở trang thanh toán/ })).toHaveCount(0);
      expect(page.url()).toBe(currentUrl);
      expect(popups).toHaveLength(0);
    });
  }

  test('forged paid return parameters cannot settle payment or promote identity', async ({
    page,
  }) => {
    const calls = await mockCustomer(page);
    await page.goto('/thue-kiosk?status=PAID&code=00&orderCode=808080&cancel=false');
    await expect(page.locator('.kiosk-status-pill')).toHaveText('Chờ thanh toán phí thuê');
    await expect(
      page.getByRole('button', { name: 'Tạo liên kết thanh toán payOS', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Vào quản lý Shop/ })).toHaveCount(0);
    expect(calls.reconcile).toBe(0);
    expect(calls.create).toBe(0);
  });

  test('cancel dialog traps focus, closes with Escape, and restores the trigger', async ({
    page,
  }) => {
    await mockCustomer(page);
    await page.goto('/thue-kiosk');

    const cancelTrigger = page.getByRole('button', { name: 'Hủy hồ sơ', exact: true });
    await cancelTrigger.click();

    const dialog = page.getByRole('dialog', {
      name: 'Xác nhận hủy hồ sơ thuê kiosk',
    });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Đóng', exact: true })).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('hidden');

    await page.keyboard.press('Shift+Tab');
    await expect(dialog.getByRole('button', { name: 'Xác nhận hủy', exact: true })).toBeFocused();

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(cancelTrigger).toBeFocused();
    await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe('');
  });

  test('invalid edit after valid coordinates never submits old map position; explicit zero remains valid', async ({
    page,
  }) => {
    const calls = await mockCustomer(page, { hasApplication: false });
    await mockGoongPlaces(page, 0, 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/thue-kiosk');
    await page.getByRole('radio').click();
    await page.getByLabel('Tên shop hoa').fill('Shop kiểm thử');
    await page.getByLabel('Số điện thoại kinh doanh').fill('0901234567');
    await page.getByLabel('Email liên hệ công việc').fill('shop@example.invalid');
    await selectAddressSuggestion(page, 'Địa chỉ kiểm thử không có thiết bị thật');
    await page.getByLabel('Tên ngân hàng').fill('Ngân hàng kiểm thử');
    await page.getByLabel('Tên chủ tài khoản').fill('NGUOI KIEM THU');
    await page.getByLabel('Số tài khoản ngân hàng').fill('00123456');
    // Editing address after selecting suggestion invalidates coordinates and blocks submit
    await page.getByLabel('Địa chỉ lắp đặt cụ thể').fill('Địa chỉ đã sửa tay chưa chọn lại');
    await page.getByRole('button', { name: 'Nộp hồ sơ thuê kiosk', exact: true }).click();
    expect(calls.create).toBe(0);
    await selectAddressSuggestion(page, 'Địa chỉ kiểm thử tọa độ 0');
    await page.getByRole('button', { name: 'Nộp hồ sơ thuê kiosk', exact: true }).click();
    await expect(page.getByRole('heading', { name: /Hồ sơ thuê: Shop kiểm thử/ })).toBeVisible();
    expect(calls.create).toBe(1);
    expect(calls.lastPayload).toMatchObject({ latitude: 0, longitude: 0 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
    ).toBe(false);
  });

  test('server error 500 on current application query renders honest retryable error without creation form', async ({
    page,
  }) => {
    let attempts = 0;
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me') return route.fulfill({ json: customer });
      if (path === '/api/kiosk-packages') return route.fulfill({ json: [trial] });
      if (path === '/api/member/kiosk-applications/current') {
        attempts++;
        if (attempts === 1) {
          return route.fulfill({ status: 500, json: { detail: 'Internal Server Error' } });
        }
        return route.fulfill({ status: 404, json: {} });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto('/thue-kiosk');
    await expect(page.locator('.kiosk-onboarding-container').getByRole('alert')).toBeVisible();
    await expect(page.getByText('Lỗi tải thông tin hồ sơ từ máy chủ')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nộp hồ sơ thuê kiosk' })).toHaveCount(0);
    await expect(page.getByLabel('Tên shop hoa')).toHaveCount(0);

    await page.getByRole('button', { name: /Thử lại/ }).click();
    await expect(page.getByRole('button', { name: 'Nộp hồ sơ thuê kiosk' })).toBeVisible();
    await expect(page.getByLabel('Tên shop hoa')).toBeVisible();
  });

  test('terminal refunded state retains last-app status and enables reapplication form', async ({
    page,
  }) => {
    const refundedApp = {
      ...application,
      id: 'e0200000-0000-0000-0000-000000000088',
      shopName: 'Shop Đã Hoàn Tiền',
      status: 'REFUNDED',
    };
    let createdApp: Record<string, unknown> | null = null;

    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === '/api/auth/me') return route.fulfill({ json: customer });
      if (path === '/api/kiosk-packages') return route.fulfill({ json: [trial] });
      if (path === '/api/member/kiosk-applications/current') {
        return route.fulfill({ json: createdApp || refundedApp });
      }
      if (path === '/api/member/kiosk-applications' && request.method() === 'POST') {
        const body = request.postDataJSON() as Record<string, unknown>;
        createdApp = {
          ...application,
          id: 'e0200000-0000-0000-0000-000000000089',
          shopName: body.shopName as string,
          status: 'AWAITING_PAYMENT',
        };
        return route.fulfill({ status: 201, json: createdApp });
      }
      return route.fulfill({ json: [] });
    });

    await mockGoongPlaces(page, 10.775, 106.7);
    await page.goto('/thue-kiosk');
    await expect(page.getByText(/Hồ sơ trước \(Shop Đã Hoàn Tiền\): Đã hoàn tiền/)).toBeVisible();
    await expect(
      page.getByText(/Khoản phí thuê đã được Quản trị viên chuyển khoản hoàn trả/),
    ).toBeVisible();
    await expect(page.locator('.kiosk-last-app-panel details')).toBeVisible();

    await expect(page.getByRole('radio')).toBeVisible();
    await page.getByRole('radio').click();
    await page.getByLabel('Tên shop hoa').fill('Shop Tái Đăng Ký Sau Hoàn Tiền');
    await page.getByLabel('Số điện thoại kinh doanh').fill('0908889999');
    await page.getByLabel('Email liên hệ công việc').fill('reapply@example.invalid');
    await selectAddressSuggestion(page, '999 Đường Lê Lợi, Quận 1');
    await page.getByLabel('Tên ngân hàng').fill('Vietcombank');
    await page.getByLabel('Tên chủ tài khoản').fill('NGUYEN HOAN TIEN');
    await page.getByLabel('Số tài khoản ngân hàng').fill('001122334455');
    await page.getByRole('button', { name: 'Nộp hồ sơ thuê kiosk' }).click();

    await expect(
      page.getByRole('heading', { name: /Hồ sơ thuê: Shop Tái Đăng Ký Sau Hoàn Tiền/ }),
    ).toBeVisible();
    await expect(page.getByText('Chờ thanh toán phí thuê')).toBeVisible();
  });

  test('canceled application retains status and allows legitimate server reconcile for late payment', async ({
    page,
  }) => {
    let appState: Record<string, unknown> = {
      ...application,
      id: 'e0200000-0000-0000-0000-000000000077',
      shopName: 'Shop Đã Hủy Cần Đối Soát',
      status: 'CANCELLED',
      canVoluntaryCancel: false,
    };
    let reconcileCalls = 0;

    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === '/api/auth/me') return route.fulfill({ json: customer });
      if (path === '/api/kiosk-packages') return route.fulfill({ json: [trial] });
      if (path === '/api/member/kiosk-applications/current') {
        return route.fulfill({ json: appState });
      }
      if (
        path === `/api/member/kiosk-applications/${appState.id}/reconcile` &&
        request.method() === 'POST'
      ) {
        reconcileCalls++;
        appState = {
          ...appState,
          status: 'REFUND_PENDING',
          paymentStatus: 'PAID',
        };
        return route.fulfill({ json: appState });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto('/thue-kiosk');
    await expect(page.getByText(/Hồ sơ trước \(Shop Đã Hủy Cần Đối Soát\): Đã hủy/)).toBeVisible();
    const reconcileBtn = page.getByRole('button', { name: 'Kiểm tra thanh toán muộn' });
    await expect(reconcileBtn).toBeVisible();

    await reconcileBtn.click();
    expect(reconcileCalls).toBe(1);

    await expect(page.getByRole('heading', { name: 'Đang xử lý hoàn tiền' })).toBeVisible();
    await expect(
      page.getByText(/Giao dịch thanh toán đến muộn sau khi hồ sơ đã hủy/),
    ).toBeVisible();
  });

  test('creation mutation result is scoped to session identity and retains identity reset behavior', async ({
    page,
  }) => {
    let currentSession = { ...customer, id: 'user-aaa-111', name: 'User A' };
    let appForUserA: Record<string, unknown> | null = null;
    let appForUserB: Record<string, unknown> | null = null;

    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const path = new URL(request.url()).pathname;
      if (path === '/api/auth/me') return route.fulfill({ json: currentSession });
      if (path === '/api/kiosk-packages') return route.fulfill({ json: [trial] });
      if (path === '/api/member/kiosk-applications/current') {
        const app = currentSession.id === 'user-aaa-111' ? appForUserA : appForUserB;
        if (!app) return route.fulfill({ status: 404, json: {} });
        return route.fulfill({ json: app });
      }
      if (path === '/api/member/kiosk-applications' && request.method() === 'POST') {
        const body = request.postDataJSON() as Record<string, unknown>;
        const created = {
          ...application,
          id: `app-for-${currentSession.id}`,
          customerId: currentSession.id,
          shopName: body.shopName as string,
          status: 'AWAITING_PAYMENT',
        };
        if (currentSession.id === 'user-aaa-111') {
          appForUserA = created;
        } else {
          appForUserB = created;
        }
        return route.fulfill({ status: 201, json: created });
      }
      return route.fulfill({ json: [] });
    });

    await mockGoongPlaces(page, 10.771, 106.701);
    await page.goto('/thue-kiosk');
    await page.getByRole('radio').click();
    await page.getByLabel('Tên shop hoa').fill('Shop Riêng Của User A');
    await page.getByLabel('Số điện thoại kinh doanh').fill('0901112222');
    await page.getByLabel('Email liên hệ công việc').fill('usera@example.invalid');
    await selectAddressSuggestion(page, '111 Đường A, Phường 1, Quận 1');
    await page.getByLabel('Tên ngân hàng').fill('VCB');
    await page.getByLabel('Tên chủ tài khoản').fill('USER A');
    await page.getByLabel('Số tài khoản ngân hàng').fill('111222333');
    await page.getByRole('button', { name: 'Nộp hồ sơ thuê kiosk' }).click();

    await expect(
      page.getByRole('heading', { name: /Hồ sơ thuê: Shop Riêng Của User A/ }),
    ).toBeVisible();

    currentSession = { ...customer, id: 'user-bbb-222', name: 'User B' };
    await page.goto('/thue-kiosk');

    await expect(
      page.getByRole('heading', { name: /Hồ sơ thuê: Shop Riêng Của User A/ }),
    ).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Nộp hồ sơ thuê kiosk' })).toBeVisible();
    await expect(page.getByLabel('Tên shop hoa')).toHaveValue('');
  });
});

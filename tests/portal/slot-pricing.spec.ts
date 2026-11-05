import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pricing = {
  walkInAnnualPrice: 100000,
  preorderAnnualPrice: 120000,
  version: 1,
  configured: true,
  updatedAt: '2026-11-04T03:00:00Z',
  termMonths: 12,
  minSlots: 1,
  maxSlots: 50,
};
const application = {
  id: 'app-slot-1',
  customerId: 'user-slot-1',
  shopName: 'Shop kiểm thử',
  phone: '0901234567',
  contactEmail: 'shop@example.com',
  installationAddress: '123 Nguyễn Huệ',
  latitude: 10.77,
  longitude: 106.7,
  bankName: 'MB',
  bankHolder: 'NGUYEN VAN A',
  bankAccountSuffix: '0123',
  totalSlots: 4,
  walkInSlots: 2,
  preorderSlots: 2,
  annualFee: 440000,
  walkInAnnualPrice: 100000,
  preorderAnnualPrice: 120000,
  pricingVersion: 1,
  pricingMode: 'SLOT_PRICING',
  packageId: null,
  packageName: '',
  status: 'AWAITING_PAYMENT',
  createdAt: '2026-11-04T03:00:00Z',
  updatedAt: '2026-11-04T03:00:00Z',
  paymentId: 'payment-1',
  paymentStatus: 'PENDING',
  canVoluntaryCancel: true,
};
async function setup(page: Page, role = 'CUSTOMER') {
  const state = {
    pricing: { ...pricing },
    current: null as Record<string, unknown> | null,
    writes: [] as { path: string; body: Record<string, unknown> }[],
    conflict: false,
    eligibleQuery: '',
  };
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    if (path === '/api/auth/me')
      return route.fulfill({
        json: {
          id: 'user-slot-1',
          name: 'Shop kiểm thử',
          role,
          sellerId: role === 'SELLER' ? 'seller-1' : null,
          sellerStatus: 'ACTIVE',
        },
      });
    if (path === '/api/kiosk-packages') return route.fulfill({ json: state.pricing });
    if (req.method() !== 'GET') {
      state.writes.push({ path, body: req.postDataJSON() });
      if (path === '/api/operations/kiosk-pricing') {
        state.pricing = { ...state.pricing, ...req.postDataJSON(), version: 2 };
        return route.fulfill({ json: state.pricing });
      }
      if (path === '/api/operations/kiosks/enroll')
        return route.fulfill({
          json: {
            id: 'kiosk-1',
            code: 'K-TEST',
            name: 'Tủ kiểm thử',
            slotCount: 4,
            walkInSlots: 2,
            preorderSlots: 2,
            status: 'OFFLINE',
            apiKey: 'test-device-key-only',
          },
        });
      if (state.conflict) {
        state.conflict = false;
        state.pricing = { ...state.pricing, version: 2, walkInAnnualPrice: 200000 };
        return route.fulfill({ status: 409, json: { detail: 'Bảng giá đã thay đổi.' } });
      }
      state.current = {
        ...application,
        pricingVersion: state.pricing.version,
        annualFee:
          Number(req.postDataJSON().walkInSlots) * state.pricing.walkInAnnualPrice +
          Number(req.postDataJSON().preorderSlots) * state.pricing.preorderAnnualPrice,
      };
      return route.fulfill({ status: 201, json: state.current });
    }
    if (path === '/api/member/kiosk-applications/current')
      return state.current
        ? route.fulfill({ json: state.current })
        : route.fulfill({ status: 404 });
    if (path === '/api/operations/kiosk-applications')
      return route.fulfill({
        json: { items: [{ ...application, status: 'CONFIRMED' }], page: 1, hasMore: false },
      });
    if (path === '/api/operations/kiosk-applications/app-slot-1')
      return route.fulfill({
        json: { application: { ...application, status: 'CONFIRMED' }, evidencePhotos: [] },
      });
    if (path === '/api/operations/eligible-kiosks') {
      state.eligibleQuery = url.search;
      return route.fulfill({ json: [] });
    }
    if (path === '/api/operations/technicians') return route.fulfill({ json: [] });
    return route.fulfill({ json: [] });
  });
  await page.route('**/rsapi.goong.io/Place/AutoComplete**', (route) =>
    route.fulfill({
      json: {
        status: 'OK',
        predictions: [
          {
            place_id: 'place-1',
            description: '123 Nguyễn Huệ',
            structured_formatting: { main_text: '123 Nguyễn Huệ', secondary_text: 'TP.HCM' },
          },
        ],
      },
    }),
  );
  await page.route('**/rsapi.goong.io/Place/Detail**', (route) =>
    route.fulfill({
      json: {
        status: 'OK',
        result: {
          formatted_address: '123 Nguyễn Huệ',
          geometry: { location: { lat: 10.77, lng: 106.7 } },
        },
      },
    }),
  );
  return state;
}
async function address(page: Page) {
  await page.getByRole('combobox', { name: /Địa chỉ lắp đặt cụ thể/ }).fill('123 Nguyễn Huệ');
  await page.getByRole('option', { name: /123 Nguyễn Huệ/ }).click();
}

for (const width of [390, 1440]) {
  test(`Customer selects allocation, reviews fee and sends server-priced application at ${width}`, async ({
    page,
  }, info) => {
    const state = await setup(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/thue-kiosk');
    await page.getByLabel('Ô bán sẵn (Walk-in)', { exact: true }).fill('2');
    await page.getByLabel('Ô đặt trước (Pre-order)', { exact: true }).fill('2');
    await expect(page.locator('.slot-demand-total').first()).toContainText('440.000');
    await expect(page.getByRole('button', { name: 'Nộp hồ sơ thuê kiosk' })).toBeDisabled();
    await page.getByLabel('Tên shop hoa').fill('Shop kiểm thử');
    await page.getByLabel('Số điện thoại kinh doanh').fill('0901234567');
    await page.getByLabel('Email liên hệ công việc').fill('shop@example.com');
    await page.getByLabel('Tên ngân hàng').fill('MB Bank');
    await page.getByLabel('Tên chủ tài khoản').fill('NGUYEN VAN A');
    await page.getByLabel('Số tài khoản ngân hàng').fill('00123');
    await address(page);
    await page.getByRole('checkbox', { name: /Tôi xác nhận số ô/ }).check();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).include('.kiosk-onboarding-container').analyze()).violations,
    ).toEqual([]);
    await page.screenshot({
      path: info.outputPath(`customer-slot-demand-${width}.png`),
      fullPage: true,
    });
    await page.getByRole('button', { name: 'Nộp hồ sơ thuê kiosk' }).click();
    await expect(page.getByRole('heading', { name: 'Hồ sơ thuê: Shop kiểm thử' })).toBeVisible();
    expect(state.writes[0].body).toMatchObject({
      walkInSlots: 2,
      preorderSlots: 2,
      pricingVersion: 1,
      bankAccountNumber: '00123',
    });
    expect(state.writes[0].body).not.toHaveProperty('packageId');
    expect(state.writes[0].body).not.toHaveProperty('annualFee');
    await expect(page.locator('.kiosk-application-status-panel')).toContainText('440.000');
  });
}

test('Seller additional rental sends only location and demand, requires review again after price conflict', async ({
  page,
}) => {
  const state = await setup(page, 'SELLER');
  state.conflict = true;
  await page.goto('/thue-kiosk');
  await expect(page.getByLabel('Tên shop hoa')).toHaveCount(0);
  await address(page);
  await page.getByRole('checkbox', { name: /Tôi xác nhận số ô/ }).check();
  await page.getByRole('button', { name: 'Nộp hồ sơ thuê kiosk' }).click();
  await expect(page.getByRole('checkbox', { name: /Tôi xác nhận số ô/ })).not.toBeChecked();
  await expect(page.getByRole('button', { name: 'Nộp hồ sơ thuê kiosk' })).toBeDisabled();
  expect(state.writes).toHaveLength(1);
  await expect(page.locator('.slot-demand-total').first()).toContainText('200.000');
  await page.getByRole('checkbox', { name: /Tôi xác nhận số ô/ }).check();
  await page.getByRole('button', { name: 'Nộp hồ sơ thuê kiosk' }).click();
  await expect(page.getByRole('heading', { name: 'Hồ sơ thuê: Shop kiểm thử' })).toBeVisible();
  expect(state.writes[1]).toEqual({
    path: '/api/me/kiosk-applications',
    body: {
      installationAddress: '123 Nguyễn Huệ',
      latitude: 10.77,
      longitude: 106.7,
      walkInSlots: 1,
      preorderSlots: 0,
      pricingVersion: 2,
    },
  });
});

test('Unconfigured pricing prevents application submission', async ({ page }) => {
  await setup(page);
  await page.route('**/api/kiosk-packages', (route) =>
    route.fulfill({
      json: {
        ...pricing,
        configured: false,
        version: 0,
        walkInAnnualPrice: null,
        preorderAnnualPrice: null,
        updatedAt: null,
      },
    }),
  );
  await page.goto('/thue-kiosk');
  await expect(page.getByText(/Chưa có bảng giá/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Nộp hồ sơ thuê kiosk' })).toBeDisabled();
  await expect(page.getByRole('checkbox', { name: /Tôi xác nhận/ })).toHaveCount(0);
});

test('Manager sets two prices and enrolls a kiosk tied to confirmed application without editable counts', async ({
  page,
}, info) => {
  const state = await setup(page, 'OPERATIONS_MANAGER');
  await page.goto('/operations/installations');
  await page.locator('.kiosk-pricing-settings > summary').click();
  await page.getByLabel('Giá ô Walk-in (đ/ô/năm)').fill('150000');
  await page.getByRole('button', { name: 'Lưu bảng giá', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].body).toEqual({
    walkInAnnualPrice: 150000,
    preorderAnnualPrice: 120000,
    expectedVersion: 1,
  });
  await page.getByRole('row').filter({ hasText: 'Shop kiểm thử' }).getByRole('button').click();
  await expect.poll(() => state.eligibleQuery).toBe('?applicationId=app-slot-1');
  await page.getByRole('button', { name: '+ Tạo tủ theo hồ sơ' }).click();
  const dialog = page.getByRole('dialog', { name: 'Đăng ký thiết bị kiosk mới' });
  await expect(dialog).toContainText('2 ô Walk-in · 2 ô Pre-order');
  await expect(dialog.locator('input[type=number]')).toHaveCount(0);
  await dialog.getByLabel('Mã tủ (Code) *').fill('K-TEST');
  await dialog.getByLabel('Tên tủ *').fill('Tủ kiểm thử');
  await dialog.getByLabel('Hardware ID (Serial) *').fill('TEST-HARDWARE');
  await page.screenshot({ path: info.outputPath('manager-enroll-allocation.png') });
  await dialog.getByRole('button', { name: 'Đăng ký thiết bị (OFFLINE)' }).click();
  await expect.poll(() => state.writes.length).toBe(2);
  expect(state.writes[1].body).toMatchObject({ applicationId: 'app-slot-1' });
  expect(state.writes[1].body).not.toHaveProperty('slotCount');
  expect(state.writes[1].body).not.toHaveProperty('walkInSlots');
  expect(state.writes[1].body).not.toHaveProperty('preorderSlots');
});

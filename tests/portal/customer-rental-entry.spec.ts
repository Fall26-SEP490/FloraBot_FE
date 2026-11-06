import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const rental = {
  id: '90000000-0000-0000-0000-000000000001',
  customerId: 'customer-rental',
  shopName: 'Tiệm hoa đồng nai',
  packageId: '20000000-0000-0000-0000-00000000000c',
  packageName: 'Trial',
  annualFee: 10000,
  totalSlots: 2,
  status: 'AWAITING_PAYMENT',
  canVoluntaryCancel: true,
  createdAt: '2026-11-01T00:00:00Z',
  installationAddress: 'Đường Nguyễn Xiển, TP.HCM',
  latitude: 10.87228,
  longitude: 106.84054,
  bankAccountSuffix: '7366',
};
async function fixture(page: Page) {
  const state = {
    status: 200,
    application: { ...rental } as Record<string, unknown>,
    writes: [] as string[],
    requests: 0,
  };
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (req.method() !== 'GET') {
      state.writes.push(path);
      return route.abort();
    }
    if (path === '/api/auth/me')
      return route.fulfill({
        json: { id: 'customer-rental', role: 'CUSTOMER', name: 'Khách test' },
      });
    if (path === '/api/member/kiosk-applications/current') {
      state.requests++;
      return route.fulfill({
        status: state.status,
        json: state.status === 200 ? state.application : { detail: 'Không tải được hồ sơ' },
      });
    }
    if (path === '/api/member/profile')
      return route.fulfill({
        json: { fullName: 'Khách test', email: 'customer@example.test', loyaltyPoints: 0 },
      });
    if (path === '/api/kiosk-packages') return route.fulfill({ json: [] });
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  return state;
}
for (const width of [390, 1078, 1440]) {
  test(`Pending rental is visible before flower orders and links to real payment screen at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const state = await fixture(page);
    await page.goto('/tai-khoan#overview');
    const panel = page.getByRole('region', { name: 'Hồ sơ thuê kiosk', exact: true });
    await expect(panel).toBeVisible();
    const navigationBounds = await page.locator('.customer-account-sidebar').boundingBox();
    const contentBounds = await page.locator('.customer-account-content').boundingBox();
    expect(Math.abs(navigationBounds!.x - contentBounds!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(navigationBounds!.width - contentBounds!.width)).toBeLessThanOrEqual(1);
    expect(navigationBounds!.y + navigationBounds!.height).toBeLessThan(contentBounds!.y);
    if (width > 760) {
      await expect(page.getByRole('navigation', { name: 'Điều hướng tài khoản' })).toHaveCSS(
        'display',
        'flex',
      );
      expect(navigationBounds!.height).toBeLessThan(120);
    }

    await expect(panel).toContainText('Tiệm hoa đồng nai');
    await expect(panel).toContainText('Chờ thanh toán phí thuê');
    await expect(panel).toContainText('10.000 đ');
    const pay = panel.getByRole('link', { name: 'Thanh toán thuê kiosk', exact: true });
    await expect(pay).toHaveAttribute('href', '/thue-kiosk');
    await expect(pay).toBeInViewport();
    const bounds = await panel.boundingBox();
    const orders = await page
      .getByRole('region', { name: 'Đơn đang theo dõi', exact: true })
      .boundingBox();
    expect(bounds!.y).toBeLessThan(orders!.y);
    if (width === 390)
      await page.getByRole('button', { name: 'Mục tài khoản', exact: true }).click();
    await expect(
      page
        .getByRole('navigation', { name: 'Điều hướng tài khoản' })
        .getByRole('link', { name: 'Thuê kiosk', exact: true }),
    ).toHaveAttribute('href', '/thue-kiosk');
    if (width === 390) await page.keyboard.press('Escape');
    const axe = await new AxeBuilder({ page })
      .include('#main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(axe.violations).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: test.info().outputPath(`rental-overview-${width}.png`),
      fullPage: true,
    });
    await pay.click();
    await expect(page).toHaveURL(/thue-kiosk$/);
    await expect(
      page.getByRole('heading', { name: 'Hồ sơ thuê: Tiệm hoa đồng nai', exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Thanh toán phí thuê', exact: true }),
    ).toBeVisible();
    expect(state.writes).toEqual([]);
  });
}
// No automatic business actions from the overview.
for (const status of [
  'PAID_REVIEW',
  'CONFIRMED',
  'SCHEDULED',
  'CANCELLED',
  'REFUND_PENDING',
  'REFUNDED',
]) {
  test(`Rental ${status} never offers another payment`, async ({ page }) => {
    const state = await fixture(page);
    state.application.status = status;
    await page.goto('/tai-khoan');
    const panel = page.getByRole('region', { name: 'Hồ sơ thuê kiosk', exact: true });
    await expect(panel).toContainText('Tiệm hoa đồng nai');
    await expect(
      panel.getByRole('link', { name: 'Thanh toán thuê kiosk', exact: true }),
    ).toHaveCount(0);
    await expect(
      panel.getByRole('link', { name: 'Xem hồ sơ thuê kiosk', exact: true }),
    ).toHaveAttribute('href', '/thue-kiosk');
    expect(state.writes).toEqual([]);
  });
}
test('404 means no application, without fabricated status or payment price', async ({ page }) => {
  const state = await fixture(page);
  state.status = 404;
  await page.goto('/tai-khoan');
  await expect(page.getByRole('link', { name: 'Tìm hiểu thuê kiosk', exact: true })).toBeVisible();
  await expect(page.getByRole('region', { name: 'Hồ sơ thuê kiosk', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Thanh toán thuê kiosk', exact: true })).toHaveCount(
    0,
  );
  expect(state.writes).toEqual([]);
});
test('API failure stays distinct from no rental and can be retried independently', async ({
  page,
}) => {
  const state = await fixture(page);
  state.status = 503;
  await page.goto('/tai-khoan');
  const panel = page.getByRole('region', { name: 'Hồ sơ thuê kiosk', exact: true });
  await expect(panel.getByRole('alert')).toContainText('Chưa tải được hồ sơ');
  await expect(page.getByRole('region', { name: 'Đơn đang theo dõi', exact: true })).toBeVisible();
  await expect(panel.getByRole('link', { name: 'Thanh toán thuê kiosk', exact: true })).toHaveCount(
    0,
  );
  state.status = 200;
  await panel.getByRole('button', { name: 'Tải lại hồ sơ thuê', exact: true }).click();
  await expect(
    panel.getByRole('link', { name: 'Thanh toán thuê kiosk', exact: true }),
  ).toBeVisible();
  expect(state.requests).toBe(2);
  expect(state.writes).toEqual([]);
});
test('Loading offers a safe route without inventing a payable rental', async ({ page }) => {
  await fixture(page);
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/member/kiosk-applications/current', async (route) => {
    await gate;
    await route.fulfill({ json: rental });
  });
  await page.goto('/tai-khoan');
  const panel = page.getByRole('region', { name: 'Hồ sơ thuê kiosk', exact: true });
  await expect(panel.getByRole('status')).toContainText('Đang kiểm tra');
  await expect(panel.getByRole('link', { name: 'Thanh toán thuê kiosk', exact: true })).toHaveCount(
    0,
  );
  await expect(
    panel.getByRole('link', { name: 'Xem hồ sơ thuê kiosk', exact: true }),
  ).toHaveAttribute('href', '/thue-kiosk');
  release();
  await expect(
    panel.getByRole('link', { name: 'Thanh toán thuê kiosk', exact: true }),
  ).toBeVisible();
});

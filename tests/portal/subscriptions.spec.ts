import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test.beforeEach(async ({ page }) => {
  await page.route('**/api/**/wallet', (route) =>
    route.fulfill({
      json: {
        balance: null,
        entries: [],
        bankConfigured: false,
        minimumWithdrawal: 50000,
        withdrawals: [],
        hasMoreEntries: false,
        hasMoreWithdrawals: false,
      },
    }),
  );
  await page.route('**/api/**/slots', (route) => route.fulfill({ json: [] }));
});
const sellerId = '20000000-0000-0000-0000-000000000001';
const subscription = {
  id: 'subscription-id',
  packageName: 'Cơ bản',
  periodFrom: '2026-10-07',
  periodTo: '2027-01-07',
  price: 1200000,
  status: 'PENDING_PAYMENT',
};

test('Background refresh during pointer activation preserves subscription registration', async ({
  page,
}) => {
  let reads = 0;
  let writes = 0;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'user',
        name: 'Shop hoa',
        role: 'SELLER',
        sellerId,
        sellerStatus: 'APPROVED',
        packageExpiresAt: null,
      },
    }),
  );
  await page.route('**/api/**/products', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/**/subscriptions', async (route) => {
    reads++;
    if (reads > 1) await gate;
    await route.fulfill({
      json: {
        package: { name: 'Cơ bản', monthlyFee: 400000, maxSlots: 3, status: 'ACTIVE' },
        subscriptions: writes ? [subscription] : [],
      },
    });
  });
  await page.route('**/flows/subscribe', (route) => {
    writes++;
    return route.fulfill({ json: { result: subscription.id } });
  });
  await page.goto('/seller/subscriptions');
  const button = page.getByRole('button', { name: 'Đăng ký kỳ thuê', exact: true });
  await button.hover();
  await page.mouse.down();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => reads).toBeGreaterThan(1);
  await page.mouse.up();
  release();
  await expect.poll(() => writes).toBe(1);
  await expect(page.locator('.subscription-list')).toContainText('Chờ thanh toán');
});

for (const width of [390, 1440]) {
  test(`Subscription registration, payment retry and confirmed status at ${width}px`, async ({
    page,
  }) => {
    let created = false;
    let paid = false;
    let attempts = 0;
    await page.setViewportSize({ width, height: 950 });
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: {
          id: 'user',
          name: 'Shop hoa',
          role: 'SELLER',
          sellerId,
          sellerStatus: paid ? 'ACTIVE' : 'PAST_DUE',
          packageExpiresAt: paid ? '2027-01-07' : '2026-10-01',
        },
      }),
    );
    await page.route('**/api/**/products', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/**/subscriptions', (route) =>
      route.fulfill({
        json: {
          package: { name: 'Cơ bản', monthlyFee: 400000, maxSlots: 3, status: 'ACTIVE' },
          subscriptions: created
            ? [{ ...subscription, status: paid ? 'ACTIVE' : 'PENDING_PAYMENT' }]
            : [],
        },
      }),
    );
    await page.route('**/flows/subscribe', (route) => {
      expect(route.request().postDataJSON()).toEqual({ p_months: 3 });
      created = true;
      return route.fulfill({ json: { result: subscription.id } });
    });
    await page.route('**/payment-link', (route) => {
      expect(route.request().url()).toContain(subscription.id);
      attempts++;
      return attempts === 1
        ? route.fulfill({
            status: 502,
            json: { detail: 'Cổng thanh toán đang bận. Vui lòng thử lại.' },
          })
        : route.fulfill({
            json: {
              orderCode: 123,
              amount: 1200000,
              checkoutUrl: 'https://pay.payos.vn/web/124c33293c934a85be5b7f8761a27a07',
            },
          });
    });
    await page.goto('/seller/subscriptions');
    await expect(page.getByLabel('Trạng thái gói')).toContainText('1/10/2026');
    await page.getByRole('link', { name: 'Gia hạn gói thuê' }).click();
    await expect(page.locator('#subscriptions')).toBeFocused();
    await page.getByLabel('Số tháng đăng ký').selectOption('3');
    await expect(page.locator('.subscription-total')).toContainText('1.200.000');
    await page.getByRole('button', { name: 'Đăng ký kỳ thuê', exact: true }).click();
    await expect(page.getByText('Chờ thanh toán', { exact: false }).last()).toBeVisible();
    await expect(page.getByLabel('Số tháng đăng ký')).toHaveCount(0);
    await page.getByRole('button', { name: 'Tạo liên kết thanh toán' }).click();
    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'Cổng thanh toán đang bận',
    );
    await page.getByRole('button', { name: 'Tạo liên kết thanh toán' }).click();
    const link = page.getByRole('link', { name: 'Tiếp tục trên payOS' });
    await expect(link).toHaveAttribute(
      'href',
      'https://pay.payos.vn/web/124c33293c934a85be5b7f8761a27a07',
    );
    await expect(link).toBeFocused();
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `.impeccable/review/portal-subscriptions-${width}.png`,
      fullPage: true,
    });
    paid = true;
    await page.getByRole('button', { name: 'Cập nhật trạng thái' }).click();
    await expect(page.locator('.subscription-list')).toContainText('Đã thanh toán');
    await expect(link).toHaveCount(0);
    await expect(page.locator('.subscription-overdue')).toHaveCount(0);
    expect(attempts).toBe(2);
  });
}

test.beforeEach(async ({ page }) => {
  await page.route('**/api/sellers/*/preorders?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
});

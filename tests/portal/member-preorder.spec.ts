import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const member = {
  id: '10000000-0000-0000-0000-000000000010',
  name: 'Khách yêu hoa',
  role: 'CUSTOMER',
  sellerId: null,
  sellerStatus: null,
  packageExpiresAt: null,
};
const flower = {
  productId: '30000000-0000-0000-0000-000000000001',
  sellerId: '20000000-0000-0000-0000-000000000001',
  shopName: 'Tiệm Hoa Nhỏ',
  name: 'Hoa hồng pastel',
  description: 'Bó hồng dành cho sinh nhật',
  price: 350000,
  kioskId: '40000000-0000-0000-0000-000000000001',
  kioskName: 'Tủ FPT',
  address: 'Thủ Đức',
  photo: null,
  bouquets: ['50000000-0000-0000-0000-000000000001'],
};
test('CUSTOMER places CUSTOM with selected kiosk and no door action', async ({ page }) => {
  const role = 'CUSTOMER';
  const otherKiosk = {
    ...flower,
    kioskId: '40000000-0000-0000-0000-000000000002',
    kioskName: 'Tủ Quận 1',
    address: 'Quận 1',
  };
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: { ...member, role } }));
  await page.route('**/api/shop/catalog?*', (route) =>
    route.fulfill({ json: { items: [flower, otherKiosk], page: 1, hasMore: false } }),
  );
  let submitted = 0;
  await page.route('**/api/member/preorders', async (route) => {
    const input = route.request().postDataJSON();
    expect(input.kind).toBe('CUSTOM');
    expect(input.productId).toBe(flower.productId);
    expect(input.kioskId).toBe(otherKiosk.kioskId);
    expect(input).not.toHaveProperty('bouquetId');
    expect(input.id).toMatch(/^[a-f0-9-]{36}$/);
    submitted++;
    await route.fulfill({ json: { result: input.id } });
  });
  await page.goto('/dat-hoa');
  await page.getByRole('button', { name: 'Đặt hoa', exact: true }).first().click();
  await page.getByLabel('Tủ nhận hoa').selectOption(otherKiosk.kioskId);
  {
    const date = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    await page.getByLabel('Thời gian mong muốn nhận hoa').fill(local);
    await page
      .getByLabel('Dịp tặng, màu hoa, ngân sách và lời nhắn')
      .fill('Hoa sinh nhật màu hồng, ngân sách 400.000 đồng');
  }
  await page.getByRole('checkbox').check();
  const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  expect(axe.violations).toEqual([]);
  await page
    .getByRole('button', {
      name: 'Gửi yêu cầu để shop báo giá',
      exact: true,
    })
    .click();
  await expect(page.getByRole('heading', { name: 'Đã nhận yêu cầu của bạn' })).toBeVisible();
  expect(submitted).toBe(1);
});

test('SELLER cannot create a customer preorder in the FE', async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { ...member, role: 'SELLER' } }),
  );
  await page.route('**/api/shop/catalog?*', (route) =>
    route.fulfill({ json: { items: [flower], page: 1, hasMore: false } }),
  );
  await page.goto('/dat-hoa');
  await page.getByRole('button', { name: 'Đặt hoa', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Gửi yêu cầu để shop báo giá' })).toHaveCount(0);
});

test('same flower at one kiosk keeps Walk-in view separate from Pre-order', async ({ page }) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: member }));
  await page.route('**/api/shop/catalog?*', (route) =>
    route.fulfill({
      json: {
        items: [
          { ...flower, zone: 'WALK_IN', bouquets: ['walk-in-bouquet'] },
          { ...flower, zone: 'PREORDER', bouquets: [] },
        ],
        page: 1,
        hasMore: false,
      },
    }),
  );
  await page.goto('/dat-hoa');
  const cards = page.locator('.flower-card');
  await expect(cards).toHaveCount(2);
  await expect(cards.first().getByRole('button', { name: 'Đặt hoa' })).toHaveCount(0);
  await cards
    .first()
    .getByRole('link', { name: `Xem chi tiết ${flower.name}` })
    .click();
  await expect(page).toHaveURL(/zone=WALK_IN/);
  await expect(page.getByText('Chỉ mua tại kiosk', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đặt hoa', exact: true })).toHaveCount(0);

  await page.goto('/dat-hoa');
  await cards
    .nth(1)
    .getByRole('link', { name: `Xem chi tiết ${flower.name}` })
    .click();
  await expect(page).toHaveURL(/zone=PREORDER/);
  await expect(page.getByRole('button', { name: 'Đặt hoa', exact: true })).toBeVisible();

  await page.goto(`/dat-hoa/${flower.productId}/${flower.kioskId}`);
  await expect(page.getByRole('button', { name: 'Đặt hoa', exact: true })).toBeVisible();
});

for (const zone of ['WALK_IN', 'UNKNOWN']) {
  test(`stock with zone ${zone} cannot enter web ordering`, async ({ page }) => {
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: member }));
    await page.route('**/api/shop/catalog?*', (route) =>
      route.fulfill({ json: { items: [{ ...flower, zone }], page: 1, hasMore: false } }),
    );
    const writes: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && /preorders|checkout|payment/.test(request.url())) {
        writes.push(request.url());
      }
    });
    await page.goto('/dat-hoa');
    const card = page.locator('.flower-card');
    await expect(card).toHaveCount(1);
    await expect(card.getByRole('button', { name: 'Đặt hoa', exact: true })).toHaveCount(0);
    if (zone === 'WALK_IN') {
      await expect(card.getByText('Chỉ mua tại kiosk', { exact: true })).toBeVisible();
      await expect(card.getByText(flower.kioskName, { exact: true })).toBeVisible();
      await expect(card.getByText(flower.address, { exact: true })).toBeVisible();
    }
    await expect(card.getByRole('button', { name: 'Xem chi tiết', exact: true })).toHaveCount(0);
    await expect(
      card.getByRole('button', { name: 'Nhắn tin với shop', exact: true }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /thanh toán|Gửi yêu cầu/ })).toHaveCount(0);
    await expect(page.locator('.flower-request')).toHaveCount(0);
    expect(writes).toEqual([]);
  });
}

test('legacy API design templates still place CUSTOM requests without guessing stock zones', async ({
  page,
}) => {
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: member }));
  await page.route('**/api/shop/catalog?*', (route) =>
    route.fulfill({
      json: { items: [{ ...flower, zone: undefined, bouquets: [] }], page: 1, hasMore: false },
    }),
  );
  await page.route('**/api/member/preorders', async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ kind: 'CUSTOM' });
    expect(route.request().postDataJSON()).not.toHaveProperty('bouquetId');
    // Server rejections must remain visible, with no success or checkout navigation.
    await route.fulfill({ status: 409, json: { detail: 'Kiosk không nhận đơn mới' } });
  });
  await page.goto('/dat-hoa');
  await page.getByRole('button', { name: 'Đặt hoa', exact: true }).click();
  await expect(page.getByRole('radio')).toHaveCount(0);
  const date = new Date(Date.now() + 48 * 60 * 60 * 1000);
  await page
    .getByLabel('Thời gian mong muốn nhận hoa')
    .fill(new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
  await page
    .getByLabel('Dịp tặng, màu hoa, ngân sách và lời nhắn')
    .fill('Hoa sinh nhật màu hồng, ngân sách 400.000 đồng');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: 'Gửi yêu cầu để shop báo giá', exact: true }).click();
  await expect(page.locator('.flower-request').getByRole('alert')).toContainText(
    'Kiosk không nhận đơn mới',
  );
  await expect(page.getByRole('heading', { name: 'Đã nhận yêu cầu của bạn' })).toHaveCount(0);
});

for (const width of [390, 1440])
  test(`Member registration is accessible and responsive ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/dang-ky');
    await expect(page.getByRole('heading', { name: 'Tạo tài khoản FloraBot' })).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `.impeccable/review/member-register-${width}.png`,
      fullPage: true,
    });
  });

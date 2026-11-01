import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
const productId = '30000000-0000-0000-0000-000000000001';
const kioskId = '40000000-0000-0000-0000-000000000001';
const otherKioskId = '40000000-0000-0000-0000-000000000002';
const flower = {
  productId,
  kioskId,
  sellerId: '20000000-0000-0000-0000-000000000001',
  name: 'Bó hoa theo yêu cầu',
  shopName: 'Shop thử luồng',
  kioskName: 'Tủ nhận thứ nhất',
  address: '12 Nguyễn Huệ, phường Sài Gòn, TP.HCM',
  description: 'Mẫu hoa được shop chuẩn bị theo yêu cầu.',
  price: 250000,
  photo: '/images/floral-white-online.webp',
  bouquets: [],
  zone: 'PREORDER',
};
async function fixture(page: Page) {
  const state = { writes: [] as Record<string, unknown>[] };
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/member/preorders' && req.method() === 'POST') {
      state.writes.push(req.postDataJSON());
      return route.fulfill({ status: 201, json: {} });
    }
    if (req.method() !== 'GET') return route.abort();
    if (path === '/api/auth/me')
      return route.fulfill({
        json: { id: 'customer-product-test', name: 'Khách test', role: 'CUSTOMER' },
      });
    if (path === '/api/shop/catalog')
      return route.fulfill({
        json: {
          items: [
            flower,
            {
              ...flower,
              kioskId: otherKioskId,
              kioskName: 'Tủ nhận thứ hai',
              address: '219 Nguyễn Văn Tăng, TP.HCM',
            },
          ],
          page: 1,
          hasMore: false,
        },
      });
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  return state;
}
async function open(page: Page) {
  await page.goto(`/dat-hoa/${productId}/${kioskId}`);
  await page.getByRole('button', { name: 'Yêu cầu báo giá', exact: true }).click();
  return page.getByRole('dialog', { name: 'Yêu cầu báo giá', exact: true });
}
async function future(page: Page, days = 1) {
  return page.evaluate((days) => {
    const date = new Date(Date.now() + days * 86400000);
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  }, days);
}
for (const width of [390, 1440]) {
  test(`Product journey exposes price, destination and a single scrollable quotation at ${width}px`, async ({
    page,
  }) => {
    const state = await fixture(page);
    await page.setViewportSize({ width, height: 950 });
    await page.goto(`/dat-hoa/${productId}/${kioskId}`);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(flower.name);
    await expect(page.locator('.flower-detail-shop')).toContainText(flower.shopName);
    await expect(page.locator('.flower-detail-pricing')).toContainText('250.000');
    await expect(page.locator('.flower-detail-note')).toContainText('trước khi bạn thanh toán');
    await expect(
      page.getByRole('button', { name: 'Yêu cầu báo giá', exact: true }),
    ).toBeInViewport();
    await page.screenshot({ path: test.info().outputPath(`detail-${width}.png`), fullPage: false });
    await page.getByRole('button', { name: 'Yêu cầu báo giá', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Yêu cầu báo giá', exact: true });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('.flower-request-kiosk-content')).toContainText(flower.address);
    await expect(
      dialog.getByRole('button', { name: 'Gửi yêu cầu để shop báo giá', exact: true }),
    ).toBeInViewport();
    await dialog.getByRole('checkbox').check();
    await dialog.getByLabel('Tủ nhận hoa', { exact: true }).selectOption(otherKioskId);
    await expect(dialog.getByRole('checkbox')).not.toBeChecked();
    await expect(dialog.locator('.flower-request-kiosk-content')).toContainText(
      '219 Nguyễn Văn Tăng',
    );
    expect(
      (
        await new AxeBuilder({ page })
          .include('.flower-request')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await dialog.locator('.flower-request-scroll').evaluate((el) => {
      el.scrollTop = 0;
    });
    await page.screenshot({
      path: test.info().outputPath(`quotation-${width}.png`),
      fullPage: false,
    });
    expect(state.writes).toEqual([]);
  });
}
test('Product quotation focuses invalid fields and sends only the selected kiosk after correction', async ({
  page,
}) => {
  const state = await fixture(page);
  const dialog = await open(page);
  await dialog.getByLabel('Tủ nhận hoa', { exact: true }).selectOption(otherKioskId);
  await dialog.getByRole('checkbox').check();
  const submit = dialog.getByRole('button', { name: 'Gửi yêu cầu để shop báo giá', exact: true });
  await submit.click();
  const pickup = dialog.getByLabel('Thời gian mong muốn nhận hoa', { exact: true });
  await expect(pickup).toBeFocused();
  await expect(pickup).toHaveAttribute('aria-invalid', 'true');
  await expect(
    dialog.getByRole('alert').filter({ hasText: 'Chọn thời gian nhận trong tương lai' }),
  ).toBeVisible();
  await pickup.fill(await future(page));
  await submit.click();
  const brief = dialog.getByLabel('Dịp tặng, màu hoa, ngân sách và lời nhắn', { exact: true });
  await expect(brief).toBeFocused();
  await expect(brief).toHaveAttribute('aria-invalid', 'true');
  expect(state.writes).toEqual([]);
  await brief.fill('Hoa hồng tông pastel, ngân sách 400.000 đồng');
  await submit.click();
  await expect(
    dialog.getByRole('heading', { name: 'Đã nhận yêu cầu của bạn', exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({ kioskId: otherKioskId, productId, kind: 'CUSTOM' });
  expect(Object.keys(state.writes[0]).sort()).toEqual(
    ['id', 'kind', 'productId', 'kioskId', 'pickupAt', 'instructions'].sort(),
  );
});
test('Product quotation rejects a date beyond 30 days without creating an order', async ({
  page,
}) => {
  const state = await fixture(page);
  const dialog = await open(page);
  await dialog
    .getByLabel('Thời gian mong muốn nhận hoa', { exact: true })
    .fill(await future(page, 31));
  await dialog
    .getByLabel('Dịp tặng, màu hoa, ngân sách và lời nhắn', { exact: true })
    .fill('Lời nhắn để shop chuẩn bị hoa');
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Gửi yêu cầu để shop báo giá', exact: true }).click();
  await expect(dialog.getByRole('alert').filter({ hasText: 'tối đa 30 ngày tới' })).toBeVisible();
  expect(state.writes).toEqual([]);
});

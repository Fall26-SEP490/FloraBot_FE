import { chooseOption } from '../fixtures/select';
import { fillPickup } from '../fixtures/quotation';
import { chooseVietnamDate } from '../fixtures/vietnam-date';
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
async function fixture(page: Page, stock?: { available: boolean; rejectNext?: boolean }) {
  const state = { writes: [] as Record<string, unknown>[], catalogReads: 0 };
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/member/preorders' && req.method() === 'POST') {
      state.writes.push(req.postDataJSON());
      if (stock?.rejectNext) {
        stock.available = false;
        stock.rejectNext = false;
        return route.fulfill({
          status: 409,
          json: { detail: 'PREORDER_PRODUCT_OUT_OF_STOCK' },
        });
      }
      return route.fulfill({ status: 201, json: {} });
    }
    if (req.method() !== 'GET') return route.abort();
    if (path === '/api/auth/me')
      return route.fulfill({
        json: { id: 'customer-product-test', name: 'Khách test', role: 'CUSTOMER' },
      });
    if (path.endsWith('/preorder-availability'))
      return route.fulfill({ json: { available: true } });
    if (path.endsWith('/catalog/accessories'))
      return route.fulfill({
        json: [{ id: 'bow', name: 'Nơ lụa', price: 10000, availableQuantity: 2 }],
      });
    if (path === '/api/shop/catalog') {
      state.catalogReads++;
      return route.fulfill({
        json: {
          items: [
            { ...flower, preorderAvailable: stock?.available },
            {
              ...flower,
              kioskId: otherKioskId,
              kioskName: 'Tủ nhận thứ hai',
              address: '219 Nguyễn Văn Tăng, TP.HCM',
              preorderAvailable: stock?.available,
            },
            ...(stock
              ? [
                  {
                    ...flower,
                    name: 'Bó hoa mua tại tủ',
                    zone: 'WALK_IN',
                    preorderAvailable: false,
                  },
                ]
              : []),
          ],
          page: 1,
          hasMore: false,
        },
      });
    }
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  return state;
}
async function open(page: Page) {
  await page.goto(`/dat-hoa/${productId}/${kioskId}`);
  await page.getByRole('button', { name: 'Đặt trước', exact: true }).click();
  return page.getByRole('dialog', { name: 'Yêu cầu báo giá', exact: true });
}
async function future(page: Page, days = 1) {
  return page.evaluate((days) => {
    const date = new Date(Date.now() + days * 86400000);
    return new Date(date.getTime() + 7 * 3600000).toISOString().slice(0, 16);
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
    await expect(page.locator('.flower-detail-main-img')).toHaveCSS('object-fit', 'cover');
    expect(
      await page.locator('.site-content').evaluate((el) => getComputedStyle(el).backgroundImage),
    ).toContain('florabot-pattern.webp');
    await expect(page.getByRole('button', { name: 'Đặt trước', exact: true })).toBeInViewport();
    await page.screenshot({ path: test.info().outputPath(`detail-${width}.png`), fullPage: false });
    await page.getByRole('button', { name: 'Đặt trước', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Yêu cầu báo giá', exact: true });
    await expect(dialog).toBeVisible();
    await chooseOption(dialog.getByLabel('Tủ nhận hoa', { exact: true }), kioskId);
    await expect(dialog.locator('.flower-request-kiosk-address')).toContainText(flower.address);
    await expect(
      dialog.getByRole('button', { name: 'Gửi yêu cầu báo giá', exact: true }),
    ).toBeInViewport();

    await chooseOption(dialog.getByLabel('Tủ nhận hoa', { exact: true }), otherKioskId);
    await expect(dialog.getByRole('checkbox')).toHaveCount(0);
    await expect(dialog.locator('.flower-request-kiosk-address')).toContainText(
      '219 Nguyễn Văn Tăng',
    );
    const brief = dialog.getByLabel('Bạn muốn bó hoa như thế nào?');
    const suggestion = dialog.getByRole('button', { name: 'Sinh nhật', exact: true });
    await suggestion.click();
    await expect(suggestion).toHaveAttribute('aria-disabled', 'true');
    await suggestion.evaluate((button: HTMLButtonElement) => button.click());
    await expect(brief).toHaveValue('Tặng sinh nhật, hoa tông pastel');
    await dialog.getByRole('button', { name: 'Thêm Nơ lụa' }).click();
    await expect(dialog.getByRole('status', { name: 'Số lượng Nơ lụa' })).toHaveText('1');
    if (width === 390) {
      const button = dialog.getByRole('button', { name: 'Gửi yêu cầu báo giá', exact: true });
      const box = await button.boundingBox();
      expect(box && box.y + box.height <= 950).toBeTruthy();
    }
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
    if (width === 390) {
      await dialog.locator('.flower-request-scroll').evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });
      await page.screenshot({ path: test.info().outputPath('quotation-accessories.png') });
    }
    expect(state.writes).toEqual([]);
  });
}

test('Product photo zoom preserves the page and returns focus before opening a quotation', async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto(`/dat-hoa/${productId}/${kioskId}`);
  const zoom = page.getByRole('button', { name: 'Phóng to ảnh mẫu hoa' });
  await zoom.click();
  const preview = page.getByRole('dialog', { name: 'Ảnh mẫu hoa', exact: true });
  await expect(preview.getByRole('img')).toHaveAttribute('src', flower.photo);
  await page.keyboard.press('Escape');
  await expect(preview).toHaveCount(0);
  await expect(zoom).toBeFocused();
  await page.getByRole('button', { name: 'Đặt trước', exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Yêu cầu báo giá', exact: true })).toBeVisible();
  expect(state.writes).toEqual([]);
});
test('Product quotation focuses invalid fields and sends only the selected kiosk after correction', async ({
  page,
}) => {
  const state = await fixture(page);
  const dialog = await open(page);
  await chooseOption(dialog.getByLabel('Tủ nhận hoa', { exact: true }), otherKioskId);

  const submit = dialog.getByRole('button', { name: 'Gửi yêu cầu báo giá', exact: true });
  await expect(
    dialog.getByText('Chọn ngày và giờ bạn muốn nhận hoa.', { exact: true }),
  ).toBeVisible();
  await submit.click();
  const pickup = dialog.getByLabel('Ngày nhận hoa', { exact: true });
  await expect(pickup).toBeFocused();
  await expect(pickup).toHaveAttribute('aria-invalid', 'true');
  await expect(
    dialog.getByRole('alert').filter({ hasText: 'Vui lòng nhập hoặc chọn thông tin này.' }).first(),
  ).toBeVisible();
  await fillPickup(dialog, await future(page));
  await chooseVietnamDate(dialog, 'Ngày nhận hoa', (await future(page, 2)).split('T')[0]);
  await expect(pickup).toContainText(
    (await future(page, 2)).split('T')[0].split('-').reverse().join('/'),
  );
  await chooseVietnamDate(dialog, 'Ngày nhận hoa', (await future(page)).split('T')[0]);
  await expect(dialog.getByText('Nhập mong muốn ít nhất 10 ký tự để shop báo giá.')).toBeVisible();
  await submit.click();
  const brief = dialog.getByLabel('Bạn muốn bó hoa như thế nào?', { exact: true });
  await expect(brief).toBeFocused();
  await expect(brief).toHaveAttribute('aria-invalid', 'true');
  expect(state.writes).toEqual([]);
  await brief.fill('Hoa hồng tông pastel, ngân sách 400.000 đồng');
  await expect(dialog.locator('.flower-request-ready')).toContainText('Tủ nhận thứ hai');
  await expect(dialog.locator('.flower-request-ready')).toContainText(/\d{2}\/\d{2}\/\d{4}/);
  await submit.click();
  await expect(
    dialog.getByRole('heading', { name: 'Đã nhận yêu cầu của bạn', exact: true }),
  ).toBeVisible();
  expect(state.writes).toHaveLength(1);
  expect(state.writes[0]).toMatchObject({ kioskId: otherKioskId, productId, kind: 'CUSTOM' });
  expect(Object.keys(state.writes[0]).sort()).toEqual(
    ['id', 'kind', 'productId', 'kioskId', 'pickupAt', 'instructions', 'accessories'].sort(),
  );
  expect(state.writes[0].accessories).toEqual([]);
});
test('Product quotation rejects a date beyond 30 days without creating an order', async ({
  page,
}) => {
  const state = await fixture(page);
  const dialog = await open(page);
  await chooseOption(dialog.getByLabel('Tủ nhận hoa', { exact: true }), kioskId);
  const [year, month, day] = (await future(page, 31)).split('T')[0].split('-');
  await dialog.getByRole('combobox', { name: 'Ngày nhận hoa', exact: true }).click();
  const calendar = page.locator('[data-vietnam-calendar]');
  await calendar.getByRole('combobox', { name: 'Năm', exact: true }).click();
  await page.getByRole('option', { name: year, exact: true }).click();
  await calendar.getByRole('combobox', { name: 'Tháng', exact: true }).click();
  await page.getByRole('option', { name: String(Number(month)), exact: true }).click();
  await expect(
    calendar.getByRole('button', { name: `${day}/${month}/${year}`, exact: true }),
  ).toBeDisabled();
  expect(state.writes).toEqual([]);
});

test('A preorder that sells out during quotation refreshes the catalog and blocks another submit', async ({
  page,
}) => {
  const state = await fixture(page, { available: true, rejectNext: true });
  const dialog = await open(page);
  await chooseOption(dialog.getByLabel('Tủ nhận hoa', { exact: true }), kioskId);
  await fillPickup(dialog, await future(page));
  const brief = dialog.getByLabel('Bạn muốn bó hoa như thế nào?', { exact: true });
  await brief.fill('Hoa hồng tông pastel, ngân sách 400.000 đồng');

  const readsBeforeSubmit = state.catalogReads;
  const submit = dialog.getByRole('button', { name: 'Gửi yêu cầu báo giá', exact: true });
  await submit.click();
  await expect(dialog.getByRole('alert').filter({ hasText: 'Mẫu hoa đã hết hàng' })).toBeVisible();
  await expect(submit).toBeDisabled();
  await expect(brief).toHaveValue('Hoa hồng tông pastel, ngân sách 400.000 đồng');
  await expect.poll(() => state.catalogReads).toBeGreaterThan(readsBeforeSubmit);
  await expect(page.getByRole('link', { name: 'Xem mẫu còn nhận đặt của shop' })).toBeVisible();
  expect(state.writes).toHaveLength(1);
});

test('Sold-out preorder stays visible on home and catalog while Walk-in still links to its kiosk', async ({
  page,
}) => {
  const state = await fixture(page, { available: false });
  await page.goto('/');
  const preorder = page.getByRole('link', {
    name: `${flower.name} · Hết hàng`,
    exact: true,
  });
  await expect(preorder.getByText('Hết hàng', { exact: true })).toBeVisible();
  await page.goto('/dat-hoa?mode=custom');
  const preorderCard = page.locator('.flower-card').filter({ hasText: flower.name });
  await expect(preorderCard.getByText('Hết hàng', { exact: true })).toBeVisible();
  await expect(preorderCard.getByRole('button', { name: 'Yêu cầu báo giá' })).toHaveCount(0);
  await page.goto('/dat-hoa?mode=stock');
  const walkIn = page.locator('.flower-card').filter({ hasText: 'Bó hoa mua tại tủ' });
  await expect(walkIn.getByText('Chỉ mua tại kiosk', { exact: true })).toBeVisible();
  await expect(walkIn.getByRole('link', { name: 'Xem kiosk' })).toHaveAttribute(
    'href',
    `/tim-kiosk?kiosk=${kioskId}`,
  );
  expect(state.writes).toEqual([]);
});

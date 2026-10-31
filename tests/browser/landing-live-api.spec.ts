import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { fixture } from './landing-test-data';
const mockOrigin = 'http://127.0.0.1:9473';
const tile = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64',
);
test.beforeEach(async ({ request, page }) => {
  await request.post(`${mockOrigin}/__test/state`, { data: { reset: true } });
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({ contentType: 'image/png', body: tile }),
  );
});
for (const width of [390, 1440])
  test(`API prices, selection, shared map points, budget pagination and SEO at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'geolocation', {
        value: {
          getCurrentPosition: () => {
            throw new Error('Location permission must not be requested');
          },
        },
      });
    });
    await page.goto('/');
    const pricing = page.locator('#goi-thue');
    await expect(pricing.getByRole('heading', { name: fixture.packages[0].name })).toBeVisible();
    await expect(pricing).toContainText('770.000');
    await expect(pricing).toContainText('7 ô');
    await expect(pricing).toContainText('18 tháng');
    await expect(pricing).not.toContainText('đ / tháng');
    await expect(page.locator('#package')).toHaveValue('');
    await pricing
      .getByRole('link', { name: `Chọn ${fixture.packages[1].name}`, exact: true })
      .click();
    await expect(page.locator('#package')).toHaveValue(fixture.packages[1].id);
    await page.locator('#shop-name').fill('Hoa API');
    await page.locator('#phone').fill('0901234567');
    await page.locator('#area').fill('Hà Nội');
    let submitted: unknown;
    await page.route('**/api/sellers', async (route) => {
      submitted = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { id: 'fixture-only', status: 'PENDING' } });
    });
    await page.getByRole('button', { name: 'Đăng ký tư vấn', exact: true }).click();
    await expect(page.locator('.form-status')).toContainText('Đã nhận đăng ký');
    expect(submitted).toMatchObject({ packageId: fixture.packages[1].id, shopName: 'Hoa API' });
    const list = page.locator('.location-list');
    for (const kiosk of fixture.locations) {
      await expect(list).toContainText(kiosk.address);
      await expect(list.getByRole('link', { name: `Chỉ đường đến ${kiosk.name}` })).toHaveAttribute(
        'href',
        kiosk.directionsUrl,
      );
    }
    await page.getByRole('button', { name: 'Mở bản đồ', exact: true }).click();
    await expect(page.locator('.leaflet-interactive[data-kiosk-id]')).toHaveCount(
      fixture.locations.length,
    );
    const listIds = await list
      .locator('[data-kiosk-id]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-kiosk-id')).sort());
    const markerIds = await page
      .locator('.leaflet-interactive[data-kiosk-id]')
      .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('data-kiosk-id')).sort());
    expect(markerIds).toEqual(listIds);
    await expect(page.locator('.leaflet-tooltip')).toHaveCount(fixture.locations.length);
    await expect(page.locator('#vi-tri')).not.toContainText('vị trí demo');
    await expect(page.locator('#vi-tri')).not.toContainText('Quần đảo');
    const gift = page.locator('.gift-demo');
    await gift.getByRole('button', { name: 'Xem gợi ý hoa', exact: true }).click();
    await expect(gift.locator('.gift-results li')).toHaveCount(3);
    await expect(gift).toContainText('111.000');
    await expect(gift).toContainText('Shop API');
    await expect(gift).toContainText(fixture.locations[0].name);
    await expect(gift.locator('.gift-results img').first()).toHaveAttribute(
      'src',
      fixture.catalog[0].photo,
    );
    await expect(gift.locator('select')).toHaveCount(0);
    await expect(gift).not.toContainText('còn bó');
    await gift.getByRole('button', { name: 'Tải thêm mẫu hoa', exact: true }).click();
    await expect(gift).toContainText('Mẫu API 4');
    await expect(gift).toContainText('99.000');
    await expect(gift.getByRole('button', { name: 'Tải thêm mẫu hoa', exact: true })).toHaveCount(
      0,
    );
    const seo = JSON.parse(
      (await page.locator('script[type="application/ld+json"]').textContent()) || '{}',
    );
    expect(JSON.stringify(seo)).not.toMatch(/"(?:Product|Offer)"/);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page
      .locator('#goi-thue')
      .screenshot({ path: `artifacts/landing-api-prices-${width}.png` });
  });

for (const endpoint of ['packages', 'locations', 'catalog'])
  for (const mode of ['empty', 'error'])
    test(`${endpoint} ${mode} is isolated and never replaced with demo data`, async ({
      page,
      request,
    }) => {
      await request.post(`${mockOrigin}/__test/state`, { data: { [endpoint]: mode } });
      await page.goto('/');
      await expect(
        page.getByRole('heading', { name: 'Một bó hoa, thật nhiều thương.' }),
      ).toBeVisible();
      if (endpoint === 'packages') {
        await expect(page.locator('#goi-thue')).toContainText(
          mode === 'empty' ? 'Hiện chưa có gói thuê' : 'Chưa tải được gói thuê',
        );
        await expect(page.locator('#package')).toBeDisabled();
        await expect(
          page.getByRole('button', { name: 'Đăng ký tư vấn', exact: true }),
        ).toBeDisabled();
        await expect(page.locator('.location-list')).toContainText(fixture.locations[0].name);
      } else if (endpoint === 'locations') {
        await expect(page.locator('#vi-tri')).toContainText(
          mode === 'empty' ? 'Chưa có kiosk' : 'Chưa tải được địa điểm',
        );
        await expect(page.locator('.location-list li')).toHaveCount(0);
        await expect(page.getByRole('button', { name: 'Mở bản đồ', exact: true })).toBeDisabled();
        await expect(page.locator('#goi-thue')).toContainText(fixture.packages[0].name);
      } else {
        await expect(page.locator('.gift-demo')).toContainText(
          mode === 'empty' ? 'Hiện chưa có mẫu hoa' : 'Chưa tải được mẫu hoa',
        );
        await expect(page.locator('.gift-results li')).toHaveCount(0);
        await expect(
          page.getByRole('button', { name: 'Xem gợi ý hoa', exact: true }),
        ).toBeDisabled();
        for (const name of [
          'Hồng trắng dịu dàng',
          'Tulip hồng',
          'Hướng dương',
          'Hoa ly hồng',
          'Hồng đỏ',
        ])
          await expect(page.locator('.gift-demo')).not.toContainText(name);
      }
    });

test('Loading packages/catalog blocks fake selection and resolves to a real API packageId', async ({
  page,
}) => {
  let releasePackages = () => {};
  let releaseFlowers = () => {};
  const packagesGate = new Promise<void>((resolve) => {
    releasePackages = resolve;
  });
  const flowersGate = new Promise<void>((resolve) => {
    releaseFlowers = resolve;
  });
  await page.route('**/api/kiosk-packages', async (route) => {
    await packagesGate;
    return route.fulfill({ json: fixture.packages });
  });
  await page.route('**/api/shop/catalog?**', async (route) => {
    await flowersGate;
    return route.fulfill({ json: { items: fixture.catalog, page: 1, hasMore: false } });
  });
  await page.goto('/');
  await expect(page.locator('#goi-thue').getByRole('status')).toContainText('Đang tải gói thuê');
  await expect(page.locator('.gift-demo').getByRole('status')).toContainText('Đang tải mẫu hoa');
  await expect(page.locator('#package')).toBeDisabled();
  await expect(page.locator('#package')).toHaveValue('');
  releasePackages();
  releaseFlowers();
  await page.getByRole('link', { name: `Chọn ${fixture.packages[0].name}`, exact: true }).click();
  await expect(page.locator('#package')).toHaveValue(fixture.packages[0].id);
});

test('Server-rendered addresses and directions remain usable without JavaScript', async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(baseURL || 'http://127.0.0.1:3034');
  await expect(page.locator('.location-list li')).toHaveCount(fixture.locations.length);
  for (const kiosk of fixture.locations) {
    await expect(page.locator('.location-list')).toContainText(kiosk.address);
    await expect(page.getByRole('link', { name: `Chỉ đường đến ${kiosk.name}` })).toHaveAttribute(
      'href',
      kiosk.directionsUrl,
    );
  }
  await context.close();
});

test('Map tile failure keeps the shared address list and directions', async ({ page }) => {
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.goto('/');
  await page.getByRole('button', { name: 'Mở bản đồ', exact: true }).click();
  await expect(page.locator('.map-panel').getByRole('status')).toContainText(
    'Danh sách địa chỉ và liên kết chỉ đường vẫn dùng được.',
  );
  await expect(page.locator('.location-list li')).toHaveCount(fixture.locations.length);
});

test('Location retry has an accessible loading state and recovers without changing prices', async ({
  page,
  request,
}) => {
  await request.post(`${mockOrigin}/__test/state`, { data: { locations: 'error' } });
  await page.goto('/');
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/kiosk-locations', async (route) => {
    await gate;
    return route.fulfill({ json: fixture.locations });
  });
  await page.getByRole('button', { name: 'Tải lại địa điểm', exact: true }).click();
  await expect(page.locator('#vi-tri').getByRole('status')).toContainText('Đang tải vị trí kiosk');
  await expect(page.locator('#goi-thue')).toContainText(fixture.packages[0].name);
  release();
  await expect(page.locator('.location-list li')).toHaveCount(fixture.locations.length);
});

test('A failed later catalog page keeps real loaded results and retries the same page', async ({
  page,
}) => {
  await page.goto('/');
  const gift = page.locator('.gift-demo');
  await gift.getByRole('button', { name: 'Xem gợi ý hoa', exact: true }).click();
  await page.route(
    '**/api/shop/catalog?page=2&search=',
    (route) => route.fulfill({ status: 503, json: { detail: 'retry test' } }),
    { times: 1 },
  );
  await gift.getByRole('button', { name: 'Tải thêm mẫu hoa', exact: true }).click();
  await expect(gift.getByRole('alert')).toContainText('Chưa tải được trang tiếp theo');
  await expect(gift.locator('.gift-results li')).toHaveCount(3);
  await expect(gift.getByRole('button', { name: 'Xem gợi ý hoa', exact: true })).toBeEnabled();
  await gift.getByRole('button', { name: 'Tải thêm mẫu hoa', exact: true }).click();
  await expect(gift).toContainText('Mẫu API 4');
});

import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';

const sellerId = '20000000-0000-0000-0000-000000000001';
const product = {
  id: '30000000-0000-0000-0000-000000000001',
  name: 'Hoa hồng dịu dàng',
  price: 350000,
  tags: [],
  status: 'ACTIVE',
  shelfLifeHours: 48,
};
const bytes = readFileSync('apps/web/public/images/flowers-pink.jpg');
test.beforeEach(async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'user',
        name: 'Shop',
        role: 'SELLER',
        sellerId,
        sellerStatus: 'ACTIVE',
        packageExpiresAt: '2099-01-01',
      },
    }),
  );
  await page.route('**/api/**/products', (route) => route.fulfill({ json: [product] }));
  await page.route('**/api/**/slots', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/**/subscriptions', (route) =>
    route.fulfill({ json: { package: null, subscriptions: [] } }),
  );
  await page.route('**/api/sellers/*/kiosks', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/sellers/*/chats?page=*', (route) =>
    route.fulfill({ json: { items: [], page: 1, pageSize: 20, total: 0 } }),
  );
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
  await page.route('https://res.cloudinary.com/**', (route) =>
    route.fulfill({ contentType: 'image/jpeg', body: bytes }),
  );
});

for (const width of [390, 1440]) {
  test(`Product images validate, preview, upload raw bytes and handle uncertainty ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    let reads = 0;
    let uploads = 0;
    const photos: {
      id: string;
      url: string;
      mimeType: string;
      sizeBytes: number;
      sha256: string;
    }[] = [];
    await page.route('**/photos*', (route) => {
      if (route.request().method() === 'GET') {
        reads++;
        return route.fulfill({ json: { items: photos, hasMore: false } });
      }
      uploads++;
      expect(route.request().headers()['content-type']).toBe('image/jpeg');
      expect(route.request().postDataBuffer()).toEqual(bytes);
      photos.push({
        id: `photo-${uploads}`,
        url: `https://res.cloudinary.com/test/image/upload/v1/florabot/image${uploads}.jpg`,
        mimeType: 'image/jpeg',
        sizeBytes: bytes.length,
        sha256: 'test-digest',
      });
      return uploads === 1 ? route.fulfill({ json: photos[0] }) : route.abort();
    });
    await page.goto('/seller/products');
    await page.locator('.product-list summary').click();
    const section = page.locator('.product-photos');
    expect(reads).toBe(0);
    await section.getByRole('button', { name: 'Xem ảnh sản phẩm' }).click();
    await expect(section.getByText('Chưa có ảnh trên trang này.')).toBeVisible();
    const input = section.getByLabel(`Chọn ảnh cho ${product.name}`);
    await input.setInputFiles({
      name: 'unsafe.svg',
      mimeType: 'image/svg+xml',
      buffer: Buffer.from('<svg/>'),
    });
    await expect(section.getByRole('alert')).toContainText('Chọn ảnh PNG');
    await expect(
      section.getByRole('button', { name: 'Tải ảnh sản phẩm', exact: true }),
    ).toBeDisabled();
    await input.setInputFiles({ name: 'hoa.jpg', mimeType: 'image/jpeg', buffer: bytes });
    await expect(section.getByAltText(`Xem trước ảnh đã chọn cho ${product.name}`)).toBeVisible();
    expect(uploads).toBe(0);
    expect(
      (
        await new AxeBuilder({ page })
          .include('.product-photos')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await section.screenshot({ path: `.impeccable/review/product-photos-${width}.png` });
    await section.getByRole('button', { name: 'Tải ảnh sản phẩm', exact: true }).click();
    await expect(section.getByRole('status').filter({ hasText: 'Đã thêm ảnh' })).toBeFocused();
    await expect(section.getByAltText(`Ảnh 1 của ${product.name}`, { exact: true })).toBeVisible();
    await expect(input).toHaveValue('');
    await input.setInputFiles({ name: 'hoa.jpg', mimeType: 'image/jpeg', buffer: bytes });
    await section.getByRole('button', { name: 'Tải ảnh sản phẩm', exact: true }).click();
    await expect(section.getByRole('alert')).toContainText('Chưa xác định được ảnh đã lưu');
    await expect(input).toBeDisabled();
    await section.getByRole('button', { name: 'Làm mới danh sách ảnh' }).click();
    await expect(section.getByAltText(`Ảnh 2 của ${product.name}`, { exact: true })).toBeVisible();
    await expect(
      section.getByRole('button', { name: 'Tải ảnh sản phẩm', exact: true }),
    ).toBeDisabled();
    expect(uploads).toBe(2);
  });
}

test('Seller captures a product photo from the device camera before uploading', async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => new MediaStream() },
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoWidth', {
      configurable: true,
      get: () => 800,
    });
    Object.defineProperty(HTMLVideoElement.prototype, 'videoHeight', {
      configurable: true,
      get: () => 600,
    });
    CanvasRenderingContext2D.prototype.drawImage = () => undefined;
  });
  let uploaded = false;
  await page.route('**/photos*', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { items: [], hasMore: false } });
    }
    expect(route.request().headers()['content-type']).toBe('image/jpeg');
    expect(route.request().postDataBuffer()?.length).toBeGreaterThan(0);
    uploaded = true;
    return route.fulfill({
      json: {
        id: 'camera-photo',
        url: 'https://res.cloudinary.com/test/image/upload/v1/florabot/camera.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: route.request().postDataBuffer()?.length || 0,
        sha256: 'camera-digest',
      },
    });
  });

  await page.goto('/seller/products');
  await page.locator('.product-list summary').click();
  const section = page.locator('.product-photos');
  await section.getByRole('button', { name: 'Chụp ảnh bằng camera' }).click();
  const camera = section.getByLabel(`Hình ảnh trực tiếp từ camera cho ${product.name}`);
  await expect(camera).toBeVisible();
  await camera.dispatchEvent('loadedmetadata');
  await section.getByRole('button', { name: 'Chụp ảnh', exact: true }).click();
  await expect(section.getByText('Đã chụp ảnh.', { exact: false })).toBeVisible();
  await expect(section.getByAltText(`Xem trước ảnh đã chọn cho ${product.name}`)).toBeVisible();
  await section.getByRole('button', { name: 'Tải ảnh sản phẩm', exact: true }).click();
  await expect.poll(() => uploaded).toBe(true);
  await expect(section.getByText('Đã thêm ảnh cho sản phẩm.')).toBeVisible();
});

test('Expired shop reads gallery pages, retries failed reads and rejects unsafe image URLs', async ({
  page,
}) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: { id: 'user', name: 'Shop', role: 'SELLER', sellerId, sellerStatus: 'PAST_DUE' },
    }),
  );
  let reads = 0;
  await page.route('**/photos*', (route) => {
    reads++;
    if (reads === 1) return route.fulfill({ status: 503, json: {} });
    const second = route.request().url().endsWith('page=2');
    return route.fulfill({
      json: {
        items: second
          ? []
          : [
              {
                id: 'legacy',
                url: 'javascript:alert(1)',
                mimeType: 'image/png',
                sizeBytes: 123,
                sha256: 'demo',
              },
            ],
        hasMore: !second,
      },
    });
  });
  await page.goto('/seller/products');
  await page.locator('.product-list summary').click();
  const section = page.locator('.product-photos');
  await expect(section.getByLabel(`Chọn ảnh cho ${product.name}`)).toBeDisabled();
  await section.getByRole('button', { name: 'Xem ảnh sản phẩm' }).click();
  await expect(section.getByRole('alert')).toContainText('Chưa tải được danh sách ảnh');
  await section.getByRole('button', { name: 'Làm mới danh sách ảnh' }).click();
  await expect(section.getByText('Không hiển thị được', { exact: false })).toBeVisible();
  await section.getByRole('button', { name: 'Trang ảnh sau' }).click();
  await expect(section.getByText('Trang 2', { exact: true })).toBeVisible();
  await expect(section.getByText('Chưa có ảnh trên trang này.')).toBeVisible();
});

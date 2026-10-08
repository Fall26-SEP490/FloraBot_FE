import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
for (const width of [390, 820, 1440]) {
  test(`Landing WCAG and layout ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('h1')).toHaveCount(1);
    await expect(
      page.getByRole('heading', { name: 'Một bó hoa, thật nhiều thương.' }),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Mở bản đồ' }).scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Mở bản đồ' }).click();
    await expect(page.locator('.leaflet-container')).toBeVisible();
    await expect(page.getByText('Quần đảo Hoàng Sa (Việt Nam)', { exact: true })).toBeVisible();
    await expect(page.getByText('Quần đảo Trường Sa (Việt Nam)', { exact: true })).toBeVisible();
    await expect
      .poll(() => page.locator('.leaflet-tile-loaded').count(), { timeout: 15000 })
      .toBeGreaterThan(0);
    await page.locator('#dang-ky').scrollIntoViewIfNeeded();
    await expect(page.locator('#shop-name')).toBeVisible();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect.soft(results.violations).toEqual([]);
    expect
      .soft(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
      .toBe(true);
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: `.impeccable/review/landing-${width}.png`, fullPage: true });
  });
}
test('Registration errors, selected package, and real request shape', async ({ page }) => {
  await page.goto('/');
  await page.locator('#shop-name').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Đăng ký tư vấn' }).click();
  await expect(page.locator('#shop-name')).toBeFocused();
  await expect(page.locator('#shop-error')).toHaveText('Nhập tên shop từ 2 ký tự.');
  await page.getByRole('link', { name: 'Chọn Chuyên nghiệp' }).click();
  await expect(page.locator('#package')).toHaveValue('20000000-0000-0000-0000-00000000000b');
  await page.locator('#shop-name').fill('Tiệm Hoa Thử');
  await page.locator('#phone').fill('0901234567');
  await page.locator('#area').fill('Thủ Đức');
  await page.route('**/api/sellers', async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      shopName: 'Tiệm Hoa Thử',
      phone: '0901234567',
      area: 'Thủ Đức',
      packageId: '20000000-0000-0000-0000-00000000000b',
    });
    await route.fulfill({ status: 201, json: { id: 'test', status: 'PENDING' } });
  });
  await page.getByRole('button', { name: 'Đăng ký tư vấn' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã nhận đăng ký' })).toBeVisible();
});
test('Keyboard skip, narrow reflow, text spacing, and gift demo', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Bỏ qua tới nội dung' })).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.addStyleTag({
    content:
      '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }',
  });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.locator('.gift-demo').scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Xem gợi ý hoa' }).click();
  await expect(page.locator('.gift-results li')).toHaveCount(3);
});

test('Expanded flower collection loads twelve distinct photographs on desktop and mobile', async ({
  page,
}) => {
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.locator('.floral-collection figure')).toHaveCount(8);
    const photos = page.locator(
      '.floral-collection img, .flower-ribbon img, .registration-flowers',
    );
    await expect(photos).toHaveCount(12);
    const loaded: string[] = [];
    for (const photo of await photos.all()) {
      await photo.scrollIntoViewIfNeeded();
      await expect
        .poll(() => photo.evaluate((element) => (element as HTMLImageElement).naturalWidth))
        .toBeGreaterThan(0);
      loaded.push(await photo.evaluate((element) => (element as HTMLImageElement).currentSrc));
    }
    expect(new Set(loaded).size).toBe(12);
    expect(
      loaded.every((source) => source.includes('/_next/static/') && source.endsWith('.avif')),
    ).toBe(true);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page
      .locator('.floral-collection')
      .screenshot({ path: `.impeccable/review/flower-collection-${width}.png` });
  }
});

for (const width of [390, 1440]) {
  test('Privacy WCAG 2.0 and navigation ' + width, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/chinh-sach-rieng-tu');
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Quyền riêng tư của bạn.');
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Bỏ qua tới nội dung' })).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.locator('#main')).toBeFocused();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: '.impeccable/review/privacy-' + width + '.png', fullPage: true });
    await page.getByRole('link', { name: 'Trở về trang chủ' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Một bó hoa, thật nhiều thương.',
    );
  });
}

test('Landing motion, map consent, expanded gift tool and budget', async ({ page }) => {
  let tiles = 0;
  page.on('request', (request) => {
    if (request.url().includes('tile.openstreetmap.org')) tiles++;
  });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(page.locator('.gift-tool > summary')).toHaveCount(0);
  await expect(page.locator('.gift-demo form')).toBeVisible();
  expect(tiles).toBe(0);
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            document.getAnimations().filter((animation) => animation.playState === 'running')
              .length,
        ),
      { timeout: 2000 },
    )
    .toBe(0);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(
    await page
      .locator('.garden-photo')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  expect(
    await page
      .locator('.hero-cabinet')
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  await page.locator('#recipient').selectOption('LOVER');
  await page.locator('#occasion').selectOption('THANKS');
  await page.locator('#tone').selectOption('ROMANTIC');
  await page
    .locator('.budget-options')
    .getByRole('button', { name: /300\.000/ })
    .click();
  await page.getByRole('button', { name: 'Xem gợi ý hoa' }).click();
  await expect(page.locator('.gift-results li')).toHaveCount(3);
  await expect(page.locator('.gift-results')).not.toContainText('350.000');
  await page
    .locator('.budget-options')
    .getByRole('button', { name: /500\.000/ })
    .click();
  await page.getByRole('button', { name: 'Xem gợi ý hoa' }).click();
  await expect(page.locator('.gift-results li').first()).toContainText('Hồng đỏ');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
});

test('Registration preserves values after API error and prevents another send after success', async ({
  page,
}) => {
  await page.goto('/');
  await page.locator('#shop-name').fill('Tiệm Hoa Thử');
  await page.locator('#phone').fill('0901234567');
  await page.locator('#area').fill('Thủ Đức');
  let requests = 0;
  await page.route('**/api/sellers', async (route) => {
    requests++;
    await route.fulfill(
      requests === 1 ? { status: 429, json: {} } : { status: 201, json: { status: 'PENDING' } },
    );
  });
  await page.getByRole('button', { name: 'Đăng ký tư vấn' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Bạn gửi quá nhanh' })).toBeVisible();
  await expect(page.locator('#shop-name')).toHaveValue('Tiệm Hoa Thử');
  await page.getByRole('button', { name: 'Đăng ký tư vấn' }).click();
  await expect(page.getByRole('button', { name: 'Đã gửi đăng ký' })).toBeDisabled();
  await page.getByRole('link', { name: 'Chọn Chuyên nghiệp' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Đã nhận đăng ký' })).toBeVisible();
  expect(requests).toBe(2);
});

test('Server validation focuses the field and keeps registration data', async ({ page }) => {
  await page.goto('/');
  await page.locator('#shop-name').fill('Tiệm Hoa Thử');
  await page.locator('#phone').fill('0901234567');
  await page.locator('#area').fill('Thủ Đức');
  await page.route('**/api/sellers', (route) =>
    route.fulfill({ status: 422, json: { errors: { phone: ['Số điện thoại này đã đăng ký.'] } } }),
  );
  await page.getByRole('button', { name: 'Đăng ký tư vấn' }).click();
  await expect(page.locator('#phone')).toBeFocused();
  await expect(page.locator('#phone')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#phone-error')).toHaveText('Số điện thoại này đã đăng ký.');
  await expect(page.locator('#shop-name')).toHaveValue('Tiệm Hoa Thử');
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
});

test('Mobile prices stay intact and offline map has a usable address fallback', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/');
  await page.evaluate(() => document.fonts.ready);
  await expect(
    page.getByRole('link', { name: 'Bạn là shop hoa? Khám phá gói thuê tủ', exact: true }),
  ).toHaveAttribute('href', '#goi-thue');
  await expect(page.locator('.price-options article')).toHaveCount(2);
  await expect(page.locator('.plan-price strong').first()).toHaveText('400.000');
  await expect(page.locator('.plan-price strong').last()).toHaveText('1.500.000');
  for (const price of await page.locator('.plan-price strong').all()) {
    expect(
      await price.evaluate(
        (element) =>
          element.getBoundingClientRect().height / parseFloat(getComputedStyle(element).lineHeight),
      ),
    ).toBeLessThan(1.1);
  }
  await page.route('https://tile.openstreetmap.org/**', (route) => route.abort());
  await page.getByRole('button', { name: 'Mở bản đồ' }).scrollIntoViewIfNeeded();
  await page.getByRole('button', { name: 'Mở bản đồ' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Bản đồ chưa tải đầy đủ' }),
  ).toBeVisible();
  await expect(page.locator('.location-list')).toContainText('4 Phạm Ngọc Thạch');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.locator('#goi-thue').screenshot({ path: '.impeccable/review/final-pricing-320.png' });
});

test('Connection failure has Vietnamese feedback and allows a retry', async ({ page }) => {
  await page.goto('/');
  await page.locator('#shop-name').fill('Tiệm Hoa Thử');
  await page.locator('#phone').fill('0901234567');
  await page.locator('#area').fill('Thủ Đức');
  await page.route('**/api/sellers', (route) => route.abort());
  await page.getByRole('button', { name: 'Đăng ký tư vấn' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Kết nối bị gián đoạn' })).toBeVisible();
  await expect(page.locator('#phone')).toHaveValue('0901234567');
  await expect(page.getByRole('button', { name: 'Đăng ký tư vấn' })).toBeEnabled();
});

test('Both landing pages support text resized to 200 percent', async ({ page }) => {
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ['/', '/chinh-sach-rieng-tu']) {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await page.addStyleTag({ content: ':root { font-size: 36px !important; }' });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
  }
});

for (const width of [390, 1440]) {
  test(
    'Landing removes info dropdowns and keeps FAQ keyboard access ' + width,
    async ({ page }) => {
      await page.setViewportSize({ width, height: 1000 });
      await page.goto('/');
      await expect(page.locator('.info-hint')).toHaveCount(0);
      await expect(page.getByRole('link', { name: 'Chọn Cơ bản', exact: true })).toBeVisible();
      const faq = page.locator('.faq-list details').first();
      await faq.locator('summary').focus();
      await page.keyboard.press('Enter');
      await expect(faq).toHaveAttribute('open', '');
      await expect(faq.locator('p')).toBeVisible();
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
      ).toEqual([]);
      await page.keyboard.press('Enter');
      await expect(faq.locator('p')).not.toBeVisible();
      await page.goto('/chinh-sach-rieng-tu');
      await page
        .getByRole('navigation', { name: 'Nội dung chính sách' })
        .getByRole('link', { name: 'Quyền của bạn' })
        .click();
      await expect(page).toHaveURL(/#quyen-du-lieu$/);
      await expect(page.locator('#quyen-du-lieu')).toBeInViewport();
      const retention = page.locator('#quyen-du-lieu .info-hint');
      await retention.locator('summary').focus();
      await page.keyboard.press('Enter');
      await expect(retention.locator('.info-content')).toBeVisible();
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    },
  );
}

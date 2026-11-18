import { expect, test, type Locator, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const sample = {
  id: 'sample',
  productId: 'rose',
  kioskId: 'kiosk-a',
  mode: 'PREORDER',
  name: 'Bó hồng pastel dành tặng người thương',
  price: 350000,
  reason: 'Phù hợp với ngân sách và dịp sinh nhật.',
  photo: '/images/floral-pink-online.webp',
  shopName: 'Hoa của bạn',
  kioskName: 'Kiosk A',
  distanceKm: 1.5,
  productRating: 4.5,
  productReviews: 2,
  shopRating: 4,
  shopReviews: 8,
};

test.beforeEach(async ({ page }) => {
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me' || path === '/api/auth/refresh')
      return route.fulfill({ status: 401, json: {} });
    if (path === '/api/kiosks')
      return route.fulfill({
        json: [
          { id: 'kiosk-a', name: 'Kiosk A' },
          { id: 'kiosk-b', name: 'Kiosk B' },
        ],
      });
    if (path === '/api/shop/flower-chat')
      return route.fulfill({
        json: {
          intent: 'FLOWERS',
          message: 'Bạn chọn kiosk để xem hoa có sẵn nhé.',
          suggestions: [],
        },
      });
    if (path.endsWith('/catalog'))
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    return route.fulfill({ json: { items: [], hasMore: false } });
  });
});

async function open(page: Page, url = '/') {
  await page.goto(url);
  const launcher = page.getByRole('button', { name: 'Tư vấn FloraBot', exact: true });
  await launcher.click();
  const dialog = page.getByRole('dialog', { name: 'Tư vấn FloraBot', exact: true });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function selectKiosk(dialog: Locator, name: string) {
  await dialog.getByRole('button', { name: 'Chọn kiosk mua tại tủ', exact: true }).click();
  await dialog.getByRole('button', { name, exact: true }).click();
  await expect(dialog.getByRole('region', { name: 'Chọn kiosk mua tại tủ' })).toHaveCount(0);
  await expect(
    dialog.getByRole('button', { name: 'Chọn kiosk mua tại tủ', exact: true }),
  ).toBeFocused();
}

for (const width of [375, 1440]) {
  test(`Chat exit finishes before releasing scroll and focus at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const dialog = await open(page);
    await dialog.getByRole('textbox').fill('Giữ lại câu hỏi đang nhập');
    await dialog.evaluate(async (panel) => {
      await Promise.all(panel.getAnimations().map((animation) => animation.finished));
    });
    const duringExit = await dialog.evaluate(async (panel) => {
      panel.querySelector<HTMLButtonElement>('.management-modal-close')!.click();
      await new Promise(requestAnimationFrame);
      const animation = panel
        .getAnimations()
        .find((item) => item instanceof CSSAnimation && item.animationName.endsWith('exit'));
      if (!animation) throw new Error('Missing chat exit animation');
      animation.pause();
      const snapshot = {
        state: panel.closest('.flower-advisor-root')?.getAttribute('data-state'),
        locked: document.body.classList.contains('modal-open'),
        attached: panel.isConnected,
      };
      animation.finish();
      return snapshot;
    });
    expect(duringExit).toEqual({ state: 'closing', locked: true, attached: true });
    await expect(dialog).toHaveCount(0);
    await expect(page.locator('body')).not.toHaveClass(/modal-open/);
    const launcher = page.getByRole('button', { name: 'Tư vấn FloraBot', exact: true });
    await expect(launcher).toBeFocused();
    await launcher.click();
    await expect(dialog.getByRole('textbox')).toHaveValue('Giữ lại câu hỏi đang nhập');
    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(launcher).toBeFocused();
  });
}

test('Reduced motion skips chat, picker, resize and message animations without delaying close', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const dialog = await open(page);
  await dialog.getByRole('button', { name: 'Phóng to khung chat' }).click();
  expect(await dialog.evaluate((panel) => panel.getAnimations({ subtree: true }).length)).toBe(0);
  await dialog.getByRole('button', { name: 'Chọn kiosk mua tại tủ', exact: true }).click();
  const picker = dialog.getByRole('region', { name: 'Chọn kiosk mua tại tủ' });
  await expect(picker).toBeVisible();
  expect(await picker.evaluate((panel) => panel.getAnimations({ subtree: true }).length)).toBe(0);
  await page.keyboard.press('Escape');
  await dialog.getByRole('button', { name: 'Gợi ý hoa đặt trước', exact: true }).click();
  await expect(dialog.locator('.flower-advisor-answer')).toContainText('Bạn chọn kiosk');
  expect(await dialog.evaluate((panel) => panel.getAnimations({ subtree: true }).length)).toBe(0);
  const closedBeforeNextFrame = await dialog.evaluate(async (panel) => {
    panel.querySelector<HTMLButtonElement>('.management-modal-close')!.click();
    await new Promise(requestAnimationFrame);
    return !panel.isConnected;
  });
  expect(closedBeforeNextFrame).toBe(true);
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/modal-open/);
});

test('Global support is available to guests on public, authentication and receipt pages', async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.setViewportSize({ width: 375, height: 812 });
  for (const path of ['/', '/dat-hoa', '/dang-nhap', '/receipt', '/phan-anh']) {
    await page.goto(path);
    await expect(page.locator('.site-hotline-button')).toHaveCount(1);
    await expect(page.locator('.site-hotline-button')).toBeVisible();
    const launcher = page.getByRole('button', { name: 'Tư vấn FloraBot', exact: true });
    await expect(launcher).toHaveCount(1);
    await expect(launcher).toBeVisible();
    await launcher.click();
    await expect(
      page.getByRole('dialog').getByRole('button', { name: 'Gợi ý hoa đặt trước', exact: true }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
  }
});

for (const [role, path] of [
  ['CUSTOMER', '/tai-khoan'],
  ['SELLER', '/seller/products'],
  ['SELLER_STAFF', '/staff'],
  ['TECHNICIAN', '/technician'],
  ['OPERATIONS_MANAGER', '/operations'],
  ['ADMIN', '/admin/managers'],
  ['STAFF', '/workspace'],
]) {
  test(`Support visibility and workspace labels for ${role}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const endpoint of [
      '/operations/technicians',
      '/operations/eligible-kiosks',
      '/admin/managers',
    ]) {
      await page.route(`**/api${endpoint}**`, (route) => route.fulfill({ json: [] }));
    }
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ json: { id: role, role, name: 'UAT' } }),
    );
    await page.goto(path);
    await expect(page.locator('.site-hotline-button')).toHaveCount(1);
    await expect(page.locator('.site-hotline-button')).toBeVisible();
    const launcher = page.getByRole('button', { name: 'Tư vấn FloraBot', exact: true });
    await expect(launcher).toHaveCount(1);
    const hotline = page.locator('.site-hotline-button');
    const hotlineLabel = hotline.locator('.site-support-label');
    const chatLabel = launcher.locator('.site-support-label');
    if (role === 'CUSTOMER') {
      await expect(page.locator('.site-support--compact')).toHaveCount(0);
      await expect(hotlineLabel).toBeVisible();
      await expect(chatLabel).toBeVisible();
      await page.setViewportSize({ width: 390, height: 900 });
      await expect(hotlineLabel).toBeVisible();
      await expect(chatLabel).toBeVisible();
    } else {
      await expect(page.locator('.site-support--compact')).toHaveCount(1);
      await expect(hotlineLabel).toBeHidden();
      await expect(chatLabel).toBeHidden();
      expect((await launcher.boundingBox())!.width).toBe(
        (await launcher.locator('.site-support-icon').boundingBox())!.width,
      );
      await launcher.hover();
      await expect(chatLabel).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(chatLabel).toBeHidden();
      await hotline.hover();
      await expect(hotlineLabel).toBeVisible();
      await page.mouse.move(0, 0);
      await expect(hotlineLabel).toBeHidden();
      await hotline.focus();
      await page.keyboard.press('Tab');
      await expect(launcher).toBeFocused();
      await expect(chatLabel).toBeVisible();
      await page.keyboard.press('Shift+Tab');
      await expect(hotline).toBeFocused();
      await expect(hotlineLabel).toBeVisible();
    }
    await launcher.click();
    await expect(
      page.getByRole('dialog').getByRole('button', {
        name: role === 'SELLER' ? 'Viết mô tả và gắn tag' : 'Gợi ý hoa đặt trước',
        exact: true,
      }),
    ).toBeVisible();
    await page.keyboard.press('Escape');
  });
}

test('Global advisor preserves the draft across client navigation without duplicate widgets', async ({
  page,
}) => {
  const dialog = await open(page, '/ve-florabot');
  await dialog.getByRole('textbox').fill('Tư vấn bó hoa tặng mẹ');
  await page.keyboard.press('Escape');
  await page
    .getByRole('navigation', { name: 'Điều hướng chính' })
    .getByRole('link', { name: 'Sản phẩm hoa', exact: true })
    .click();
  await expect(page).toHaveURL(/\/dat-hoa$/);
  await expect(page.locator('.site-hotline-button')).toHaveCount(1);
  const launcher = page.getByRole('button', { name: 'Tư vấn FloraBot', exact: true });
  await expect(launcher).toHaveCount(1);
  await launcher.click();
  await expect(page.getByRole('dialog').getByRole('textbox')).toHaveValue('Tư vấn bó hoa tặng mẹ');
});

test('Customer entry points, hotline spacing, focus and keyboard dismissal', async ({ page }) => {
  await page.goto('/');
  const launch = page.getByRole('button', { name: 'Tư vấn FloraBot', exact: true });
  const launchBox = await launch.boundingBox();
  const hotlineBox = await page.locator('.site-hotline-button').boundingBox();
  expect(hotlineBox!.y + hotlineBox!.height + 12).toBeCloseTo(launchBox!.y, 0);
  const hotlineIcon = await page.locator('.site-hotline-button .site-support-icon').boundingBox();
  const advisorIcon = await launch.locator('.site-support-icon').boundingBox();
  expect(hotlineIcon!.width).toBeGreaterThanOrEqual(44);
  expect(hotlineIcon!.width).toBeLessThanOrEqual(52);
  expect(hotlineIcon!.height).toBe(hotlineIcon!.width);
  expect(advisorIcon!.width).toBe(hotlineIcon!.width);
  expect(advisorIcon!.height).toBe(hotlineIcon!.height);
  expect(hotlineIcon!.x).toBe(advisorIcon!.x);
  await expect(page.locator('.site-hotline-button')).toHaveAttribute('href', 'tel:0355357665');
  await launch.click();
  const dialog = page.getByRole('dialog', { name: 'Tư vấn FloraBot' });
  await expect(dialog.locator('.flower-advisor-options, .flower-advisor-welcome-mark')).toHaveCount(
    0,
  );
  await expect(dialog.getByText(/^FloraBot có thể nhầm\./)).toBeVisible();
  await expect(dialog.getByText(/Mỗi câu hỏi được xử lý riêng/)).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Phóng to khung chat' }).click();
  await expect(dialog).toHaveClass(/flower-advisor--expanded/);
  await dialog.getByRole('button', { name: 'Thu nhỏ khung chat' }).click();
  await expect(dialog).not.toHaveClass(/flower-advisor--expanded/);
  await expect(
    dialog.getByText('FloraBot xin chào, chúng tôi có thể giúp gì cho bạn ạ?'),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Tìm kiosk gần tôi', exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Shop bán nhiều đơn', exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole('button', { name: 'Gợi ý hoa đặt trước', exact: true }),
  ).toBeVisible();
  await dialog.getByRole('textbox').focus();
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  expect(
    await page.evaluate(() =>
      document.querySelector('[role="dialog"]')?.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(launch).toBeFocused();
  const catalogDialog = await open(page, '/dat-hoa');
  await expect(
    catalogDialog.getByRole('button', { name: 'Gợi ý hoa đặt trước', exact: true }),
  ).toBeVisible();
});

test('Location is opt-in and removable, text answers do not render empty cards', async ({
  page,
}) => {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 10.9, longitude: 106.6 });
  let requests = 0;
  await page.route('**/api/shop/flower-chat', (route) => {
    const input = route.request().postDataJSON();
    requests++;
    if (requests === 2) {
      expect(input.latitude).toBe(10.9);
      expect(input.longitude).toBe(106.6);
    } else {
      expect(input.latitude).toBeUndefined();
      expect(input.longitude).toBeUndefined();
    }
    return route.fulfill({
      json: {
        intent: 'FLOWERS',
        message:
          requests === 1
            ? 'Hãy dùng vị trí của bạn để tìm kiosk gần nhất.'
            : requests === 2
              ? 'Kiosk A là kiosk gần nhất, cách 1,5 km.'
              : 'Shop Hoa của bạn dẫn đầu theo số đơn hoàn tất.',
        suggestions: [],
      },
    });
  });
  const dialog = await open(page);
  await expect(dialog.getByRole('button', { name: 'Dùng vị trí của tôi' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Tìm kiosk gần tôi', exact: true }).click();
  await expect(dialog.getByText('Hãy dùng vị trí của bạn để tìm kiosk gần nhất.')).toBeVisible();
  await dialog.getByRole('textbox').fill('Tôi muốn mua hoa màu tím');
  await dialog.getByRole('button', { name: 'Dùng vị trí của tôi' }).click();
  await expect(dialog.getByText('Đã bật gợi ý gần bạn')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Bỏ vị trí của tôi' })).toContainText(
    'Đã bật vị trí',
  );
  await expect(dialog.getByText('Kiosk A là kiosk gần nhất, cách 1,5 km.')).toBeVisible();
  await expect(dialog.getByRole('textbox')).toHaveValue('Tôi muốn mua hoa màu tím');
  await dialog.getByRole('button', { name: 'Bỏ vị trí của tôi' }).click();
  await dialog.getByRole('button', { name: 'Shop bán nhiều đơn', exact: true }).click();
  await expect(dialog.getByText('Shop Hoa của bạn dẫn đầu theo số đơn hoàn tất.')).toBeVisible();
  await expect(dialog.locator('.flower-advisor-suggestion')).toHaveCount(0);
});

test('Preorder cards show honest ratings, distance and the correct destination', async ({
  page,
}) => {
  await page.route('**/missing-advisor-photo.jpg', (route) =>
    route.fulfill({ status: 404, body: '' }),
  );
  await page.route('**/api/shop/flower-chat', (route) => {
    const input = route.request().postDataJSON();
    expect(input.mode).toBe('PREORDER');
    expect(input.budget).toBe(400000);
    expect(input.kioskId).toBeUndefined();
    return route.fulfill({
      json: {
        intent: 'FLOWERS',
        message: 'Có các mẫu nhận đặt trước.',
        suggestions: [
          sample,
          {
            ...sample,
            id: 'unrated',
            name: 'Hoa chưa có ảnh và đánh giá',
            photo: null,
            productRating: null,
            shopRating: null,
          },
          { ...sample, id: 'broken', photo: '/missing-advisor-photo.jpg', name: 'Mẫu ảnh bị lỗi' },
        ],
      },
    });
  });
  const dialog = await open(page);
  await selectKiosk(dialog, 'Kiosk B');
  await dialog.getByRole('button', { name: 'Gợi ý hoa đặt trước', exact: true }).click();
  await expect(dialog.locator('.flower-advisor-suggestion')).toHaveCount(3);
  const card = dialog.locator('.flower-advisor-suggestion').first();
  await expect(card.getByRole('link')).toHaveAttribute(
    'href',
    '/dat-hoa/rose/kiosk-a?zone=PREORDER',
  );
  await expect(card.locator('img')).toHaveAttribute('alt', sample.name);
  expect(await card.locator('img').evaluate((image) => getComputedStyle(image).objectFit)).toBe(
    'contain',
  );
  await expect(card.getByText('Giá mẫu', { exact: true })).toBeVisible();
  await expect(card.getByText('Mẫu hoa: 4,5/5 (2 lượt)')).toBeVisible();
  await expect(card.getByText('Shop: 4/5 (8 lượt)')).toBeVisible();
  await expect(card.getByText('Cách khoảng 1,5 km · đường chim bay')).toBeVisible();
  const unrated = dialog.locator('.flower-advisor-suggestion').nth(1);
  await expect(unrated.locator('.flower-advisor-ratings')).toHaveCount(0);
  await expect(unrated.getByRole('img', { name: 'Mẫu hoa chưa có ảnh' })).toBeVisible();
  await expect(unrated.locator('img')).toHaveCount(0);
  const broken = dialog.locator('.flower-advisor-suggestion').nth(2);
  await broken.scrollIntoViewIfNeeded();
  await expect(broken.locator('img')).toHaveCount(0);
});

test('Walk-in uses the selected kiosk and preorder location is not sent', async ({ page }) => {
  await page.context().grantPermissions(['geolocation']);
  await page.context().setGeolocation({ latitude: 10.9, longitude: 106.6 });
  await page.route('**/api/shop/flower-chat', (route) => {
    const input = route.request().postDataJSON();
    if (input.mode === 'PREORDER') {
      expect(input.question).toBe('Kiosk nào gần tôi nhất?');
      expect(input.latitude).toBe(10.9);
      expect(input.longitude).toBe(106.6);
      return route.fulfill({
        json: { intent: 'FLOWERS', message: 'Đã tìm kiosk gần bạn.', suggestions: [] },
      });
    }
    expect(input.mode).toBe('WALK_IN');
    expect(input.latitude).toBeUndefined();
    expect(input.longitude).toBeUndefined();
    if (!input.kioskId)
      return route.fulfill({
        json: {
          intent: 'FLOWERS',
          message: 'Bạn chọn kiosk để xem hoa mua ngay nhé.',
          suggestions: [],
        },
      });
    expect(input.kioskId).toBe('kiosk-b');
    return route.fulfill({
      json: {
        intent: 'FLOWERS',
        message: 'Hoa có sẵn tại Kiosk B.',
        suggestions: [{ ...sample, mode: 'WALK_IN', kioskId: 'kiosk-b', kioskName: 'Kiosk B' }],
      },
    });
  });
  const dialog = await open(page);
  await dialog.getByRole('button', { name: 'Dùng vị trí của tôi' }).click();
  await expect(dialog.getByRole('button', { name: 'Bỏ vị trí của tôi' })).toBeVisible();
  await expect(dialog.getByText('Đã tìm kiosk gần bạn.')).toBeVisible();
  await dialog.getByRole('textbox').fill('Ở tủ này có hoa nào mua ngay?');
  await dialog.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await expect(dialog.getByText('Bạn chọn kiosk để xem hoa mua ngay nhé.')).toBeVisible();
  await selectKiosk(dialog, 'Kiosk B');
  await dialog.getByRole('button', { name: 'Xem hoa tại tủ' }).click();
  await expect(dialog.getByRole('link', { name: /Mua tại tủ:/ })).toHaveAttribute(
    'href',
    '/tim-kiosk?kiosk=kiosk-b',
  );
  await dialog.getByRole('textbox').fill('Tôi muốn mua ngay một bó hoa');
  await dialog.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await expect(dialog.locator('.flower-advisor-exchange')).toHaveCount(4);
  await expect(dialog.locator('.flower-advisor-pending')).toHaveCount(0);
});

test('Denied geolocation and kiosk fetch failures do not block the composer', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: (_success: unknown, failure: (error: { code: number }) => void) =>
          failure({ code: 1 }),
      },
    });
  });
  let kioskRequests = 0;
  await page.route('**/api/kiosks', (route) =>
    ++kioskRequests === 1
      ? route.fulfill({ status: 503, json: {} })
      : route.fulfill({ json: [{ id: 'kiosk-a', name: 'Kiosk A' }] }),
  );
  const dialog = await open(page);
  await dialog.getByRole('button', { name: 'Dùng vị trí của tôi' }).click();
  await expect(dialog.getByText(/Bạn chưa cho phép định vị/)).toBeVisible();
  await expect(dialog.getByRole('textbox')).toBeEnabled();
  await dialog.getByRole('button', { name: 'Chọn kiosk mua tại tủ', exact: true }).click();
  await dialog.getByRole('button', { name: 'Tải lại kiosk' }).click();
  await dialog.getByRole('button', { name: 'Kiosk A', exact: true }).click();
  await dialog.getByRole('textbox').fill('Tủ K-HCM-12 nhận hoa ở đâu?');
  await dialog.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await expect(dialog.getByText('Bạn chọn kiosk để xem hoa có sẵn nhé.')).toBeVisible();
});

test('UNAVAILABLE at HTTP 200 retries in place and prevents duplicate requests', async ({
  page,
}) => {
  let calls = 0;
  let release: () => void = () => {};
  const pending = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/shop/flower-chat', async (route) => {
    calls++;
    if (calls === 1) {
      await pending;
      return route.fulfill({
        json: {
          intent: 'UNAVAILABLE',
          message: 'FloraBot đang bận, vui lòng thử lại.',
          suggestions: [],
        },
      });
    }
    return route.fulfill({
      json: { intent: 'FLOWERS', message: 'Đã tìm thấy kiosk của bạn.', suggestions: [] },
    });
  });
  const dialog = await open(page);
  await dialog.getByRole('textbox').fill('Tủ này ở đâu?');
  await dialog.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await expect(dialog.getByText('FloraBot đang tìm gợi ý…')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Gửi câu hỏi' })).toBeDisabled();
  await dialog.getByRole('textbox').fill('Câu hỏi tiếp theo');
  await page.keyboard.press('Enter');
  expect(calls).toBe(1);
  release();
  await expect(dialog.getByText('FloraBot đang bận, vui lòng thử lại.')).toBeVisible();
  await dialog.getByRole('button', { name: 'Gửi lại câu hỏi' }).click();
  await expect(dialog.getByText('Đã tìm thấy kiosk của bạn.')).toBeVisible();
  await expect(dialog.locator('.flower-advisor-exchange')).toHaveCount(1);
  await expect(dialog.getByRole('textbox')).toHaveValue('Câu hỏi tiếp theo');
});

test('Network errors preserve the question and allow a retry', async ({ page }) => {
  let calls = 0;
  await page.route('**/api/shop/flower-chat', (route) =>
    ++calls === 1
      ? route.abort('failed')
      : route.fulfill({
          json: {
            intent: 'OFF_TOPIC',
            message: 'Bạn muốn FloraBot gợi ý hoa cho dịp nào ạ?',
            suggestions: [],
          },
        }),
  );
  const dialog = await open(page);
  const input = dialog.getByRole('textbox');
  await input.fill('Ai vô địch bóng đá?');
  await dialog.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await expect(dialog.getByText(/Chưa kết nối được với FloraBot/)).toBeVisible();
  await expect(input).toHaveValue('Ai vô địch bóng đá?');
  await dialog.getByRole('button', { name: 'Gửi lại câu hỏi' }).click();
  await expect(dialog.getByText('Bạn muốn FloraBot gợi ý hoa cho dịp nào ạ?')).toBeVisible();
  await expect(dialog.locator('.flower-advisor-suggestion')).toHaveCount(0);
  await expect(dialog.locator('.flower-advisor-exchange')).toHaveCount(1);
});

test('Seller prompts keep the signed-in session including a token refresh', async ({ page }) => {
  let calls = 0;
  let refreshes = 0;
  await page.context().addCookies([
    {
      name: 'advisor-session-test',
      value: 'seller',
      url: test.info().project.use.baseURL as string,
    },
  ]);
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me')
      return route.fulfill({
        json: {
          id: 'seller',
          name: 'Shop',
          role: 'SELLER',
          sellerId: 'shop-id',
          sellerStatus: 'ACTIVE',
          packageExpiresAt: '2099-01-01',
        },
      });
    if (path === '/api/auth/refresh') {
      refreshes++;
      return route.fulfill({ json: {} });
    }
    if (path === '/api/shop/flower-chat') {
      calls++;
      expect(route.request().headers().cookie).toContain('advisor-session-test=seller');
      expect(route.request().postDataJSON()).toEqual({
        question: 'Tôi nên viết mô tả và gắn tag cho bó hoa như thế nào?',
      });
      return calls === 1
        ? route.fulfill({ status: 401, json: {} })
        : route.fulfill({
            json: { intent: 'FLOWERS', message: 'Chọn loại hoa và màu chủ đạo.', suggestions: [] },
          });
    }
    if (/\b(products|kiosks|slots)$/.test(path)) return route.fulfill({ json: [] });
    return route.fulfill({ json: { items: [], hasMore: false } });
  });
  const dialog = await open(page, '/seller/products');
  await expect(
    dialog.getByRole('button', { name: 'Chọn kiosk mua tại tủ', exact: true }),
  ).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Dùng vị trí của tôi' })).toHaveCount(0);
  await dialog.getByRole('button', { name: 'Viết mô tả và gắn tag' }).click();
  await expect(dialog.getByText('Chọn loại hoa và màu chủ đạo.')).toBeVisible();
  expect(calls).toBe(2);
  expect(refreshes).toBe(1);
});

test('Conversation retains only ten turns and limits the question to 500 characters', async ({
  page,
}) => {
  const dialog = await open(page);
  const input = dialog.getByRole('textbox');
  await expect(input).toHaveAttribute('maxlength', '500');
  for (let i = 0; i < 11; i++) {
    await input.fill('Câu hỏi ' + i);
    const response = page.waitForResponse('**/api/shop/flower-chat');
    await dialog.getByRole('button', { name: 'Gửi câu hỏi' }).click();
    await response;
    await expect(dialog.locator('.flower-advisor-pending')).toHaveCount(0);
  }
  await expect(dialog.locator('.flower-advisor-exchange')).toHaveCount(10);
  await expect(dialog.locator('.flower-advisor-question').first()).toHaveText('Bạn: Câu hỏi 1');
});

test('Kiosk picker searches without accents, returns focus and preserves the chat draft', async ({
  page,
}) => {
  await page.setViewportSize({ width: 375, height: 850 });
  await page.route('**/api/kiosks', (route) =>
    route.fulfill({
      json: [
        { id: 'center', code: 'HCM-01', name: 'Tủ Nguyễn Huệ', address: '12 Nguyễn Huệ, Quận 1' },
        { id: 'other', code: 'HCM-02', name: 'Kiosk B', address: 'Trường Chinh' },
      ],
    }),
  );
  const dialog = await open(page);
  const draft = dialog.getByRole('textbox', { name: 'Câu hỏi cho FloraBot' });
  await draft.fill('Tôi muốn mua hoa tại tủ');
  const trigger = dialog.getByRole('button', { name: 'Chọn kiosk mua tại tủ', exact: true });
  await trigger.click();
  const picker = dialog.getByRole('region', { name: 'Chọn kiosk mua tại tủ' });
  const search = picker.getByRole('searchbox', { name: 'Tìm kiosk' });
  await expect(search).toBeFocused();
  await search.fill('nguyen hue');
  await expect(picker.getByRole('button', { name: /Tủ Nguyễn Huệ/ })).toBeVisible();
  await expect(picker.getByRole('button', { name: /Kiosk B/ })).toHaveCount(0);
  await search.fill('khong co');
  await expect(picker.getByText('Không tìm thấy kiosk phù hợp.')).toBeVisible();
  await search.fill('HCM-01');
  await expect(picker.getByRole('button', { name: /Tủ Nguyễn Huệ/ })).toBeVisible();
  expect((await new AxeBuilder({ page }).include('.flower-advisor').analyze()).violations).toEqual(
    [],
  );
  await page.screenshot({
    path: test.info().outputPath('advisor-kiosk-picker.png'),
    animations: 'disabled',
  });
  await picker.getByRole('button', { name: /Tủ Nguyễn Huệ/ }).click();
  await expect(trigger).toBeFocused();
  await expect(trigger).toContainText('Tủ Nguyễn Huệ');
  await expect(draft).toHaveValue('Tôi muốn mua hoa tại tủ');
  await trigger.click();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeVisible();
  await expect(picker).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await trigger.click();
  await picker.getByRole('button', { name: 'Bỏ chọn kiosk' }).click();
  await expect(trigger).toContainText('Chọn kiosk');
  await expect(draft).toHaveValue('Tôi muốn mua hoa tại tủ');
});

for (const width of [375, 1440]) {
  test('Advisor layout and accessibility at ' + width + 'px', async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/shop/flower-chat', (route) =>
      route.fulfill({
        json: {
          intent: 'FLOWERS',
          message: 'Có mẫu hoa phù hợp với bạn.',
          suggestions: [
            {
              ...sample,
              name: 'Bó hoa hồng và cẩm tú cầu dành tặng sinh nhật Nguyễn Thị Phương Thảo',
              price: 1284500000,
            },
          ],
        },
      }),
    );
    const dialog = await open(page);
    const inputHeight = await dialog
      .locator('.flower-advisor-form')
      .evaluate((element) => element.getBoundingClientRect().height);
    expect(inputHeight).toBeLessThanOrEqual(46);
    const phoneLabel = page.locator('.site-support-label--phone');
    await expect(phoneLabel).toHaveText('0355 357 665');
    if (width === 375) await expect(phoneLabel).toBeHidden();
    else await expect(phoneLabel).toBeVisible();
    await page.screenshot({
      path: test.info().outputPath('advisor-open-' + width + '.png'),
      animations: 'disabled',
    });
    await dialog.getByRole('button', { name: 'Gợi ý hoa đặt trước', exact: true }).click();
    await expect(dialog.getByRole('link', { name: /Xem mẫu đặt trước:/ })).toBeVisible();
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).include('.flower-advisor').analyze()).violations,
    ).toEqual([]);
    await page.screenshot({
      path: test.info().outputPath('advisor-' + width + '.png'),
      animations: 'disabled',
    });
    if (width === 1440) {
      await dialog.getByRole('textbox').fill('Tôi muốn chọn hoa');
      const send = dialog.getByRole('button', { name: 'Gửi câu hỏi' });
      await send.hover();
      const colors = await send.evaluate((element) => {
        const style = getComputedStyle(element);
        return { color: style.color, background: style.backgroundColor };
      });
      expect(colors.color).toBe('rgb(255, 255, 255)');
      expect(colors.background).not.toBe('rgb(243, 247, 240)');
    }
    if (width === 375) {
      await page.setViewportSize({ width, height: 430 });
      const input = dialog.getByRole('textbox');
      await input.fill('Tôi muốn chọn hoa');
      await input.focus();
      const inputBox = await input.boundingBox();
      const sendBox = await dialog.getByRole('button', { name: 'Gửi câu hỏi' }).boundingBox();
      expect(inputBox!.y).toBeGreaterThanOrEqual(0);
      expect(sendBox!.y + sendBox!.height).toBeLessThanOrEqual(430);
      await page.screenshot({ path: test.info().outputPath('advisor-short-viewport.png') });
    }
  });
}

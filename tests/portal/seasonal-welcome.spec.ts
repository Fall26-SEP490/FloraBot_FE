import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1440]) {
  test(`Seasonal greeting appears once and supports keyboard at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 960 });
    await page.clock.setFixedTime(new Date('2026-11-22T08:00:00Z'));
    await page.route('**/hub/**', (route) => route.abort());
    await page.route('**/api/**', (route) => {
      if (new URL(route.request().url()).pathname === '/api/auth/me')
        return route.fulfill({
          json: { id: 'customer-welcome', role: 'CUSTOMER', name: 'Khách hàng' },
        });
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    });
    await page.goto('/');
    const welcome = page.getByRole('dialog', {
      name: 'Giáng sinh này, gửi hoa thay lời yêu thương.',
    });
    await expect(welcome).toBeVisible();
    await expect(welcome).toContainText('24–25.12');
    const closeSize = await welcome
      .getByRole('button', { name: 'Đóng hộp thoại' })
      .evaluate((element: HTMLElement) => ({
        width: element.offsetWidth,
        height: element.offsetHeight,
      }));
    expect(closeSize).toEqual({ width: 44, height: 44 });
    await expect(welcome.getByRole('link', { name: 'Khám phá hoa' })).toBeFocused();
    await expect(welcome.locator('img')).toBeVisible();
    await expect
      .poll(() => welcome.locator('img').evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
    await expect
      .poll(
        () =>
          welcome
            .locator('i')
            .last()
            .evaluate((element) => {
              const anim = element.getAnimations()[0];
              return {
                playState: anim?.playState,
                iterations: anim?.effect?.getComputedTiming().iterations,
              };
            }),
        { timeout: 8000 },
      )
      .toEqual({ playState: 'running', iterations: Infinity });
    expect(
      (await new AxeBuilder({ page }).include('[role="dialog"]').analyze()).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await welcome.getByRole('link', { name: 'Khám phá hoa' }).click();
    await expect(welcome).toHaveCount(0);
    await expect(page).toHaveURL(/#mau-hoa$/);
    await page.reload();
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(welcome).toHaveCount(0);
    expect(await page.evaluate(() => localStorage.getItem('florabot:welcome:christmas-2026'))).toBe(
      'seen',
    );
  });
}

test('Seasonal greeting skips internal roles and expired campaigns', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-22T08:00:00Z'));
  let role = 'SELLER';
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) =>
    route.fulfill({
      json:
        new URL(route.request().url()).pathname === '/api/auth/me'
          ? { id: 'welcome-role', role, name: 'Shop' }
          : { items: [] },
    }),
  );
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.waitForTimeout(900);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem('florabot:welcome:christmas-2026')),
  ).toBeNull();
  role = 'CUSTOMER';
  await page.clock.setFixedTime(new Date('2027-02-01T08:00:00Z'));
  await page.reload();
  await page.waitForTimeout(900);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.clock.setFixedTime(new Date('2027-02-12T08:00:00Z'));
  await page.reload();
  const valentine = page.getByRole('dialog', {
    name: 'Mùa yêu thương, để đóa hoa nói lời chân thành.',
  });
  await expect(valentine).toBeVisible();
  await expect(valentine).toContainText('14.02');
});

test('Guests can dismiss the static greeting with Escape when reduced motion is enabled', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.setFixedTime(new Date('2026-11-22T08:00:00Z'));
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) =>
    new URL(route.request().url()).pathname === '/api/auth/me'
      ? route.fulfill({ status: 401, json: { detail: 'Unauthorized' } })
      : route.fulfill({ json: { items: [] } }),
  );
  await page.goto('/');
  const welcome = page.getByRole('dialog', {
    name: 'Giáng sinh này, gửi hoa thay lời yêu thương.',
  });
  await expect(welcome).toBeVisible();
  await expect(welcome.locator('i').first()).toBeHidden();
  expect(await welcome.evaluate((element) => getComputedStyle(element).animationName)).toBe('none');
  expect(
    await welcome.locator('img').evaluate((element) => getComputedStyle(element).animationName),
  ).toBe('none');
  await page.keyboard.press('Escape');
  await expect(welcome).toHaveCount(0);
  await expect(page.locator('body')).not.toHaveClass(/modal-open/);
});

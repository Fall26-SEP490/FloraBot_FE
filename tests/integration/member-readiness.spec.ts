import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { randomBytes, randomUUID } from 'node:crypto';

test('Member registers, edits profile, sees own orders and cannot enter staff workspaces', async ({
  page,
}) => {
  test.setTimeout(180_000);
  const email = `member-${randomUUID()}@example.invalid`;
  const password = randomBytes(24).toString('base64url');
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/dang-ky');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(page.getByLabel('Họ và tên', { exact: true })).toBeFocused();
  await page.getByLabel('Họ và tên', { exact: true }).fill('Thành viên kiểm thử');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill(password);
  await page.getByRole('checkbox').check();
  const registerPromise = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/auth/register') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  const registerResponse = await registerPromise;
  if (registerResponse.status() === 429) {
    await expect(page.locator('main').getByRole('alert')).toContainText('Bạn thao tác hơi nhanh');
    await page.waitForTimeout(60_000);
    const retryRegister = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/auth/register') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
    expect((await retryRegister).status()).toBeLessThan(400);
  } else {
    expect(registerResponse.status()).toBeLessThan(400);
  }
  await expect(page).toHaveURL(/\/tai-khoan$/);
  await expect(page.getByRole('heading', { name: 'Đơn đặt hoa của bạn' })).toBeVisible();
  await expect(page.getByText(email, { exact: true })).toBeVisible();
  await page.getByLabel('Họ và tên', { exact: true }).fill('Tên đã cập nhật');
  await page.getByRole('button', { name: 'Lưu thông tin' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã cập nhật tên của bạn.' }),
  ).toBeVisible();
  for (const path of ['/admin', '/seller']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/tai-khoan$/);
  }
  expect((await page.request.get('/api/admin/preorders')).status()).toBe(403);
  await expect(page.getByRole('heading', { name: 'Góc nhỏ của Tên đã cập nhật' })).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
    .analyze();
  expect(accessibility.violations).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('link', { name: 'Sản phẩm hoa', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Chọn hoa cho một dịp thật riêng.' }),
  ).toBeVisible();
  expect((await page.request.get('/api/shop/catalog')).status()).toBe(200);
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL(/\/dang-nhap$/);
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/auth/login') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const loginResult = await loginResponse;
  if (loginResult.status() === 429) {
    // The shared real server keeps its production limit across test cases.
    await expect(page.locator('main').getByRole('alert')).toContainText('Bạn thao tác hơi nhanh');
    await page.waitForTimeout(60_000);
    const retryLogin = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/auth/login') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    expect((await retryLogin).status()).toBe(200);
  } else {
    expect(loginResult.status()).toBe(200);
  }
  await expect(page).toHaveURL(/\/tai-khoan$/);
  expect(errors).toEqual([]);
});

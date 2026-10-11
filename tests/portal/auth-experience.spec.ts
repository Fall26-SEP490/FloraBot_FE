import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const screens = [
  ['/dang-nhap', 'Đăng nhập'],
  ['/dang-ky', 'Tạo tài khoản FloraBot'],
  ['/quen-mat-khau', 'Quên mật khẩu?'],
  ['/dat-lai-mat-khau#token=test-reset-token', 'Tạo mật khẩu mới'],
  ['/admin/login', 'Đăng nhập vận hành'],
] as const;

for (const width of [390, 1440]) {
  for (const [path, title] of screens) {
    test(`Authentication form accessibility ${path} at ${width}`, async ({ page }) => {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
      await expect(page.locator('.auth-form')).toBeVisible();
      if (path === '/dang-nhap') {
        await page.screenshot({ path: `artifacts/auth-final-login-${width}.png`, fullPage: true });
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      if (width === 390) {
        await expect(page.locator('.auth-garden')).toBeHidden();
        const firstInput = await page.locator('.auth-form input').first().boundingBox();
        expect(firstInput!.y + firstInput!.height).toBeLessThan(650);
      }
      await page.keyboard.press('Tab');
      await expect(page.getByRole('link', { name: 'Bỏ qua tới nội dung' })).toBeFocused();
      await page.keyboard.press('Enter');
      await page.locator('.auth-submit').click();
      await expect(page.locator('.auth-form input').first()).toBeFocused();
      await expect(page.locator('.auth-form input').first()).toHaveAttribute(
        'aria-invalid',
        'true',
      );
      expect(
        (
          await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: `artifacts/auth-review-${path.split('#')[0].replaceAll('/', '-')}-${width}.png`,
        fullPage: true,
      });
    });
  }
}

test('Registration explains password rules and preserves data after validation errors', async ({
  page,
}) => {
  await page.goto('/dang-ky');
  await page.getByLabel('Họ và tên', { exact: true }).fill('Khách yêu hoa');
  await page.getByLabel('Email', { exact: true }).fill('flower@example.com');
  const password = page.getByLabel('Mật khẩu', { exact: true });
  await expect(password).toHaveAttribute('aria-describedby', /member-password-hint/);
  await password.fill('short');
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('different');
  await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();
  await expect(password).toBeFocused();
  await expect(page.getByText('Hai mật khẩu chưa khớp.', { exact: true })).toBeVisible();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('flower@example.com');
  await page.getByRole('button', { name: 'Hiện mật khẩu', exact: true }).focus();
  await page.keyboard.press('Space');
  await expect(password).toHaveAttribute('type', 'text');
  await expect(page.getByLabel('Nhập lại mật khẩu', { exact: true })).toHaveAttribute(
    'type',
    'text',
  );
  await page.getByRole('button', { name: 'Ẩn mật khẩu', exact: true }).click();
  await expect(password).toHaveAttribute('type', 'password');
});

test('Forgot password confirms privately and lets the visitor correct the email', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/auth/forgot-password', async (route) => {
    calls++;
    expect(route.request().postDataJSON()).toEqual({ email: 'flower@example.com' });
    await route.fulfill({ status: 204 });
  });
  await page.goto('/quen-mat-khau');
  await page.getByLabel('Email', { exact: true }).fill('flower@example.com');
  await page.getByRole('button', { name: 'Gửi liên kết khôi phục' }).click();
  await expect(page.getByRole('status')).toContainText('Nếu email thuộc tài khoản thành viên');
  await expect(page.locator('.auth-feedback-focus')).toBeFocused();
  await expect(page.getByLabel('Email', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Nhập lại email' }).click();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('flower@example.com');
  expect(calls).toBe(1);
});

test('Reset rejects missing token and provides recovery for expired links', async ({ page }) => {
  await page.goto('/dat-lai-mat-khau');
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Liên kết chưa đầy đủ');
  await expect(page.getByRole('button', { name: 'Lưu mật khẩu mới' })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Yêu cầu liên kết mới' })).toHaveAttribute(
    'href',
    '/quen-mat-khau',
  );
  await page.route('**/api/auth/reset-password', (route) =>
    route.fulfill({ status: 400, json: { detail: 'Liên kết đã hết hạn. Yêu cầu liên kết mới.' } }),
  );
  await page.goto('/dat-lai-mat-khau#token=expired-token');
  await expect(page).toHaveURL(/\/dat-lai-mat-khau$/);
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('NewPassword-123');
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('NewPassword-123');
  await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Liên kết đã hết hạn');
  await expect(page.getByRole('link', { name: 'Yêu cầu liên kết mới' })).toBeVisible();
});

test('Reset success removes password fields and returns to login', async ({ page }) => {
  await page.route('**/api/auth/reset-password', async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      token: 'one-use-token',
      newPassword: 'NewPassword-123',
    });
    await route.fulfill({ status: 204 });
  });
  await page.goto('/dat-lai-mat-khau#token=one-use-token');
  await page.getByLabel('Mật khẩu mới', { exact: true }).fill('NewPassword-123');
  await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('NewPassword-123');
  await page.getByRole('button', { name: 'Lưu mật khẩu mới' }).click();
  await expect(page.getByRole('status')).toContainText('Đã đổi mật khẩu');
  await expect(page.locator('input[type=password]')).toHaveCount(0);
  await page.getByRole('link', { name: 'Quay lại đăng nhập', exact: true }).click();
  await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
});

test('Login rate limit preserves input and exposes a focused recoverable error', async ({
  page,
}) => {
  let calls = 0;
  await page.route('**/api/auth/login', (route) => {
    calls++;
    return route.fulfill({ status: 429 });
  });
  await page.goto('/dang-nhap');
  await page.getByLabel('Email', { exact: true }).fill('flower@example.com');
  await page.getByLabel('Mật khẩu', { exact: true }).fill('WrongPassword-123');
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Hãy thử lại sau một phút');
  await expect(page.locator('.auth-feedback-focus')).toBeFocused();
  await expect(page.getByLabel('Email', { exact: true })).toHaveValue('flower@example.com');
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveValue('WrongPassword-123');
  expect(calls).toBe(1);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations,
  ).toEqual([]);
});

test('Authentication reflows at 320px and enlarged text', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/dang-ky');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tạo tài khoản FloraBot');
  await page.addStyleTag({ content: ':root { font-size: 36px !important; }' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await expect(page.getByRole('button', { name: 'Tạo tài khoản', exact: true })).toBeVisible();
});

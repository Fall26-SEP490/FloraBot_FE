import { expect, test } from '@playwright/test';

test('Next routes redirect the login alias and return a real 404 for unknown pages', async ({
  request,
  page,
}) => {
  const alias = await request.get('/login', { maxRedirects: 0 });
  expect(alias.status()).toBe(307);
  expect(alias.headers().location).toBe('/dang-nhap');
  expect((await request.get('/unknown-florabot-page')).status()).toBe(404);
  expect((await request.get('/admin/unknown-section')).status()).toBe(404);
  expect((await request.get('/seller/unknown-section')).status()).toBe(404);
  await page.goto('/admin/login');
  await expect(page.getByRole('heading', { name: 'Đăng nhập vận hành' })).toBeVisible();
  await page.getByRole('link', { name: 'Đăng nhập tài khoản', exact: true }).click();
  await expect(page).toHaveURL('/dang-nhap');
  await page.goBack();
  await expect(page).toHaveURL('/admin/login');
  await expect(page.getByRole('heading', { name: 'Đăng nhập vận hành' })).toBeVisible();
});

test('Guest history is public and starts empty on a new browser', async ({ page }) => {
  const response = await page.goto('/lich-su-mua');
  expect(response?.status()).toBe(200);
  await expect(page.getByRole('heading', { name: 'Biên nhận đã lưu', exact: true })).toBeVisible();
  await expect(page.getByText(/Chưa có biên nhận đã lưu/)).toBeVisible();
  await page.getByRole('link', { name: 'Tra cứu bằng mã biên nhận' }).click();
  await expect(page).toHaveURL('/receipt');
});

test('Customer information pages are served by Caddy', async ({ page }) => {
  for (const [path, title] of [
    ['/ve-florabot', 'Hoa cho những điều bạn muốn nói.'],
    ['/huong-dan-dat-hoa', 'Từ một ý tưởng nhỏ đến bó hoa trên tay.'],
    ['/lien-he', 'Bạn cần hỗ trợ điều gì?'],
  ]) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.locator('nav a[aria-current="page"]')).toHaveCount(1);
  }
});

test('Landing leads to real customer pages and protects the account area', async ({
  page,
  request,
}) => {
  await page.goto('/');
  await page
    .getByRole('navigation', { name: 'Điều hướng chính' })
    .getByRole('link', { name: 'Sản phẩm hoa', exact: true })
    .click();
  await expect(page).toHaveURL('/dat-hoa');
  await expect(
    page.getByRole('heading', { name: 'Chọn hoa cho một dịp thật riêng.' }),
  ).toBeVisible();
  expect((await request.get('/api/shop/catalog')).status()).toBe(200);
  await page.goto('/dang-ky');
  await expect(page.getByRole('button', { name: 'Tạo tài khoản', exact: true })).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'chính sách riêng tư (mở tab mới)' }),
  ).toHaveAttribute('href', '/chinh-sach-rieng-tu');
  await page.goto('/tai-khoan');
  await expect(page).toHaveURL('/dang-nhap');
  await page.getByRole('link', { name: 'Quên mật khẩu?' }).click();
  await expect(page).toHaveURL('/quen-mat-khau');
  await expect(page.getByRole('button', { name: 'Gửi liên kết khôi phục' })).toBeVisible();
  await page.goto('/dat-lai-mat-khau');
  await expect(page.getByRole('button', { name: 'Lưu mật khẩu mới' })).toBeDisabled();
});

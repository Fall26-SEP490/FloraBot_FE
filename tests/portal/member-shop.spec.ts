import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Opening a shop validates, preserves input after failure and keeps member access', async ({
  page,
}) => {
  let owner = false;
  let attempts = 0;
  const session = () => ({
    id: '10000000-0000-0000-0000-000000000010',
    name: 'Lan',
    role: owner ? 'SELLER' : 'CUSTOMER',
    sellerId: owner ? '20000000-0000-0000-0000-000000000001' : null,
    sellerStatus: owner ? 'PENDING' : null,
    packageExpiresAt: null,
  });
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ json: session() });
    if (path === '/api/member/profile')
      return route.fulfill({
        json: { id: session().id, fullName: 'Lan', email: 'lan@example.com', loyaltyPoints: 12000 },
      });
    if (path === '/api/member/history' || path.endsWith('/preorders'))
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    if (path === '/api/member/shop') {
      attempts++;
      expect(route.request().postDataJSON()).toEqual({
        shopName: 'Hoa của Lan',
        phone: '0901234567',
        address: 'Thủ Đức',
      });
      if (attempts === 1)
        return route.fulfill({
          status: 503,
          json: { detail: 'Tạm thời chưa xử lý được. Hãy thử lại.' },
        });
      owner = true;
      return route.fulfill({ json: session() });
    }
    return route.fulfill({ json: [] });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/tai-khoan#member-shop');
  await page.getByRole('button', { name: 'Đăng ký mở shop', exact: true }).click();
  await expect(page.getByLabel('Tên shop', { exact: true })).toBeFocused();
  expect(attempts).toBe(0);
  await page.getByLabel('Tên shop', { exact: true }).fill('Hoa của Lan');
  await page.getByLabel('Số điện thoại shop').fill('0901234567');
  await page.getByLabel('Địa chỉ shop').fill('Thủ Đức');
  expect(
    (
      await new AxeBuilder({ page })
        .include('#member-shop')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Đăng ký mở shop', exact: true }).click();
  await expect(page.getByText('Tạm thời chưa xử lý được. Hãy thử lại.')).toBeVisible();
  await expect(page.getByLabel('Tên shop', { exact: true })).toHaveValue('Hoa của Lan');
  await page.getByRole('button', { name: 'Đăng ký mở shop', exact: true }).click();
  await expect(page).toHaveURL(/\/seller$/);
  await page.goto('/tai-khoan#member-shop');
  await expect(page.getByRole('link', { name: 'Vào shop của bạn' })).toBeVisible();
  await expect(page.getByText('12.000 điểm')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Đăng ký mở shop', exact: true })).toHaveCount(0);
});

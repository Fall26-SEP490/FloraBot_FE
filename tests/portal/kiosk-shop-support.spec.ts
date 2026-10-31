import { expect, test } from '@playwright/test';

const kiosk = '40000000-0000-0000-0000-000000000001';
const seller = '20000000-0000-0000-0000-000000000001';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/kiosk-support/*', (route) =>
    route.fulfill({
      json: {
        id: kiosk,
        code: 'K-Q1-01',
        name: 'Tủ Quận 1',
        address: 'Địa điểm kiểm thử',
        status: 'ONLINE',
        sellerId: seller,
        shopName: 'Tiệm Hoa Nhỏ',
      },
    }),
  );
});

test('Shop support QR requires customer login and preserves its return URL', async ({ page }) => {
  const writes: string[] = [];
  await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: {} }));
  await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 401, json: {} }));
  page.on('request', (request) => {
    if (request.method() === 'POST' && !request.url().includes('/auth/refresh'))
      writes.push(request.url());
  });
  await page.goto(`/ho-tro-cua-hang?kiosk=${kiosk}`);
  await expect(page.getByRole('heading', { name: 'Tiệm Hoa Nhỏ', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Đăng nhập để liên hệ shop' })).toHaveAttribute(
    'href',
    `/dang-nhap?returnUrl=${encodeURIComponent(`/ho-tro-cua-hang?kiosk=${kiosk}`)}`,
  );
  expect(writes).toEqual([]);
});

test('Authenticated customer opens the selected kiosk shop chat only on click', async ({
  page,
}) => {
  let opens = 0;
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { id: 'customer', name: 'Khách yêu hoa', role: 'CUSTOMER' } }),
  );
  await page.route('**/api/member/chats*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
  await page.route('**/api/member/chats/open', (route) => {
    opens++;
    expect(route.request().postDataJSON()).toEqual({ sellerId: seller });
    return route.fulfill({ status: 503, json: { detail: 'Chat unavailable' } });
  });
  await page.goto(`/ho-tro-cua-hang?kiosk=${kiosk}`);
  const button = page.getByRole('button', { name: 'Nhắn tin với cửa hàng' });
  await expect(button).toBeVisible();
  expect(opens).toBe(0);
  await button.click();
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Chưa mở được hội thoại');
  expect(opens).toBe(1);
});

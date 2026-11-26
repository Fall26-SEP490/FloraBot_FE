import { expect, test } from '@playwright/test';
import { chooseVietnamDate } from '../fixtures/vietnam-date';
import { chooseSelect } from '../fixtures/select';

test.use({ timezoneId: 'America/New_York' });

test('shared feedback applies on public pages and body portals without a seller workspace', async ({
  page,
}) => {
  await page.route('**/api/**', (route) => route.fulfill({ status: 401, json: {} }));
  await page.goto('/chinh-sach-rieng-tu');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.id = 'public-form-check';
    form.innerHTML =
      '<label>Email<input type="email" required /></label><button>Kiểm tra chung</button>';
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      form.dataset.submitted = 'yes';
    });
    document.body.append(form);
  });
  const form = page.locator('#public-form-check');
  await expect(form).not.toHaveAttribute('novalidate');
  await form.getByRole('button').click();
  await expect(form.locator('.form-field-error')).toHaveText(
    'Vui lòng nhập hoặc chọn thông tin này.',
  );
  await expect(form.locator('.form-field-error')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
  await form.getByLabel('Email', { exact: true }).fill('invalid');
  await form.getByRole('button').click();
  await expect(form.locator('.form-field-error')).toHaveText('Nhập địa chỉ email hợp lệ.');
  await expect(form).not.toHaveAttribute('data-submitted');
  await form.getByLabel('Email', { exact: true }).fill('test@example.com');
  await form.getByRole('button').click();
  await expect(form).toHaveAttribute('data-submitted', 'yes');
});

for (const width of [390, 1440]) {
  test(`customer uses shared date and 24-hour pickers with UTC+7 payload at ${width}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(60_000);
    await page.setViewportSize({ width, height: 1000 });
    const productId = '30000000-0000-0000-0000-000000000001';
    const kioskId = '40000000-0000-0000-0000-000000000001';
    const writes: Record<string, unknown>[] = [];
    const availability: string[] = [];
    const flower = {
      productId,
      kioskId,
      sellerId: '20000000-0000-0000-0000-000000000001',
      name: 'Hoa kiểm thử',
      shopName: 'Shop kiểm thử',
      kioskName: 'Kiosk kiểm thử',
      address: 'Hà Nội',
      price: 250000,
      photo: null,
      bouquets: [],
      zone: 'PREORDER',
    };
    await page.route('**/hub/**', (route) => route.abort());
    await page.route('**/api/**', (route) => {
      const request = route.request();
      const url = new URL(request.url());
      if (request.method() !== 'GET') {
        if (url.pathname === '/api/member/preorders') {
          writes.push(request.postDataJSON());
          return route.fulfill({ status: 201, json: {} });
        }
        return route.fulfill({ status: 405, json: {} });
      }
      if (url.pathname === '/api/auth/me')
        return route.fulfill({
          json: { id: 'customer', name: 'Khách kiểm thử', role: 'CUSTOMER' },
        });
      if (url.pathname === '/api/shop/catalog')
        return route.fulfill({ json: { items: [flower], page: 1, hasMore: false } });
      if (url.pathname.endsWith('/preorder-availability')) {
        availability.push(url.searchParams.get('pickupAt') || '');
        return route.fulfill({ json: { available: true } });
      }
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    });
    await page.goto(`/dat-hoa/${productId}/${kioskId}`);
    await page.getByRole('button', { name: 'Đặt trước', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Yêu cầu đặt trước', exact: true });
    await chooseSelect(dialog, 'Tủ nhận hoa', kioskId);
    const day = new Date(Date.now() + 2 * 86400000 + 7 * 3600000).toISOString().slice(0, 10);
    await chooseVietnamDate(dialog, 'Ngày nhận hoa', day);
    await dialog.getByRole('combobox', { name: 'Giờ nhận hoa', exact: true }).click();
    const hours = page.getByRole('listbox');
    await expect(hours.getByRole('option')).toHaveCount(48);
    await expect(hours.getByRole('option', { name: '23:45', exact: true })).toHaveCount(0);
    await expect(page.locator('[data-vietnam-calendar]')).toHaveCount(0);
    await hours.getByRole('option', { name: '23:30', exact: true }).click();
    await expect(hours).toHaveCount(0);
    await expect(dialog.getByRole('combobox', { name: 'Giờ nhận hoa', exact: true })).toContainText(
      '23:30',
    );
    const expected = new Date(`${day}T23:30:00+07:00`).toISOString();
    await expect.poll(() => availability).toContain(expected);
    await dialog
      .getByLabel('Bạn muốn bó hoa như thế nào?', { exact: true })
      .fill('Hoa hồng tông pastel theo mẫu');
    await page.screenshot({ path: testInfo.outputPath(`customer-date-${width}.png`) });
    await dialog.getByRole('button', { name: 'Gửi yêu cầu đặt trước', exact: true }).click();
    await expect(
      dialog.getByRole('heading', { name: 'Đã nhận yêu cầu của bạn', exact: true }),
    ).toBeVisible();
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ pickupAt: expected, productId, kioskId });
  });
}

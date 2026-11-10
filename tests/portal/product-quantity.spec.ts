import { expect, test, type Page } from '@playwright/test';

const sellerId = '20000000-0000-0000-0000-000000000001';
const kioskId = '40000000-0000-0000-0000-000000000001';
const productId = '30000000-0000-0000-0000-000000000001';
const slotId = '40000000-0000-0000-0001-000000000001';

async function fixture(page: Page) {
  const state = { quantity: 5, writes: [] as Record<string, unknown>[], stockAttempts: 0 };
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/auth/me')
      return route.fulfill({
        json: {
          id: 'quantity-seller',
          name: 'Shop test',
          role: 'SELLER',
          sellerId,
          sellerStatus: 'ACTIVE',
          packageExpiresAt: '2099-01-01',
        },
      });
    if (path.endsWith('/kiosks'))
      return route.fulfill({ json: [{ id: kioskId, name: 'Tủ test', code: 'K01' }] });
    if (path.endsWith('/slots'))
      return route.fulfill({
        json: [
          {
            id: slotId,
            kioskId,
            slotCode: 'A01',
            status: 'RENTED_EMPTY',
            zone: 'WALK_IN',
            bouquetId: null,
            kioskName: 'Tủ test',
          },
        ],
      });
    if (path === '/api/me/flows/stock_bouquet') {
      state.stockAttempts++;
      state.quantity = 0;
      return route.fulfill({ status: 409, json: { detail: 'Không đủ tồn tại shop.' } });
    }
    if (path === '/api/me/products' && req.method() === 'GET')
      return route.fulfill({
        json: [
          {
            id: productId,
            name: 'Hoa test',
            description: 'Mẫu hoa test',
            price: 350000,
            tags: [],
            status: 'ACTIVE',
            inventoryKind: 'ARTIFICIAL',
            lengthCm: 30,
            widthCm: 20,
            heightCm: 40,
            quantity: state.quantity,
          },
        ],
      });
    if (path === '/api/me/products' || path === `/api/sellers/${sellerId}/products/${productId}`) {
      const body = req.postDataJSON();
      state.writes.push(body);
      if (body.quantity !== undefined) state.quantity = body.quantity;
      return route.fulfill({
        status: req.method() === 'POST' ? 201 : 200,
        json: { id: productId },
      });
    }
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  return state;
}

test('Creating a product validates shop quantity and sends the absolute count', async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto('/seller/products');
  await page.getByRole('button', { name: 'Thêm mẫu hoa', exact: true }).click();
  const form = page.getByRole('form', { name: 'Thêm mẫu hoa giả mới' });
  await form.getByLabel('Tên mẫu hoa', { exact: true }).fill('Hoa mới');
  await form.getByLabel('Giá bán niêm yết (VNĐ)', { exact: true }).fill('350000');
  await form.getByLabel('Dài (cm)', { exact: true }).fill('30');
  await form.getByLabel('Rộng (cm)', { exact: true }).fill('20');
  await form.getByLabel('Cao (cm)', { exact: true }).fill('40');
  const count = form.getByLabel('Tồn bó tại shop', { exact: true });
  await expect(count).toHaveValue('0');
  for (const value of ['-1', '1.5', '2147483648']) {
    await count.fill(value);
    await form.locator('button[type="submit"]').click();
    await expect(count).toHaveAttribute('aria-invalid', 'true');
    expect(state.writes).toHaveLength(0);
  }
  await count.fill('8');
  await form.locator('button[type="submit"]').click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0].quantity).toBe(8);
});

test('Metadata edits preserve concurrent stock deductions and explicit zero resets stock', async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto('/seller/products');
  await page.locator('.product-order-summary').click();
  await page.getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true }).click();
  let form = page.getByRole('form', { name: 'Chỉnh sửa thông tin Hoa test' });
  await expect(form.getByLabel('Tồn bó tại shop', { exact: true })).toHaveValue('5');
  state.quantity = 4;
  await form.getByRole('button', { name: 'Lưu chi tiết mẫu hoa', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(1);
  expect(state.writes[0]).not.toHaveProperty('quantity');
  expect(state.quantity).toBe(4);
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Chỉnh sửa thông tin', exact: true }).click();
  form = page.getByRole('form', { name: 'Chỉnh sửa thông tin Hoa test' });
  await expect(form.getByLabel('Tồn bó tại shop', { exact: true })).toHaveValue('4');
  await form.getByLabel('Tồn bó tại shop', { exact: true }).fill('0');
  await form.getByRole('button', { name: 'Lưu chi tiết mẫu hoa', exact: true }).click();
  await expect.poll(() => state.writes.length).toBe(2);
  expect(state.writes[1].quantity).toBe(0);
  expect(state.writes[1]).not.toHaveProperty('kioskId');
});

test('Stock conflict reloads quantity and prevents another attempt with depleted stock', async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto('/seller/stock');
  await page.locator('#stock-slot').selectOption(slotId);
  await page.locator('#stock-product').selectOption(productId);
  await page.getByRole('button', { name: 'Nạp hoa vào ô', exact: true }).click();
  await expect(page.locator('#stock-fill [role="alert"]')).toContainText('Không đủ tồn tại shop.');
  await expect(page.locator(`#stock-product option[value="${productId}"]`)).toContainText('0 bó');
  await expect(page.getByRole('button', { name: 'Nạp hoa vào ô', exact: true })).toBeDisabled();
  expect(state.stockAttempts).toBe(1);
});

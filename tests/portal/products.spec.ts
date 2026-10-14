import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/**/wallet', (route) =>
    route.fulfill({
      json: {
        balance: null,
        entries: [],
        bankConfigured: false,
        minimumWithdrawal: 50000,
        withdrawals: [],
        hasMoreEntries: false,
        hasMoreWithdrawals: false,
      },
    }),
  );
  await page.route('**/api/**/slots', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/**/subscriptions', (route) =>
    route.fulfill({ json: { package: null, subscriptions: [] } }),
  );
});

const sellerId = '20000000-0000-0000-0000-000000000001';
const product = {
  id: '30000000-0000-0000-0000-000000000001',
  name: 'Hoa hồng dịu dàng',
  description: 'Bó hoa dành cho người thương.',
  price: 350000,
  tags: ['quà tặng', 'hoa hồng'],
  status: 'ACTIVE',
  shelfLifeHours: 48,
  inventoryKind: 'LEGACY_FRESH',
  lengthCm: 25,
  widthCm: 15,
  heightCm: 40,
};

test('Product search, validation, price and status commands, accessible editor', async ({
  page,
}) => {
  let price = 350000;
  let status = 'ACTIVE';
  await page.setViewportSize({ width: 390, height: 950 });
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'user',
        name: 'Shop',
        role: 'SELLER',
        sellerId,
        sellerStatus: 'ACTIVE',
        packageExpiresAt: '2099-01-01',
      },
    }),
  );
  await page.route('**/api/**/products', (route) =>
    route.fulfill({ json: [{ ...product, price, status }] }),
  );
  await page.route('**/flows/update_product_price', (route) => {
    expect(route.request().postDataJSON()).toEqual({ p_product: product.id, p_price: 420000 });
    price = 420000;
    return route.fulfill({ json: { result: null } });
  });
  await page.route('**/flows/set_product_status', (route) => {
    expect(route.request().postDataJSON()).toEqual({ p_product: product.id, p_status: 'INACTIVE' });
    status = 'INACTIVE';
    return route.fulfill({ json: { result: null } });
  });
  await page.goto('/seller/products');
  await page.getByLabel('Tìm tên sản phẩm').fill('không tìm thấy');
  await expect(page.getByText('Không có sản phẩm phù hợp.', { exact: false })).toBeVisible();
  await page.getByLabel('Tìm tên sản phẩm').clear();
  await page.locator('.product-list summary').click();
  await page.getByLabel('Giá bán (đồng)', { exact: true }).fill('0');
  await page.getByRole('button', { name: 'Lưu giá', exact: true }).click();
  await expect(page.getByText('Giá bán phải lớn hơn 0.')).toBeVisible();
  await page.getByLabel('Giá bán (đồng)', { exact: true }).fill('420000');
  await page.getByRole('button', { name: 'Lưu giá', exact: true }).click();
  await expect(page.getByText('Đã lưu giá bán.')).toBeVisible();
  await expect(page.locator('.product-price')).toContainText('420.000');
  await page.getByLabel('Trạng thái sản phẩm', { exact: true }).selectOption('INACTIVE');
  await page.getByRole('button', { name: 'Lưu trạng thái' }).click();
  await expect(page.locator('.product-status')).toHaveText('Ngừng bán');
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: '.impeccable/review/portal-products-390.png', fullPage: true });
});

test('Expired shop can read products but creation and editor are disabled', async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'user',
        name: 'Shop',
        role: 'SELLER',
        sellerId,
        sellerStatus: 'PAST_DUE',
        packageExpiresAt: '2026-01-01',
      },
    }),
  );
  await page.route('**/api/**/products', (route) => route.fulfill({ json: [product] }));
  await page.goto('/seller/products');
  await expect(page.getByRole('button', { name: 'Thêm bó hoa giả mới' })).toBeDisabled();
  await page.locator('.product-list summary').click();
  await expect(page.getByLabel('Giá bán (đồng)', { exact: true })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Lưu trạng thái' })).toBeDisabled();
});

test('Create artificial flower: validation, duplicate tags rejection, 409 duplicate ID, 201 creation', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 950 });
  const productsList = [{ ...product }];
  let createAttemptCount = 0;
  let lastCapturedPayload: Record<string, unknown> | null = null;

  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'user',
        name: 'Shop',
        role: 'SELLER',
        sellerId,
        sellerStatus: 'ACTIVE',
        packageExpiresAt: '2099-01-01',
      },
    }),
  );
  await page.route('**/api/sellers/*/products', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: productsList });
    }
    if (route.request().method() === 'POST') {
      createAttemptCount++;
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      lastCapturedPayload = payload;
      // First attempt triggers 409 conflict to verify error handling and client ID retention
      if (createAttemptCount === 1) {
        return route.fulfill({
          status: 409,
          json: { detail: 'Mã sản phẩm đã tồn tại trong hệ thống.' },
        });
      }
      const newProduct = {
        id: payload.id as string,
        name: payload.name as string,
        description: payload.description as string,
        price: payload.price as number,
        tags: payload.tags as string[],
        status: 'DRAFT',
        inventoryKind: 'ARTIFICIAL',
        lengthCm: payload.lengthCm as number,
        widthCm: payload.widthCm as number,
        heightCm: payload.heightCm as number,
      };
      productsList.push(newProduct);
      return route.fulfill({ status: 201, json: { id: payload.id } });
    }
    return route.continue();
  });

  await page.goto('/seller/products');

  // Open create form
  await page.getByRole('button', { name: 'Thêm bó hoa giả mới' }).click();
  const createForm = page.getByRole('form', { name: 'Thêm mẫu hoa giả mới' });
  await expect(createForm).toBeVisible();

  // Test client-side validations
  await createForm.getByRole('button', { name: 'Tạo mẫu hoa' }).click();
  await expect(createForm.getByText('Nhập tên mẫu hoa (tối thiểu 1 ký tự).')).toBeVisible();

  // Fill name, invalid price 0
  await createForm.getByLabel('Tên mẫu hoa').fill('Bó cẩm tú cầu giả');
  await createForm.getByLabel('Giá bán (đồng)', { exact: true }).fill('0');
  await createForm.getByRole('button', { name: 'Tạo mẫu hoa' }).click();
  await expect(createForm.getByText('Giá bán phải lớn hơn 0.')).toBeVisible();

  // Fix price, test invalid dimensions (0 and >2 decimal places)
  await createForm.getByLabel('Giá bán (đồng)', { exact: true }).fill('280000');
  await createForm.getByLabel('Dài (cm)').fill('0');
  await createForm.getByRole('button', { name: 'Tạo mẫu hoa' }).click();
  await expect(createForm.getByText('Chiều dài phải từ 0.01 cm trở lên.')).toBeVisible();

  await createForm.getByLabel('Dài (cm)').fill('25.123');
  await createForm.getByRole('button', { name: 'Tạo mẫu hoa' }).click();
  await expect(createForm.getByText('Chiều dài tối đa 2 chữ số thập phân.')).toBeVisible();

  // Fix length, test duplicate tags rejection
  await createForm.getByLabel('Dài (cm)').fill('25.5');
  await createForm.getByLabel('Rộng (cm)').fill('15');
  await createForm.getByLabel('Cao (cm)').fill('40');
  await createForm
    .getByLabel('Từ khóa tìm kiếm (phân cách bằng dấu phẩy)')
    .fill('hoa lụa, decor, hoa lụa');
  await createForm.getByRole('button', { name: 'Tạo mẫu hoa' }).click();
  await expect(
    createForm.getByText('Từ khóa trùng lặp: "hoa lụa". Mỗi từ khóa chỉ nhập một lần.'),
  ).toBeVisible();

  // Fix tags and description
  await createForm.getByLabel('Từ khóa tìm kiếm (phân cách bằng dấu phẩy)').fill('hoa lụa, decor');
  await createForm.getByLabel('Mô tả sản phẩm').fill('Hoa cẩm tú cầu chất liệu lụa bền đẹp.');

  // First submit -> 409 conflict from server
  await createForm.getByRole('button', { name: 'Tạo mẫu hoa' }).click();
  await expect(createForm.getByRole('alert')).toHaveText('Mã sản phẩm đã tồn tại trong hệ thống.');
  const initialGeneratedId = lastCapturedPayload?.id;
  expect(initialGeneratedId).toBeTruthy();

  // Second submit -> success 201 with the same client id (stable across retry)
  await createForm.getByRole('button', { name: 'Tạo mẫu hoa' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Đã tạo mẫu hoa giả mới ở trạng thái Bản nháp.' }),
  ).toBeFocused();
  expect(lastCapturedPayload?.id).toBe(initialGeneratedId);
  expect(lastCapturedPayload?.name).toBe('Bó cẩm tú cầu giả');
  expect(lastCapturedPayload?.price).toBe(280000);
  expect(lastCapturedPayload?.tags).toEqual(['hoa lụa', 'decor']);
  expect(lastCapturedPayload?.lengthCm).toBe(25.5);
  expect(lastCapturedPayload?.widthCm).toBe(15);
  expect(lastCapturedPayload?.heightCm).toBe(40);

  // Verify list updated with new item
  await expect(page.getByText('Bó cẩm tú cầu giả', { exact: true })).toBeVisible();
  const newItemSummary = page.locator('.product-list li', { hasText: 'Bó cẩm tú cầu giả' });
  await expect(newItemSummary.locator('.product-kind-badge')).toHaveText('Hoa giả');
  await expect(newItemSummary.locator('.product-status')).toHaveText('Bản nháp');

  // Open details of new artificial product
  await newItemSummary.locator('summary').click();
  await expect(
    newItemSummary.getByText('Bó hoa giả cao cấp — không áp dụng thời hạn tươi.'),
  ).toBeVisible();
  await expect(
    newItemSummary.getByText('Kích thước: 25.5 × 15 × 40 cm (Dài × Rộng × Cao)'),
  ).toBeVisible();

  // A11y and viewport check
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('Edit artificial flower metadata via PUT: payload validation, semantic snapshot notice, conflict handling (409)', async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const artificialProduct = {
    id: '30000000-0000-0000-0000-000000000002',
    name: 'Bó hồng sáp thơm',
    description: 'Hương thơm dễ chịu, giữ lâu.',
    price: 320000,
    tags: ['hồng sáp', 'thơm'],
    status: 'ACTIVE',
    inventoryKind: 'ARTIFICIAL',
    lengthCm: 20,
    widthCm: 15,
    heightCm: 35,
  };

  let putAttemptCount = 0;
  let lastPutPayload: Record<string, unknown> | null = null;

  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'user',
        name: 'Shop',
        role: 'SELLER',
        sellerId,
        sellerStatus: 'ACTIVE',
        packageExpiresAt: '2099-01-01',
      },
    }),
  );
  await page.route('**/api/sellers/*/products', (route) =>
    route.fulfill({ json: [artificialProduct] }),
  );
  await page.route('**/api/sellers/*/products/*', async (route) => {
    if (route.request().method() === 'PUT') {
      putAttemptCount++;
      lastPutPayload = route.request().postDataJSON() as Record<string, unknown>;
      if (putAttemptCount === 1) {
        return route.fulfill({
          status: 409,
          json: {
            detail:
              'Không thể cập nhật: sản phẩm đang có bó hoa trong tủ hoặc xung đột kích thước.',
          },
        });
      }
      return route.fulfill({ status: 200, json: { id: artificialProduct.id } });
    }
    return route.continue();
  });

  await page.goto('/seller/products');
  await page.locator('.product-list summary').click();

  // Open metadata edit details
  await page.getByRole('button', { name: 'Chỉnh sửa thông tin & kích thước' }).click();
  const editForm = page.getByRole('form', { name: 'Chỉnh sửa thông tin Bó hồng sáp thơm' });
  await expect(editForm).toBeVisible();

  // Verify price snapshot notice is visible
  await expect(
    editForm.getByText(
      'Lưu ý: Thay đổi giá áp dụng cho các lần nạp hoa tiếp theo, không thay đổi giá của bó hoa đang bán trong tủ hoặc đơn đặt trước đã tạo.',
    ),
  ).toBeVisible();

  // Edit name and price
  await editForm.getByLabel('Tên mẫu hoa').fill('Bó hồng sáp thơm cao cấp');

  // First submit -> 409 conflict
  await editForm.getByRole('button', { name: 'Lưu chi tiết mẫu hoa' }).click();
  await expect(editForm.getByRole('alert')).toHaveText(
    'Không thể cập nhật: sản phẩm đang có bó hoa trong tủ hoặc xung đột kích thước.',
  );

  // Second submit -> success 200
  await editForm.getByRole('button', { name: 'Lưu chi tiết mẫu hoa' }).click();
  await expect(editForm.getByText('Đã cập nhật chi tiết mẫu hoa thành công.')).toBeVisible();

  // Verify PUT payload does NOT send id, sellerId, or status
  expect(lastPutPayload?.id).toBeUndefined();
  expect(lastPutPayload?.sellerId).toBeUndefined();
  expect(lastPutPayload?.status).toBeUndefined();
  expect(lastPutPayload?.name).toBe('Bó hồng sáp thơm cao cấp');
  expect(lastPutPayload?.price).toBe(320000);
  expect(lastPutPayload?.lengthCm).toBe(20);
  expect(lastPutPayload?.widthCm).toBe(15);
  expect(lastPutPayload?.heightCm).toBe(35);
  expect(lastPutPayload?.tags).toEqual(['hồng sáp', 'thơm']);

  // A11y on desktop 1440
  expect(
    (
      await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze()
    ).violations,
  ).toEqual([]);
});

test('Legacy fresh product displays transitional notice and shelf life hours', async ({ page }) => {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'user',
        name: 'Shop',
        role: 'SELLER',
        sellerId,
        sellerStatus: 'ACTIVE',
        packageExpiresAt: '2099-01-01',
      },
    }),
  );
  await page.route('**/api/**/products', (route) =>
    route.fulfill({
      json: [
        {
          id: '30000000-0000-0000-0000-000000000009',
          name: 'Hoa ly tươi Đà Lạt',
          description: null,
          price: 250000,
          status: 'ACTIVE',
          shelfLifeHours: 72,
          inventoryKind: 'LEGACY_FRESH',
        },
      ],
    }),
  );
  await page.goto('/seller/products');
  await expect(page.locator('.product-kind-badge.legacy')).toHaveText('Dữ liệu cũ chưa chuyển đổi');
  await page.locator('.product-list summary').click();
  await expect(
    page.getByText('Dữ liệu hoa tươi cũ (chuyển tiếp) — Hạn bán theo sản phẩm: 72 giờ.'),
  ).toBeVisible();
});

test('Expired session transparently refreshes token then completes PUT metadata update', async ({
  page,
}) => {
  let refreshCount = 0;
  let putCount = 0;
  let putMethod = '';
  let putPayload: Record<string, unknown> | null = null;

  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'user',
        name: 'Shop',
        role: 'SELLER',
        sellerId,
        sellerStatus: 'ACTIVE',
        packageExpiresAt: '2099-01-01',
      },
    }),
  );
  await page.route('**/api/auth/refresh', (route) => {
    refreshCount++;
    return route.fulfill({ status: 200, json: { result: true } });
  });
  await page.route('**/api/sellers/*/products', (route) =>
    route.fulfill({
      json: [
        {
          id: '30000000-0000-0000-0000-000000000005',
          name: 'Bó hoa sáp thơm ban đầu',
          description: 'Mô tả ban đầu',
          price: 300000,
          tags: ['hoa sáp'],
          status: 'ACTIVE',
          inventoryKind: 'ARTIFICIAL',
          lengthCm: 20,
          widthCm: 15,
          heightCm: 35,
        },
      ],
    }),
  );
  await page.route('**/api/sellers/*/products/*', async (route) => {
    if (route.request().method() === 'PUT') {
      putCount++;
      putMethod = route.request().method();
      putPayload = route.request().postDataJSON() as Record<string, unknown>;
      if (putCount === 1) {
        // First PUT receives 401 (session expired)
        return route.fulfill({ status: 401, json: { detail: 'Phiên làm việc đã hết hạn.' } });
      }
      return route.fulfill({
        status: 200,
        json: { id: '30000000-0000-0000-0000-000000000005' },
      });
    }
    return route.continue();
  });

  await page.goto('/seller/products');
  await page.locator('.product-list summary').click();
  await page.getByRole('button', { name: 'Chỉnh sửa thông tin & kích thước' }).click();

  const editForm = page.getByRole('form', {
    name: 'Chỉnh sửa thông tin Bó hoa sáp thơm ban đầu',
  });
  await editForm.getByLabel('Tên mẫu hoa').fill('Bó hoa sáp thơm sau refresh');
  await editForm.getByRole('button', { name: 'Lưu chi tiết mẫu hoa' }).click();

  await expect(editForm.getByText('Đã cập nhật chi tiết mẫu hoa thành công.')).toBeVisible();
  expect(refreshCount).toBe(1);
  expect(putCount).toBe(2);
  expect(putMethod).toBe('PUT');
  expect(putPayload?.name).toBe('Bó hoa sáp thơm sau refresh');
});

import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Operations Manager assigns INCIDENT and recovers the same request after reload', async ({
  page,
}) => {
  let payload: unknown;
  let writes = 0;
  const requestedUrls: string[] = [];
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    requestedUrls.push(path);
    if (path === '/api/auth/me')
      return route.fulfill({
        json: { id: 'mgr-1', name: 'Nguyễn Quản Lý', role: 'OPERATIONS_MANAGER', sellerId: null },
      });
    if (path === '/api/operations/staff')
      return route.fulfill({ json: [{ id: 'tech-1', name: 'Kỹ thuật viên Thảo' }] });
    if (path === '/api/operations/incidents')
      return route.fulfill({
        json: {
          items: [
            {
              id: 'incident-1',
              kioskId: 'kiosk-1',
              reason: 'Cửa bị kẹt',
              location: { kioskName: 'Tủ FPT' },
            },
          ],
          page: 1,
          hasMore: false,
        },
      });
    if (path === '/api/operations/staff-tasks' && route.request().method() === 'POST') {
      writes++;
      const body = route.request().postDataJSON();
      if (writes === 1) {
        payload = body;
        return route.abort();
      }
      expect(body).toEqual(payload);
      expect(body.kind).toBe('INCIDENT');
      expect(body.kioskId).toBe('kiosk-1');
      expect(body.incidentId).toBe('incident-1');
      expect(body.sellerId).toBeNull();
      return route.fulfill({ json: { id: body.id } });
    }
    if (/staff-tasks|preorders|refunds|withdrawals|complaints/.test(path))
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    return route.fulfill({ json: [] });
  });

  await page.goto('/operations/tasks');
  await page.getByText('Phân công công việc mới', { exact: true }).click();

  // Verify wrong-kind action absent: DELIVERY is not allowed for Operations Manager
  await expect(page.locator('#assignment-kind option[value="DELIVERY"]')).toHaveCount(0);
  await expect(page.getByLabel('Loại công việc')).toHaveValue('INCIDENT');

  await page.getByRole('button', { name: 'Giao công việc', exact: true }).click();
  await expect(page.getByText('Chọn nhân viên phụ trách.', { exact: true })).toBeVisible();
  expect(writes).toBe(0);

  await page.getByLabel('Nhân viên phụ trách').selectOption('tech-1');
  await page.getByLabel('Sự cố cần kiểm tra').selectOption('incident-1');
  await page.getByLabel('Hướng dẫn công việc').fill('Kiểm tra sửa chữa sự cố chốt cửa tại tủ FPT');

  expect(
    (
      await new AxeBuilder({ page })
        .include('#staff-tasks')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);

  await page.getByRole('button', { name: 'Giao công việc', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Kiểm tra lại yêu cầu' })).toBeVisible();
  expect(writes).toBe(1);

  await page.reload();
  await page.getByText('Phân công công việc mới', { exact: true }).click();
  await page.getByRole('button', { name: 'Kiểm tra lại yêu cầu' }).click();
  await expect(
    page.getByText('Đã phân công. Nhân viên sẽ thấy công việc trong tài khoản.'),
  ).toBeVisible();
  expect(writes).toBe(2);

  // Exact API scope verification: manager calls /api/operations/* and no admin/seller routes
  expect(
    requestedUrls
      .filter((p) => p.startsWith('/api/') && !p.startsWith('/api/auth'))
      .every((p) => p.startsWith('/api/operations')),
  ).toBe(true);
});

test('Shop Owner assigns DELIVERY to own seller staff and recovers the same request after reload', async ({
  page,
}) => {
  let payload: unknown;
  let writes = 0;
  const requestedUrls: string[] = [];
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    requestedUrls.push(path);
    if (path === '/api/auth/me')
      return route.fulfill({
        json: { id: 'owner-1', name: 'Chủ Shop Lan', role: 'SELLER', sellerId: 'shop-lan' },
      });
    if (path === '/api/sellers/shop-lan/staff')
      return route.fulfill({ json: [{ id: 'staff-lan-1', name: 'Nhân viên Lan Anh' }] });
    if (path === '/api/sellers/shop-lan/staff-delivery-scopes')
      return route.fulfill({
        json: [
          {
            sellerId: 'shop-lan',
            shopName: 'Tiệm Hoa Lan',
            kioskId: 'kiosk-2',
            kioskName: 'Tủ Landmark',
            address: 'Bình Thạnh',
          },
        ],
      });
    if (path === '/api/sellers/shop-lan/staff-tasks' && route.request().method() === 'POST') {
      writes++;
      const body = route.request().postDataJSON();
      if (writes === 1) {
        payload = body;
        return route.abort();
      }
      expect(body).toEqual(payload);
      expect(body.kind).toBe('DELIVERY');
      expect(body.kioskId).toBe('kiosk-2');
      expect(body.sellerId).toBe('shop-lan');
      expect(body.incidentId).toBeNull();
      return route.fulfill({ json: { id: body.id } });
    }
    if (/staff-tasks|preorders|products|accessories|wallet|subscriptions/.test(path))
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    return route.fulfill({ json: [] });
  });

  await page.goto('/seller/tasks');
  await page.getByText('Phân công công việc mới', { exact: true }).click();

  // Verify wrong-kind action absent: INCIDENT is not allowed for Shop Owner
  await expect(page.locator('#assignment-kind option[value="INCIDENT"]')).toHaveCount(0);
  await expect(page.getByLabel('Loại công việc')).toHaveValue('DELIVERY');

  await page.getByRole('button', { name: 'Giao công việc', exact: true }).click();
  await expect(page.getByText('Chọn nhân viên phụ trách.', { exact: true })).toBeVisible();
  expect(writes).toBe(0);

  await page.getByLabel('Nhân viên phụ trách').selectOption('staff-lan-1');
  await page.getByLabel('Shop và tủ giao hoa').selectOption('shop-lan:kiosk-2');
  await page.getByLabel('Hướng dẫn công việc').fill('Giao 5 bó hồng pastel vào ô tủ Landmark');

  expect(
    (
      await new AxeBuilder({ page })
        .include('#staff-tasks')
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze()
    ).violations,
  ).toEqual([]);

  await page.getByRole('button', { name: 'Giao công việc', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Kiểm tra lại yêu cầu' })).toBeVisible();
  expect(writes).toBe(1);

  await page.reload();
  await page.getByText('Phân công công việc mới', { exact: true }).click();
  await page.getByRole('button', { name: 'Kiểm tra lại yêu cầu' }).click();
  await expect(
    page.getByText('Đã phân công. Nhân viên sẽ thấy công việc trong tài khoản.'),
  ).toBeVisible();
  expect(writes).toBe(2);

  // Exact API scope: owner only calls own seller API (/api/sellers/shop-lan/*)
  expect(
    requestedUrls
      .filter((p) => p.startsWith('/api/') && !p.startsWith('/api/auth'))
      .every((p) => p.startsWith('/api/sellers/shop-lan/')),
  ).toBe(true);
});

test('Admin tasks oversight is read-only and does not advertise assigning legacy staff or review actions', async ({
  page,
}) => {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me')
      return route.fulfill({
        json: { id: 'admin-1', name: 'Admin', role: 'ADMIN', sellerId: null },
      });
    if (path.startsWith('/api/admin/staff-tasks'))
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    return route.fulfill({ json: [] });
  });

  await page.goto('/admin/tasks');
  await expect(page.getByRole('heading', { name: 'Theo dõi công việc' })).toBeVisible();
  // Form to assign new tasks is absent for admin oversight (does not advertise assigning legacy staff)
  await expect(page.getByText('Phân công công việc mới')).toHaveCount(0);
  // Review actions are not advertised for admin read-only oversight
  await expect(page.getByText('Duyệt báo cáo hoặc yêu cầu kiểm tra lại')).toHaveCount(0);
  await expect(
    page.getByText(
      'Theo dõi trạng thái công việc toàn hệ thống ở chế độ chỉ đọc. Việc phân công và duyệt báo cáo do Quản lý vận hành và chủ shop thực hiện.',
    ),
  ).toBeVisible();
});

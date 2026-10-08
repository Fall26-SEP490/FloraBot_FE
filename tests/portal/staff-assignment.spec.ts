import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const kind of ['INCIDENT', 'DELIVERY'])
  test(`Admin assigns ${kind} and recovers the same request after reload`, async ({ page }) => {
    let payload: unknown;
    let writes = 0;
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me')
        return route.fulfill({
          json: { id: 'admin-1', name: 'Admin', role: 'ADMIN', sellerId: null },
        });
      if (path === '/api/admin/staff')
        return route.fulfill({ json: [{ id: 'staff-1', name: 'Nhân viên Hoa' }] });
      if (path === '/api/admin/staff-delivery-scopes')
        return route.fulfill({
          json: [
            {
              sellerId: 'shop-1',
              shopName: 'Tiệm Hoa',
              kioskId: 'kiosk-1',
              kioskName: 'Tủ FPT',
              address: 'Thủ Đức',
            },
          ],
        });
      if (path === '/api/admin/incidents')
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
      if (path === '/api/admin/staff-tasks' && route.request().method() === 'POST') {
        writes++;
        const body = route.request().postDataJSON();
        if (writes === 1) {
          payload = body;
          return route.abort();
        }
        expect(body).toEqual(payload);
        expect(body.kind).toBe(kind);
        expect(body.kioskId).toBe('kiosk-1');
        expect(body.sellerId).toBe(kind === 'DELIVERY' ? 'shop-1' : null);
        expect(body.incidentId).toBe(kind === 'INCIDENT' ? 'incident-1' : null);
        return route.fulfill({ json: { id: body.id } });
      }
      if (/staff-tasks|preorders|refunds|withdrawals|complaints/.test(path))
        return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
      return route.fulfill({ json: [] });
    });
    await page.goto('/admin/tasks');
    await page.getByText('Phân công công việc mới', { exact: true }).click();
    await page.getByLabel('Loại công việc').selectOption(kind);
    await page.getByRole('button', { name: 'Giao công việc', exact: true }).click();
    await expect(page.getByText('Chọn nhân viên phụ trách.', { exact: true })).toBeVisible();
    expect(writes).toBe(0);
    await page.getByLabel('Nhân viên phụ trách').selectOption('staff-1');
    await page
      .getByLabel(kind === 'INCIDENT' ? 'Sự cố cần kiểm tra' : 'Shop và tủ giao hoa')
      .selectOption(kind === 'INCIDENT' ? 'incident-1' : 'shop-1:kiosk-1');
    await page
      .getByLabel('Hướng dẫn công việc')
      .fill('Thực hiện công việc tại tủ và ghi nhận kết quả');
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
    await page.reload();
    await page.getByText('Phân công công việc mới', { exact: true }).click();
    await page.getByRole('button', { name: 'Kiểm tra lại yêu cầu' }).click();
    await expect(
      page.getByText('Đã phân công. Nhân viên sẽ thấy công việc trong tài khoản.'),
    ).toBeVisible();
    expect(writes).toBe(2);
  });

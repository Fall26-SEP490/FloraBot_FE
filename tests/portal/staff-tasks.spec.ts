import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1440]) {
  test(`Technician task report validation and uncertain response recovery ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: { id: 'tech-id', name: 'Kỹ thuật viên Hoa', role: 'TECHNICIAN', sellerId: null },
      }),
    );
    let version = 1;
    let status = 'ASSIGNED';
    let writes = 0;
    await page.route('**/api/staff/tasks?*', (route) =>
      route.fulfill({
        json: {
          page: 1,
          hasMore: false,
          items: [
            {
              id: 'task-1',
              kind: 'INCIDENT',
              status,
              version,
              assigneeName: 'Kỹ thuật viên Hoa',
              kioskName: 'Tủ FPT',
              address: 'Thủ Đức',
              shopName: null,
              instructions: 'Kiểm tra cửa bị kẹt tại tủ',
              report: null,
            },
          ],
        },
      }),
    );
    await page.route('**/api/staff/tasks/task-1?*', (route) =>
      route.fulfill({
        json: { kioskStatus: 'ONLINE', incident: null, slotCode: null, history: [] },
      }),
    );
    await page.route('**/api/staff/tasks/task-1/transition', async (route) => {
      writes++;
      expect(route.request().postDataJSON().version).toBe(version);
      version++;
      status = writes === 1 ? 'IN_PROGRESS' : 'SUBMITTED';
      if (writes === 1) return route.abort();
      return route.fulfill({ json: { id: 'task-1', version } });
    });
    await page.goto('/technician');
    await page.locator('.technician-task-body > summary').click();
    await page.getByRole('button', { name: 'Bắt đầu xử lý' }).click();
    await expect(page.getByText('Mô tả ít nhất 10 ký tự.')).toBeVisible();
    expect(writes).toBe(0);
    await page.getByLabel('Nội dung cập nhật').fill('Bắt đầu kiểm tra cửa tại tủ');
    expect(
      (
        await new AxeBuilder({ page })
          .include('#staff-tasks')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.getByRole('button', { name: 'Bắt đầu xử lý' }).click();
    await expect(page.getByText(/Chưa xác nhận được trạng thái mới/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Bắt đầu xử lý' })).toBeDisabled();
    expect(writes).toBe(1);
    await page.getByRole('button', { name: 'Tải lại công việc' }).click();
    await page.locator('.technician-task-body > summary').click();
    await expect(page.getByLabel('Bước tiếp theo')).toHaveValue('SUBMITTED');
    await page.getByLabel('Nội dung cập nhật').fill('Đã kiểm tra xong, gửi quản trị viên duyệt');
    await page.getByRole('button', { name: 'Gửi báo cáo' }).click();
    await expect(page.getByRole('button', { name: 'Gửi báo cáo' })).toHaveCount(0);
    expect(writes).toBe(2);
  });

  test(`Seller staff task report validation and delivery workflow ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: { id: 'staff-id', name: 'Nhân viên Shop', role: 'SELLER_STAFF', sellerId: 'shop-1' },
      }),
    );
    let version = 1;
    let status = 'ASSIGNED';
    let writes = 0;
    let inventoryReadsBeforeStart = 0;
    await page.route('**/api/staff/tasks?*', (route) =>
      route.fulfill({
        json: {
          page: 1,
          hasMore: false,
          items: [
            {
              id: 'task-delivery-1',
              kind: 'DELIVERY',
              status,
              version,
              assigneeName: 'Nhân viên Shop',
              kioskName: 'Tủ FPT',
              address: 'Thủ Đức',
              shopName: 'Tiệm Hoa',
              instructions: 'Giao hoa đến ô tủ và nạp đúng mã',
              report: null,
            },
          ],
        },
      }),
    );
    await page.route('**/api/staff/tasks/task-delivery-1/inventory-maintenance', (route) => {
      if (status === 'ASSIGNED') inventoryReadsBeforeStart++;
      return route.fulfill({ status: status === 'ASSIGNED' ? 500 : 404, body: '' });
    });
    await page.route('**/api/staff/tasks/task-delivery-1/transition', async (route) => {
      writes++;
      expect(route.request().postDataJSON().version).toBe(version);
      expect(route.request().postDataJSON().status).toBe(
        writes === 1 ? 'IN_PROGRESS' : 'SUBMITTED',
      );
      version++;
      status = writes === 1 ? 'IN_PROGRESS' : 'SUBMITTED';
      if (writes === 1) return route.abort();
      return route.fulfill({ json: { id: 'task-delivery-1', version } });
    });
    await page.goto('/staff');
    await expect(page.getByRole('heading', { name: 'Giao hoa · Tủ FPT' })).toBeVisible();
    await expect(page.getByText('Chờ bắt đầu hoặc đang thực hiện', { exact: true })).toBeVisible();
    await expect(page.locator('#report-error-task-delivery-1')).toHaveCount(0);
    const start = page.getByRole('button', { name: 'Bắt đầu', exact: true });
    await start.click();
    await expect(page.getByText('Mô tả ít nhất 10 ký tự.')).toBeVisible();
    expect(writes).toBe(0);
    await page.getByRole('button', { name: 'Bắt đầu giao hoa đến tủ', exact: true }).click();
    await expect(page.locator('#report-error-task-delivery-1')).toHaveCount(0);
    await start.click();
    await expect(page.getByText(/Chưa xác nhận được trạng thái mới/)).toBeVisible();
    expect(writes).toBe(1);
    await page.getByRole('button', { name: 'Tải lại công việc' }).click();
    await expect(page.getByLabel('Bước tiếp theo')).toHaveValue('SUBMITTED');
    await page.getByLabel('Nội dung cập nhật').fill('Đã nạp hoa và kiểm tra đầy đủ');
    await page.getByRole('button', { name: 'Gửi báo cáo', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Gửi báo cáo', exact: true })).toHaveCount(0);
    expect(writes).toBe(2);
    expect(inventoryReadsBeforeStart).toBe(0);
  });
}

test('Technician keeps an incident report draft when a Manager changes the instructions', async ({
  page,
}) => {
  const task = {
    id: 'task-1',
    kind: 'INCIDENT',
    status: 'IN_PROGRESS',
    version: 1,
    kioskName: 'Tủ FPT',
    address: 'Thủ Đức',
    assigneeName: 'Kỹ thuật viên',
    instructions: 'Kiểm tra chốt cửa trước.',
    report: null,
  };
  const newInstructions = 'Kiểm tra cả cảm biến hành trình của cửa.';
  const draft = 'Đã kiểm tra chốt, cửa đang đóng.';
  const versions: number[] = [];
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') {
      return route.fulfill({ json: { id: 'tech-1', name: 'Kỹ thuật viên', role: 'TECHNICIAN' } });
    }
    if (path === '/api/staff/tasks') {
      return route.fulfill({ json: { page: 1, hasMore: false, items: [task] } });
    }
    if (path === '/api/staff/tasks/task-1') {
      return route.fulfill({
        json: { kioskStatus: 'ONLINE', incident: null, slotCode: null, history: [] },
      });
    }
    if (path === '/api/staff/tasks/task-1/transition') {
      const body = route.request().postDataJSON();
      versions.push(body.version);
      expect(body.report).toBe(draft);
      if (body.version === 1) {
        task.version = 2;
        task.instructions = newInstructions;
        return route.fulfill({ status: 409, json: { detail: 'Công việc đã thay đổi.' } });
      }
      task.version = 3;
      task.status = 'SUBMITTED';
      return route.fulfill({ json: { id: task.id, version: task.version } });
    }
    return route.fulfill({ json: [] });
  });

  await page.goto('/technician');
  await page.locator('.technician-task-body > summary').click();
  const report = page.getByLabel('Nội dung cập nhật');
  const submit = page.getByRole('button', { name: 'Gửi báo cáo' });
  await report.fill(draft);
  await submit.click();
  await expect(submit).toBeDisabled();
  await page.getByRole('button', { name: 'Tải hướng dẫn mới' }).click();
  await expect(page.getByText(newInstructions)).toBeVisible();
  await expect(report).toHaveValue(draft);
  expect(versions).toEqual([1]);
  await submit.click();
  await expect(page.getByText('Chờ duyệt báo cáo', { exact: true }).last()).toBeVisible();
  expect(versions).toEqual([1, 2]);
});

test('KIOSK_REMOVAL task shows dismantling label and Manager completion guidance', async ({
  page,
}) => {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me')
      return route.fulfill({
        json: { id: 'mgr-1', name: 'Quản lý', role: 'OPERATIONS_MANAGER', sellerId: null },
      });
    if (path === '/api/operations/staff-tasks')
      return route.fulfill({
        json: {
          page: 1,
          hasMore: false,
          items: [
            {
              id: 'task-removal-1',
              kind: 'KIOSK_REMOVAL',
              status: 'SUBMITTED',
              version: 2,
              assigneeId: 'tech-1',
              assigneeName: 'Kỹ thuật viên Hoa',
              kioskId: 'kiosk-1',
              kioskName: 'Kiosk Quận 3',
              address: '123 Võ Văn Tần',
              sellerId: null,
              shopName: null,
              incidentId: null,
              instructions: 'Ngắt nguồn, tháo dỡ và thu hồi kiosk về kho.',
              report: 'Đã tháo dỡ và thu hồi kiosk đầy đủ.',
            },
          ],
        },
      });
    return route.fulfill({ json: [] });
  });

  await page.goto('/operations/tasks');
  const card = page.getByRole('article', { name: 'Tháo dỡ kiosk · Kiosk Quận 3' });
  await expect(card).toBeVisible();
  await expect(card.getByText('Hướng dẫn từ quản lý:', { exact: true })).toBeVisible();
  await expect(card.locator('select option[value="COMPLETED"]')).toHaveCount(0);
  await expect(card.locator('select option[value="IN_PROGRESS"]')).toHaveCount(1);
  await expect(card.getByRole('link', { name: 'Hồ sơ chấm dứt thuê kiosk' })).toHaveAttribute(
    'href',
    '/operations/terminations',
  );
});

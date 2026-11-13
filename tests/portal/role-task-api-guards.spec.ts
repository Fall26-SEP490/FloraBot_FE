import { expect, test, type Page } from '@playwright/test';

async function setup(page: Page, role: 'ADMIN' | 'OPERATIONS_MANAGER', conflict = false) {
  const model = {
    version: 1,
    instructions: 'Kiểm tra chốt cửa tại tủ',
    patches: [] as { version: number; instructions: string }[],
    writes: [] as string[],
  };
  const base = role === 'ADMIN' ? '/api/admin/staff-tasks' : '/api/operations/staff-tasks';
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
  await page.route('**/api/**', (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/auth/me')
      return route.fulfill({ json: { id: 'role-actor', name: 'Người kiểm thử', role } });
    if (req.method() === 'PATCH' && path === `${base}/task-1`) {
      const input = req.postDataJSON() as { version: number; instructions: string };
      model.patches.push(input);
      if (conflict && model.patches.length === 1) {
        model.version = 2;
        model.instructions = 'Hướng dẫn mới do người phụ trách khác cập nhật';
        return route.fulfill({ status: 409, json: { detail: 'Phiên bản công việc đã thay đổi.' } });
      }
      expect(input.version).toBe(model.version);
      model.instructions = input.instructions;
      model.version++;
      return route.fulfill({ json: { id: 'task-1', version: model.version } });
    }
    if (req.method() !== 'GET') {
      model.writes.push(path);
      return route.fulfill({ status: 405, json: {} });
    }
    if (path === base)
      return route.fulfill({
        json: {
          items: [
            {
              id: 'task-1',
              kind: 'INCIDENT',
              status: 'ASSIGNED',
              version: model.version,
              assigneeId: 'tech-1',
              assigneeName: 'Kỹ thuật viên',
              kioskName: 'Kiosk Thủ Đức',
              address: 'Thủ Đức',
              instructions: model.instructions,
              report: null,
            },
          ],
          page: 1,
          hasMore: false,
        },
      });
    if (path === `${base}/task-1`)
      return route.fulfill({
        json: {
          kioskStatus: 'OFFLINE',
          slotCode: null,
          incident: null,
          history: [],
          page: 1,
          hasMore: false,
        },
      });
    return route.fulfill({ json: [] });
  });
  return model;
}

test('Admin oversight shows task data without instruction or mutation controls', async ({
  page,
}) => {
  const model = await setup(page, 'ADMIN');
  await page.goto('/admin/tasks');
  await expect(page.getByText('Kiểm tra chốt cửa tại tủ', { exact: true })).toBeVisible();
  await expect(page.getByText('Sửa hướng dẫn công việc', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Lưu hướng dẫn' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Xác nhận cập nhật' })).toHaveCount(0);
  expect(model.patches).toEqual([]);
  expect(model.writes).toEqual([]);
});

for (const width of [390, 1440])
  test(`Manager saves instructions with PATCH and stays on the page at ${width}px`, async ({
    page,
  }) => {
    const model = await setup(page, 'OPERATIONS_MANAGER');
    await page.setViewportSize({ width, height: 900 });
    let documents = 0;
    page.on('request', (req) => {
      if (req.isNavigationRequest()) documents++;
    });
    await page.goto('/operations/tasks');
    await page.getByText('Sửa hướng dẫn công việc', { exact: true }).click();
    await page
      .getByLabel('Hướng dẫn công việc (10–2.000 ký tự)')
      .fill('  Kiểm tra chốt cửa và ghi lại kết quả  ');
    await page.getByRole('button', { name: 'Lưu hướng dẫn' }).click();
    await expect(
      page.getByText('Kiểm tra chốt cửa và ghi lại kết quả', { exact: true }),
    ).toBeVisible();
    expect(model.patches).toEqual([
      { version: 1, instructions: 'Kiểm tra chốt cửa và ghi lại kết quả' },
    ]);
    expect(documents).toBe(1);
    expect(model.writes).toEqual([]);
  });

test('Manager must reload a stale task before retrying a 409 instruction update', async ({
  page,
}) => {
  const model = await setup(page, 'OPERATIONS_MANAGER', true);
  await page.goto('/operations/tasks');
  await page.getByText('Sửa hướng dẫn công việc', { exact: true }).click();
  const editor = page.getByLabel('Hướng dẫn công việc (10–2.000 ký tự)');
  const draft = 'Kiểm tra cửa và cảm biến theo yêu cầu mới';
  await editor.fill(draft);
  await page.getByRole('button', { name: 'Lưu hướng dẫn' }).click();
  await expect(
    page.getByText('Công việc đã thay đổi. Tải lại để xem hướng dẫn và trạng thái mới.', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(editor).toHaveValue(draft);
  await expect(page.getByRole('button', { name: 'Lưu hướng dẫn' })).toBeDisabled();
  expect(model.patches).toHaveLength(1);
  await page.getByRole('button', { name: 'Tải hướng dẫn mới' }).click();
  await expect(
    page.getByText('Hướng dẫn mới do người phụ trách khác cập nhật', { exact: true }),
  ).toBeVisible();
  await page.getByText('Sửa hướng dẫn công việc', { exact: true }).click();
  await editor.fill(draft);
  await page.getByRole('button', { name: 'Lưu hướng dẫn' }).click();
  await expect(page.getByText(draft, { exact: true })).toBeVisible();
  expect(model.patches.map((patch) => patch.version)).toEqual([1, 2]);
  expect(model.writes).toEqual([]);
});

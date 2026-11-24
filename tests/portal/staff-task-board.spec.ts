import { expect, test } from '@playwright/test';

test('Staff sees work grouped ahead of history and can read why loading is blocked', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const fixture = (id: string, status: string, kioskName: string) => ({
    id,
    status,
    kioskName,
    kind: 'DELIVERY',
    version: 1,
    address: 'Thủ Đức',
    instructions: 'Giao hoa đúng ô được phân công.',
    report: null,
  });
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: { id: 'staff', name: 'Nhân viên Hoa', role: 'SELLER_STAFF', sellerId: 'shop' },
    }),
  );
  const statuses: (string | null)[] = [];
  await page.route('**/api/staff/tasks?*', (route) => {
    const params = new URL(route.request().url()).searchParams;
    const status = params.get('status');
    const currentPage = Number(params.get('page'));
    statuses.push(status);
    const items =
      status === 'IN_PROGRESS'
        ? [fixture('active', status, 'Tủ đang làm')]
        : status === 'ASSIGNED'
          ? [fixture('queued', status, 'Tủ mới giao')]
          : status === 'SUBMITTED'
            ? [fixture('review', status, 'Tủ chờ duyệt')]
            : status === 'COMPLETED'
              ? [fixture(`old-${currentPage}`, status, `Tủ cũ ${currentPage}`)]
              : [];
    return route.fulfill({
      json: { items, page: currentPage, hasMore: status === 'COMPLETED' && currentPage === 1 },
    });
  });
  await page.route('**/api/staff/tasks/active/inventory-maintenance', (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.route('**/api/staff/tasks/active/stock', (route) =>
    route.fulfill({
      json: { slots: [], products: [{ id: 'flower', name: 'Hoa hồng' }], actions: [] },
    }),
  );
  await page.route('**/api/staff/tasks/active/preorders', (route) =>
    route.fulfill({ json: { preorders: [], slots: [] } }),
  );

  await page.goto('/staff');
  const board = page.getByRole('region', { name: 'Danh sách công việc' });
  await expect(board.getByRole('combobox')).toHaveCount(0);
  await expect(board.getByRole('heading', { level: 3 })).toHaveText([
    'Đang thực hiện',
    'Chờ bắt đầu',
    'Chờ chủ shop duyệt',
  ]);
  const active = board.getByRole('article', { name: 'Thao tác hoa tại tủ · Tủ đang làm' });
  await expect(active.getByRole('button', { name: 'Tiếp tục xử lý' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(active.getByText(/Chưa thể thao tác:/)).toBeVisible();
  await expect(active).toContainText('Không có ô bán sẵn trống phù hợp.');
  await expect(active).toContainText('Không có đơn đặt trước đủ điều kiện nạp.');
  await expect(active).not.toContainText('Không có mẫu hoa');
  await expect(board.getByRole('article', { name: 'Thao tác hoa tại tủ · Tủ cũ 1' })).toBeHidden();

  await board.getByText('Lịch sử công việc', { exact: true }).click();
  await expect(board.getByRole('article', { name: 'Thao tác hoa tại tủ · Tủ cũ 1' })).toBeVisible();
  await board
    .getByRole('navigation', { name: 'Phân trang: Đã hoàn thành' })
    .getByRole('button', {
      name: 'Trang sau',
    })
    .click();
  await expect(board.getByRole('article', { name: 'Thao tác hoa tại tủ · Tủ cũ 2' })).toBeVisible();
  await expect(
    board.getByRole('article', { name: 'Thao tác hoa tại tủ · Tủ mới giao' }),
  ).toBeVisible();
  expect(statuses).not.toContain(null);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

async function setup(page: Page) {
  let release = () => {};
  const pendingRefund = new Promise<void>((resolve) => {
    release = resolve;
  });
  const model = { failed: false, holdRefunds: false, release, writes: [] as string[] };
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname;
    if (req.method() !== 'GET') {
      model.writes.push(path);
      return route.fulfill({ status: 405, json: {} });
    }
    if (path === '/api/auth/me')
      return route.fulfill({
        json: { id: 'clarity-admin', name: 'Admin kiểm thử', role: 'ADMIN', sellerId: null },
      });
    if (path === '/api/admin/managers')
      return route.fulfill({
        json: [
          { id: 'm1', status: 'ACTIVE' },
          { id: 'm2', status: 'LOCKED' },
        ],
      });
    if (path === '/api/admin/refunds') {
      if (model.failed) return route.fulfill({ status: 503, json: { detail: 'Unavailable' } });
      if (model.holdRefunds) await pendingRefund;
      return route.fulfill({
        json: {
          items: [
            {
              id: 'r1',
              orderCode: 'TEST-001',
              amount: 250000,
              status: 'PENDING',
              requiresApproval: true,
              createdAt: '2026-10-31T02:00:00Z',
            },
          ],
          page: 1,
          hasMore: true,
        },
      });
    }
    if (path === '/api/admin/incidents')
      return route.fulfill({
        json: {
          items: [
            {
              id: 'i1',
              location: { kioskName: 'Tủ kiểm thử' },
              reason: 'Cửa tủ chưa đóng',
              createdAt: '2026-10-31T01:00:00Z',
            },
          ],
          hasMore: false,
        },
      });
    if (path === '/api/admin/staff-tasks')
      return route.fulfill({
        json: {
          items: [
            {
              id: 't1',
              kind: 'INCIDENT',
              kioskName: 'Tủ kiểm thử',
              assigneeName: 'Kỹ thuật viên kiểm thử',
            },
          ],
          hasMore: false,
        },
      });
    if (path === '/api/admin/refunds/r1')
      return route.fulfill({
        json: {
          refund: {
            id: 'r1',
            orderCode: 'TEST-001',
            amount: 250000,
            status: 'PENDING',
            reason: 'AUTO_REFUND: Cửa tủ chưa mở',
            requiresApproval: true,
          },
          bankStatus: 'NEEDS_UPDATE',
          canApprove: false,
          canAccessBank: false,
        },
      });
    if (path === '/api/admin/sellers') return route.fulfill({ json: [] });
    if (path === '/api/admin/kiosk-applications/refunds') return route.fulfill({ json: [] });
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
  return model;
}

for (const width of [390, 834, 1440]) {
  test(`Admin puts decisions before personnel and reflows at ${width}`, async ({ page }) => {
    const model = await setup(page);
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/admin');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tổng quan quản trị');
    const queue = page.getByRole('region', { name: 'Cần bạn xử lý', exact: true });
    await expect(queue.getByLabel('1+ yêu cầu đang hiển thị')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Báo cáo cần theo dõi', exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Báo cáo chờ duyệt', { exact: true })).toHaveCount(0);
    const row = queue.getByRole('article', { name: 'Hoàn tiền đơn hoa', exact: true });
    const rowBounds = await row.boundingBox();
    const countBounds = await row.locator('.admin-queue-count').boundingBox();
    expect(countBounds!.y).toBeLessThan(rowBounds!.y + rowBounds!.height / 2);
    const order = await page.locator('#main h2').allTextContents();
    expect(order.indexOf('Cần bạn xử lý')).toBeLessThan(order.indexOf('Đội ngũ Quản lý vận hành'));
    expect(order.indexOf('Sự cố cần xử lý')).toBeLessThan(
      order.indexOf('Đội ngũ Quản lý vận hành'),
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    expect(model.writes).toEqual([]);
  });

  test(`Admin navigation searches without accents, keeps all routes and restores focus at ${width}`, async ({
    page,
  }) => {
    const model = await setup(page);
    await page.setViewportSize({ width, height: 960 });
    await page.goto('/admin');
    const toggle = page.getByRole('button', { name: 'Mở danh mục quản lý', exact: true });
    if (width <= 900) await toggle.click();
    const nav = page.getByRole('navigation', { name: 'Điều hướng quản lý', exact: true });
    await expect(nav.getByRole('link')).toHaveCount(16);
    const search = page.getByRole('searchbox', { name: 'Tìm chức năng quản trị', exact: true });
    await search.fill('hoan tien');
    await expect(nav.getByRole('link', { name: 'Hoàn tiền', exact: true })).toBeVisible();
    await expect(
      nav.getByRole('link', { name: 'Hoàn tiền thuê kiosk', exact: true }),
    ).toBeVisible();
    await search.fill('khongcotronghethong');
    await expect(nav.getByRole('status')).toContainText('Không tìm thấy chức năng');
    await page.getByRole('button', { name: 'Xóa tìm chức năng', exact: true }).click();
    await expect(nav.getByRole('link')).toHaveCount(16);
    if (width <= 900) {
      await search.press('Escape');
      await expect(
        page.getByRole('button', { name: 'Mở danh mục quản lý', exact: true }),
      ).toBeFocused();
      await expect(nav).toBeHidden();
    }
    expect(model.writes).toEqual([]);
  });
}

test('Admin queues isolate failures, filter requests, and preserve oversight', async ({ page }) => {
  const model = await setup(page);
  model.failed = true;
  await page.goto('/admin/approvals');
  const review = page.getByRole('region', { name: 'Admin cần xử lý', exact: true });
  const refund = page.getByRole('article', { name: 'Hoàn tiền đơn hoa', exact: true });
  await expect(refund.getByRole('alert')).toContainText('Chưa tải được');
  await expect(refund.locator('.admin-queue-count')).toHaveCount(0);
  await page.getByRole('button', { name: 'Có yêu cầu', exact: true }).click();
  await expect(review.getByRole('article')).toHaveCount(1);
  await expect(
    page.getByRole('region', { name: 'Theo dõi vận hành', exact: true }).getByRole('article'),
  ).toHaveCount(2);
  model.failed = false;
  await refund.getByRole('button', { name: 'Thử lại hoàn tiền đơn hoa', exact: true }).click();
  await expect(refund.getByLabel('1+ yêu cầu đang hiển thị')).toBeVisible();
  await expect(review.getByRole('article')).toHaveCount(1);
  await page.getByRole('button', { name: 'Tất cả', exact: true }).click();
  await expect(review.getByRole('article')).toHaveCount(5);
  expect(model.writes).toEqual([]);
});

test('Admin: loading a queue never flashes a fabricated zero', async ({ page }) => {
  const model = await setup(page);
  model.holdRefunds = true;
  await page.goto('/admin');
  const refund = page.getByRole('article', { name: 'Hoàn tiền đơn hoa', exact: true });
  await expect(refund.getByRole('status')).toContainText('Đang tải');
  await expect(refund.locator('.admin-queue-count')).toHaveCount(0);
  model.release!();
  await expect(refund.getByLabel('1+ yêu cầu đang hiển thị')).toBeVisible();
  expect(model.writes).toEqual([]);
});

test('Admin refund disclosure remains keyboard operable and explains its next action', async ({
  page,
}) => {
  const model = await setup(page);
  await page.goto('/admin/refunds');
  const summary = page.locator('.admin-refunds summary');
  await expect(summary).toContainText('Xem chi tiết');
  await summary.press('Enter');
  await expect(summary).toContainText('Ẩn chi tiết');
  await expect(page.getByText('Hoàn tiền tự động · Cửa tủ chưa mở', { exact: true })).toBeVisible();
  await expect(
    page.getByText('Chưa có tài khoản nhận hoàn hợp lệ.', { exact: false }),
  ).toBeVisible();
  await summary.press('Enter');
  await expect(summary).toContainText('Xem chi tiết');
  expect(model.writes).toEqual([]);
});

test('Admin request filter has an honest empty state', async ({ page }) => {
  const model = await setup(page);
  await page.route('**/api/admin/refunds?*', (route) =>
    route.fulfill({ json: { items: [], hasMore: false } }),
  );
  await page.route('**/api/admin/incidents?*', (route) =>
    route.fulfill({ json: { items: [], hasMore: false } }),
  );
  await page.goto('/admin/approvals');
  await expect(page.getByRole('button', { name: 'Cập nhật danh sách', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Có yêu cầu', exact: true }).click();
  const review = page.getByRole('region', { name: 'Admin cần xử lý', exact: true });
  await expect(review.getByRole('status')).toContainText('Chưa có yêu cầu cần xử lý');
  await expect(page.getByRole('region', { name: 'Theo dõi vận hành', exact: true })).toBeVisible();
  expect(model.writes).toEqual([]);
});

test('Admin remains usable with doubled text at a narrow viewport', async ({ page }) => {
  await setup(page);
  await page.setViewportSize({ width: 390, height: 960 });
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Cần bạn xử lý', exact: true })).toBeVisible();
  const fontSize = await page.evaluate(() =>
    parseFloat(getComputedStyle(document.documentElement).fontSize),
  );
  await page.addStyleTag({ content: `:root { font-size: ${fontSize * 2}px !important; }` });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  const action = await page
    .getByRole('link', { name: 'Mở trung tâm duyệt', exact: true })
    .boundingBox();
  expect(action!.x).toBeGreaterThanOrEqual(0);
  expect(action!.x + action!.width).toBeLessThanOrEqual(390);
  await page.getByRole('button', { name: 'Mở danh mục quản lý', exact: true }).click();
  await expect(
    page.getByRole('searchbox', { name: 'Tìm chức năng quản trị', exact: true }),
  ).toBeVisible();
});

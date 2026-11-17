import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

async function fixture(page: Page, mode: 'data' | 'empty' | 'error' | 'slow' = 'data') {
  const writes: string[] = [];
  const jobs = [
    { id: 'job-a', shopName: 'Shop Hoa Dĩ An', status: 'SCHEDULED', kioskCode: 'K-DIAN-01' },
    { id: 'job-b', shopName: 'Shop Bình Thạnh', status: 'INSTALLING', kioskCode: 'K-BT-02' },
    { id: 'job-c', shopName: 'Shop đã bàn giao', status: 'ACTIVE', kioskCode: 'K-ACTIVE-03' },
  ].map((job) => ({
    ...job,
    installationAddress: '219 Nguyễn Văn Tăng, Thủ Đức',
    phone: '0901234567',
    contactEmail: 'test@example.test',
    scheduledDate: '2026-11-02',
    timeWindow: '09:00 - 12:00',
    latitude: 10.78,
    longitude: 106.69,
    reworkReason: null,
    technicianReport: null,
  }));
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname;
    if (route.request().method() !== 'GET') {
      writes.push(path);
      return route.fulfill({ status: 400, json: {} });
    }
    if (path === '/api/auth/me')
      return route.fulfill({ json: { id: 'tech-ui', name: 'Kỹ thuật viên', role: 'TECHNICIAN' } });
    if (
      mode === 'slow' &&
      (path === '/api/staff/tasks' || path === '/api/staff/kiosk-installations')
    )
      await new Promise((resolve) => setTimeout(resolve, 1200));
    if (mode === 'error') return route.fulfill({ status: 503, json: { detail: 'Tạm gián đoạn' } });
    if (path === '/api/staff/tasks') {
      const items =
        mode === 'empty'
          ? []
          : [
              {
                id: 'task-a',
                kind: 'INCIDENT',
                status: 'ASSIGNED',
                version: 1,
                kioskName: 'Tủ Thủ Đức',
                address: '219 Nguyễn Văn Tăng',
                assigneeName: 'Kỹ thuật viên',
                instructions: 'Kiểm tra chốt cửa bị kẹt',
                report: null,
              },
            ];
      return route.fulfill({
        json: {
          items: url.searchParams.get('status') === 'COMPLETED' ? [] : items,
          page: 1,
          hasMore: false,
        },
      });
    }
    if (path === '/api/staff/kiosk-installations')
      return route.fulfill({ json: mode === 'empty' ? [] : jobs });
    if (path === '/api/staff/tasks/task-a')
      return route.fulfill({
        json: { kioskStatus: 'ONLINE', lastHeartbeatAt: null, history: [], hasMore: false },
      });
    if (path.endsWith('/evidence')) return route.fulfill({ json: [] });
    const job = jobs.find((item) => path === `/api/staff/kiosk-installations/${item.id}`);
    if (job) return route.fulfill({ json: job });
    return route.fulfill({ status: 404, json: {} });
  });
  return { writes };
}

test('Technician opens the kiosk health tab and reads all four slots', async ({
  page,
}, testInfo) => {
  await fixture(page);
  await page.route('**/api/staff/kiosk-health', (route) =>
    route.fulfill({
      json: [
        { id: 'kiosk12', code: 'K-HCM-12', name: 'Kiosk 12', status: 'ONLINE' },
        { id: 'kiosk10', code: 'K-HCM-10', name: 'Kiosk 10', status: 'OFFLINE' },
      ],
    }),
  );
  await page.route('**/api/staff/kiosk-health/*', (route) => {
    const fresh = route.request().url().endsWith('/kiosk12');
    return route.fulfill({
      json: {
        kioskStatus: fresh ? 'ONLINE' : 'OFFLINE',
        isFresh: fresh,
        observedAt: new Date().toISOString(),
        slots: [1, 2, 3, 4].map((i) => ({
          slotCode: `S0${i}`,
          flowerDetected: i === 1,
          doorClosed: true,
          lastCycle: null,
        })),
      },
    });
  });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/technician');
  await page.getByRole('link', { name: 'Sức khỏe kiosk' }).click();
  await expect(page).toHaveURL(/\/technician\/kiosk-health$/);
  await expect(page.getByRole('link', { name: 'Sức khỏe kiosk' })).toHaveAttribute(
    'aria-current',
    'page',
  );
  const panel = page.getByRole('region', { name: 'Sức khỏe thiết bị IoT' });
  for (const slot of ['S01', 'S02', 'S03', 'S04']) {
    await expect(panel.getByRole('heading', { name: `Ô ${slot}` })).toBeVisible();
  }
  expect(
    (await new AxeBuilder({ page }).include('.technician-kiosk-health').analyze()).violations,
  ).toEqual([]);
  await panel.screenshot({ path: testInfo.outputPath('kiosk-health-1440.png') });
  await page.setViewportSize({ width: 390, height: 900 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
  await panel.screenshot({ path: testInfo.outputPath('kiosk-health-390.png') });
  await page.getByLabel('Kiosk được giao').selectOption('kiosk10');
  await expect(panel.getByText('Mất kết nối', { exact: false })).toBeVisible();
  await expect(panel.getByText('Phát hiện vật', { exact: true })).toHaveCount(0);
});

for (const width of [390, 1440]) {
  test(`Technical can distinguish a door timeout from stale readings at ${width}`, async ({
    page,
  }, testInfo) => {
    const { writes } = await fixture(page);
    let isFresh = true;
    const observedAt = new Date().toISOString();
    await page.route('**/api/staff/tasks/task-a/iot-health', (route) =>
      route.fulfill({
        json: {
          kioskStatus: 'ONLINE',
          observedAt,
          isFresh,
          slots: [
            {
              slotCode: 'S01',
              flowerDetected: false,
              doorClosed: true,
              lastCycle: 'OPEN_TIMEOUT',
              lastCycleAt: observedAt,
            },
          ],
        },
      }),
    );
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/technician');
    await page.locator('.technician-task-body > summary').click();
    await page.locator('.staff-task-details > summary').click();
    const panel = page.getByRole('region', { name: 'Sức khỏe thiết bị IoT' });
    await expect(panel.getByText('Không phát hiện vật')).toBeVisible();
    await expect(panel.getByText('Báo cửa đóng')).toBeVisible();
    await expect(panel.getByText(/hết thời gian chờ tín hiệu mở/)).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).include('.staff-task-details').analyze()).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    await panel.screenshot({ path: testInfo.outputPath(`technician-iot-${width}.png`) });
    isFresh = false;
    await panel.getByRole('button', { name: 'Đọc lại tín hiệu' }).click();
    await expect(panel.getByText(/Đang chờ dữ liệu mới/)).toBeVisible();
    await expect(panel.getByText(/hết thời gian chờ tín hiệu mở/)).toHaveCount(0);
    expect(writes).toEqual([]);
  });

  test(`Technician work first, disclosure preserves draft at ${width}`, async ({
    page,
  }, testInfo) => {
    const { writes } = await fixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/technician');
    await expect(
      page.getByRole('heading', { name: 'Công việc kỹ thuật', exact: true, level: 1 }),
    ).toBeVisible();
    await expect(page.getByText('Tổng công việc', { exact: true })).toHaveCount(0);
    const disclosure = page.locator('.technician-task-body > summary');
    await expect(disclosure).toContainText('Bắt đầu xử lý');
    await expect(page.getByRole('navigation', { name: 'Chọn trạng thái công việc' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Chỉ đường Google Maps' })).toHaveAttribute(
      'href',
      /google.com\/maps\/dir\/.*destination=/,
    );
    const initialAction = await disclosure.boundingBox();
    expect(initialAction!.y + initialAction!.height).toBeLessThanOrEqual(844);
    await disclosure.click();
    await page
      .getByLabel('Nội dung cập nhật', { exact: true })
      .fill('Tôi đã đến tủ để kiểm tra cửa.');
    await page.getByLabel('Tìm công việc trong trang', { exact: true }).fill('khong-co-tu-nay');
    await expect(page.getByText(/Không có công việc khớp tìm kiếm trong trang này/)).toBeVisible();
    await page.getByRole('button', { name: 'Xóa tìm kiếm', exact: true }).click();
    await disclosure.click();
    await disclosure.click();
    await expect(page.getByLabel('Nội dung cập nhật', { exact: true })).toHaveValue(
      'Tôi đã đến tủ để kiểm tra cửa.',
    );
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: testInfo.outputPath(`technician-tasks-${width}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        viewport: innerWidth,
        overflowing: [...document.querySelectorAll('main *')]
          .filter(
            (node) =>
              node.getBoundingClientRect().right > innerWidth + 1 &&
              node.getBoundingClientRect().width > 1,
          )
          .slice(0, 5)
          .map((node) => node.className),
      })),
    ).toMatchObject({ width, viewport: width });
    expect(writes).toEqual([]);
  });

  test(`Technician installation search, detail and draft at ${width}`, async ({
    page,
  }, testInfo) => {
    const { writes } = await fixture(page);
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/technician/installations');
    await expect(page.getByRole('heading', { name: 'Lắp đặt kiosk', exact: true })).toBeVisible();
    await page.getByLabel('Tìm phiếu lắp đặt', { exact: true }).fill('binh thanh');
    await expect(page.locator('.tech-job-card')).toHaveCount(1);
    await page.getByRole('button', { name: /Shop Bình Thạnh/ }).click();
    await expect(page.locator('#job-detail-title')).toHaveText('Shop Bình Thạnh');
    await expect(page.getByLabel('Nội dung báo cáo chi tiết:')).toBeVisible();
    await page
      .getByLabel('Nội dung báo cáo chi tiết:')
      .fill('Đã đến hiện trường, đang kiểm tra nguồn điện.');
    {
      await page.getByRole('button', { name: 'Danh sách lắp đặt', exact: true }).click();
      await expect(page.locator('.technician-list-pane')).toBeFocused();
      await page.getByRole('button', { name: /Shop Bình Thạnh/ }).click();
      await expect(page.getByLabel('Nội dung báo cáo chi tiết:')).toHaveValue(
        'Đã đến hiện trường, đang kiểm tra nguồn điện.',
      );
    }
    await expect(
      page.getByRole('button', { name: 'Nộp báo cáo hoàn thành', exact: true }),
    ).toBeDisabled();
    expect((await new AxeBuilder({ page }).include('main').analyze()).violations).toEqual([]);
    await page.evaluate(() => {
      document.documentElement.style.scrollBehavior = 'auto';
      window.scrollTo(0, 0);
    });
    await page.screenshot({
      path: testInfo.outputPath(`technician-installations-${width}.png`),
      fullPage: true,
    });
    expect(
      await page.evaluate(() => ({
        width: document.documentElement.scrollWidth,
        viewport: innerWidth,
        overflowing: [...document.querySelectorAll('main *')]
          .filter(
            (node) =>
              node.getBoundingClientRect().right > innerWidth + 1 &&
              node.getBoundingClientRect().width > 1,
          )
          .slice(0, 5)
          .map((node) => node.className),
      })),
    ).toMatchObject({ width, viewport: width });
    expect(writes).toEqual([]);
  });
}

for (const route of ['/technician', '/technician/installations']) {
  for (const mode of ['empty', 'error', 'slow'] as const) {
    test(`Technician ${mode} state ${route}`, async ({ page }) => {
      const { writes } = await fixture(page, mode);
      await page.goto(route);
      if (mode === 'empty')
        await expect(
          page.getByRole('heading', {
            name: route.endsWith('installations')
              ? 'Chưa có công việc lắp đặt nào'
              : 'Chưa có công việc',
            exact: true,
          }),
        ).toBeVisible();
      if (mode === 'error') {
        await expect(page.locator('main [role="alert"]').first()).toBeVisible();
        await expect(page.getByRole('button', { name: /Bắt đầu lắp đặt|Nộp báo cáo/ })).toHaveCount(
          0,
        );
      }
      if (mode === 'slow') {
        await expect(
          page
            .locator('main [role="status"]')
            .filter({ hasText: /Đang tải/ })
            .first(),
        ).toBeVisible();
        await expect(
          page.getByText(
            route.endsWith('installations') ? '3 / 3 phiếu được giao' : '1 công việc trong trang 1',
            { exact: false },
          ),
        ).toBeVisible();
      }
      expect(writes).toEqual([]);
    });
  }
}

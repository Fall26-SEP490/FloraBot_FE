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
    if (path.endsWith('/evidence')) return route.fulfill({ json: [] });
    const job = jobs.find((item) => path === `/api/staff/kiosk-installations/${item.id}`);
    if (job) return route.fulfill({ json: job });
    return route.fulfill({ status: 404, json: {} });
  });
  return { writes };
}

for (const width of [390, 1440]) {
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
    await disclosure.click();
    await page
      .getByLabel('Nội dung cập nhật', { exact: true })
      .fill('Tôi đã đến tủ để kiểm tra cửa.');
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
    if (width === 390) {
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

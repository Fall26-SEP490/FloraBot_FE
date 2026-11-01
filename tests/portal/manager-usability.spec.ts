import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { managerApplication, setupManagerUsability } from '../fixtures/manager-usability';
for (const width of [390, 1440]) {
  for (const [path, title] of [
    ['', 'Tổng quan vận hành'],
    ['installations', 'Hồ sơ thuê & lắp đặt'],
    ['tasks', 'Điều phối công việc kỹ thuật'],
    ['technicians', 'Quản lý kỹ thuật viên'],
    ['sellers', 'Quản lý shop hoa'],
    ['customers', 'Quản lý khách hàng'],
  ]) {
    test(`Manager ${path || 'overview'} is clear and accessible at ${width}`, async ({ page }) => {
      const model = await setupManagerUsability(page);
      await page.setViewportSize({ width, height: 950 });
      await page.goto('/operations' + (path ? '/' + path : ''));
      await expect(page.getByRole('heading', { level: 1, name: title, exact: true })).toBeVisible();
      await expect(page.locator('.manager-workspace')).toBeVisible();
      if (!path)
        await expect(
          page.getByRole('region', { name: 'Việc cần xử lý', exact: true }),
        ).toBeVisible();
      if (path === 'installations')
        await expect(page.getByRole('table', { name: 'Danh sách hồ sơ thuê kiosk' })).toBeVisible();
      if (path === 'tasks')
        await expect(page.getByText('0 công việc trong trang 1', { exact: false })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      expect(
        (
          await new AxeBuilder({ page })
            .include('#main')
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
            .analyze()
        ).violations,
      ).toEqual([]);
      await page.screenshot({
        path: `artifacts/manager-final-${path || 'overview'}-${width}.png`,
        fullPage: true,
      });
      expect(model.writes).toEqual([]);
    });
  }
  test(`Manager workbench reaches the correct filtered queue and opens a real record at ${width}`, async ({
    page,
  }) => {
    const model = await setupManagerUsability(page);
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/operations');
    const jobs = page.getByRole('navigation', { name: 'Chọn việc cần xử lý' });
    await expect(jobs.getByRole('link', { name: /Chờ xác nhận/ })).toContainText('2');
    await jobs.getByRole('link', { name: /Chờ xếp lịch/ }).click();
    await expect(page.getByLabel('Lọc theo trạng thái:', { exact: true })).toHaveValue('CONFIRMED');
    await expect(page.getByRole('table')).toContainText('Shop chờ xếp lịch');
    await page.getByRole('button', { name: 'Xếp lịch', exact: true }).click();
    await expect(
      page.getByRole('heading', { name: 'Chi tiết: Shop chờ xếp lịch', exact: true }),
    ).toBeVisible();
    await expect(page.getByLabel('Khung giờ')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Cấp lại khóa API', exact: true })).toHaveCount(
      0,
    );
    expect(
      model.requests.some((url) => url.includes('status=PAID_REVIEW') && url.includes('page=2')),
    ).toBe(true);
    expect(model.writes).toEqual([]);
  });
}
test('Manager dashboard report and inventory shortcuts preserve their scope', async ({ page }) => {
  const model = await setupManagerUsability(page);
  await page.goto('/operations');
  await page
    .getByRole('navigation', { name: 'Chọn việc cần xử lý' })
    .getByRole('link', { name: /Báo cáo chờ duyệt/ })
    .click();
  await expect(page.getByLabel('Lọc trạng thái', { exact: true })).toHaveValue('SUBMITTED');
  expect(model.requests).toContain('/operations/staff-tasks?page=1&status=SUBMITTED');
  await page.goto('/operations');
  await page.getByRole('link', { name: /Tủ có thể phân bổ/ }).click();
  await expect(page.getByRole('dialog', { name: 'Kho thiết bị Kiosk khả dụng' })).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('K-MANAGER-01');
  expect(model.writes).toEqual([]);
});
test('Manager finds navigation without accents and reset restores keyboard focus', async ({
  page,
}) => {
  const model = await setupManagerUsability(page);
  await page.goto('/operations');
  const search = page.getByLabel('Tìm chức năng vận hành', { exact: true });
  await search.fill('ky thuat');
  const nav = page.getByRole('navigation', { name: 'Điều hướng quản lý' });
  await expect(nav.getByRole('link', { name: 'Kỹ thuật viên', exact: true })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Khách hàng', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Xóa tìm kiếm', exact: true }).click();
  await expect(search).toBeFocused();
  expect(model.writes).toEqual([]);
});
test('Manager isolates an unavailable queue without inventing zero and retries', async ({
  page,
}) => {
  const model = await setupManagerUsability(page);
  model.failStatus = 'PAID_REVIEW';
  await page.goto('/operations');
  const jobs = page.getByRole('navigation', { name: 'Chọn việc cần xử lý' });
  await expect(jobs.getByRole('link', { name: /Chờ xác nhận/ })).toContainText('—');
  await expect(jobs.getByRole('link', { name: /Chờ xếp lịch/ })).toContainText('1');
  model.failStatus = '';
  await page.getByRole('button', { name: 'Làm mới', exact: true }).click();
  await expect(jobs.getByRole('link', { name: /Chờ xác nhận/ })).toContainText('2');
  expect(model.writes).toEqual([]);
});

for (const width of [390, 1440]) {
  test(`Manager overview stays useful with zero pending work and shows the actual assigned schedule at ${width}`, async ({
    page,
  }) => {
    const model = await setupManagerUsability(page);
    model.apps = [
      { ...managerApplication, id: 'active-shop', shopName: 'Shop đã hoạt động', status: 'ACTIVE' },
      {
        ...managerApplication,
        id: 'scheduled-shop',
        shopName: 'Shop có lịch lắp đặt',
        status: 'SCHEDULED',
      },
    ];
    await page.setViewportSize({ width, height: 950 });
    await page.goto('/operations');
    await expect(page.getByText('Không có việc đang chờ', { exact: true })).toBeVisible();
    const jobs = page.getByRole('navigation', { name: 'Chọn việc cần xử lý' });
    await expect(jobs.locator('a[data-has-work="true"]')).toHaveCount(0);
    await expect(jobs.getByRole('link')).toHaveCount(4);
    await expect(
      page.getByText('Lịch lắp đặt: 10/11/2026 · 10:00 - 12:00', { exact: true }),
    ).toBeVisible();
    await expect(page.getByText('Minh Kỹ Thuật · K-HCM-01', { exact: true })).toBeVisible();
    await expect(
      page
        .getByRole('region', { name: 'Hồ sơ mới nhất' })
        .getByRole('link', { name: /Shop đã hoạt động/ }),
    ).not.toContainText('Lịch lắp đặt:');
    expect(
      (
        await new AxeBuilder({ page })
          .include('#main')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `artifacts/manager-overview-revised-zero-${width}.png`,
      fullPage: true,
    });
    await jobs.getByRole('link', { name: /Chờ xác nhận/ }).click();
    await expect(
      page.getByRole('combobox', { name: 'Lọc theo trạng thái:', exact: true }),
    ).toHaveValue('PAID_REVIEW');
    expect(model.writes).toEqual([]);
  });
}

test('Manager never declares the queue clear while a group is loading or unavailable', async ({
  page,
}) => {
  const model = await setupManagerUsability(page);
  model.apps = [];
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/operations/kiosk-applications?*status=CONFIRMED', async (route) => {
    await gate;
    await route.fulfill({ status: 503, json: { detail: 'Unavailable group' } });
  });
  try {
    await page.goto('/operations');
    await expect(page.getByText('Đang kiểm tra công việc…', { exact: true })).toBeVisible();
    await expect(page.getByText('Không có việc đang chờ', { exact: true })).toHaveCount(0);
    release();
    await expect(
      page
        .getByRole('navigation', { name: 'Chọn việc cần xử lý' })
        .getByRole('link', { name: /Chờ xếp lịch/ }),
    ).toContainText('—');
    await expect(page.getByText('Không có việc đang chờ', { exact: true })).toHaveCount(0);
    expect(model.writes).toEqual([]);
  } finally {
    release();
  }
});

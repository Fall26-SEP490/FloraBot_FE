import { test, expect } from '@playwright/test';
import { setupSellerUsability, shopId } from '../fixtures/seller-usability';

for (const width of [1920, 1366, 768, 390])
  test(`seller task table and staff directory at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setupSellerUsability(page);
    const tasks = [
      {
        id: 'task-active',
        version: 1,
        kind: 'DELIVERY',
        assigneeId: 'test-staff',
        assigneeName: 'Nhân viên kiểm thử',
        sellerId: shopId,
        kioskId: 'kiosk-1',
        kioskName: 'Kiosk HCM 12',
        shopName: 'Shop Hoa Của Tâm',
        status: 'IN_PROGRESS',
        instructions: 'Giao 3 bó hồng pastel và kiểm tra hoa tại tủ.',
        report: null,
        location: { kioskName: 'Kiosk HCM 12', address: 'Khu Công nghệ cao Hòa Lạc, Hà Nội' },
      },
      {
        id: 'task-done',
        version: 3,
        kind: 'DELIVERY',
        workType: 'FLOWER_QUALITY',
        assigneeId: 'test-staff',
        assigneeName: 'Nhân viên kiểm thử',
        sellerId: shopId,
        kioskId: 'kiosk-1',
        kioskName: 'Kiosk HCM 12',
        shopName: 'Shop Hoa Của Tâm',
        status: 'COMPLETED',
        instructions: 'Kiểm tra phản ánh và nạp hoa thay tại ô S04.',
        report: 'Khách đã nhận hoa thay.',
      },
    ];
    await page.route(`**/api/sellers/${shopId}/staff-tasks?*`, (route) =>
      route.fulfill({ json: { items: tasks, page: 1, hasMore: false } }),
    );
    await page.route(`**/api/sellers/${shopId}/staff-delivery-scopes`, (route) =>
      route.fulfill({
        json: [
          {
            sellerId: shopId,
            kioskId: 'kiosk-1',
            kioskName: 'Kiosk HCM 12',
            shopName: 'Shop Hoa Của Tâm',
            address: 'Hòa Lạc, Hà Nội',
          },
        ],
      }),
    );
    await page.goto('/seller/tasks');
    await expect(page.getByRole('table')).toHaveCount(1);
    await expect(page.getByRole('article', { name: /Giao hoa/ })).toHaveCount(0);
    const taskRow = page.getByRole('row').filter({ hasText: 'Giao hoa' });
    await taskRow.getByText('Giao hoa', { exact: true }).click();
    const details = page.getByRole('dialog', { name: 'Công việc: Kiosk HCM 12', exact: true });
    await expect(details).toBeVisible();
    await expect(details).toHaveClass(/management-modal--right/);
    await expect
      .poll(async () =>
        details.evaluate((element) => Math.round(element.getBoundingClientRect().right)),
      )
      .toBe(width);
    expect(
      await details.evaluate((element) => Math.round(element.getBoundingClientRect().height)),
    ).toBe(1000);
    expect(await details.evaluate((element) => element.closest('table') === null)).toBe(true);
    await expect(details.getByRole('button', { name: 'Hủy công việc', exact: true })).toBeVisible();
    await details.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click();
    await expect(details).not.toBeVisible();
    await taskRow.focus();
    await page.keyboard.press('Enter');
    await expect(details).toBeVisible();
    await details.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click();
    await page.locator('#seller-task-search').fill('quality-no-match');
    await expect(page.getByRole('button', { name: 'Xem công việc task-active' })).toHaveCount(0);
    await page.locator('#seller-task-search').fill('');
    await page.getByRole('button', { name: 'Giao việc mới', exact: true }).click();
    const create = page.getByRole('dialog', { name: 'Giao công việc', exact: true });
    await expect(create.getByLabel('Nhân viên phụ trách')).toBeVisible();
    await expect(create.getByLabel('Hướng dẫn công việc')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await create.getByRole('button', { name: 'Đóng hộp thoại', exact: true }).click();
    await page.goto('/seller/staff');
    await expect(page.getByRole('table')).toBeVisible();
    await expect(page.locator('.management-stats, .account-status-tabs')).toHaveCount(0);
    await expect(page.locator('.seller-breadcrumb')).toHaveCount(0);
    await page.getByRole('button', { name: 'Thêm nhân viên shop', exact: true }).click();
    await expect(
      page.getByRole('dialog', { name: 'Thêm nhân viên shop', exact: true }),
    ).toBeVisible();
    const inputHeights = await page
      .getByRole('dialog')
      .locator('input')
      .evaluateAll((inputs) => inputs.map((input) => input.getBoundingClientRect().height));
    expect(inputHeights).toEqual([44, 44, 44, 44]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });

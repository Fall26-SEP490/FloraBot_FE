import { expect, test } from '@playwright/test';
import { setupSellerUsability } from '../fixtures/seller-usability';
import { chooseSelect } from '../fixtures/select';

const resolvedId = '80000000-0000-0000-0000-000000000001';
const openId = '80000000-0000-0000-0000-000000000002';
const customerPhoto = '80000000-0000-0000-0000-000000000003';
const staffPhoto = '80000000-0000-0000-0000-000000000004';
const date = '2026-11-19T04:28:49Z';
const base = {
  id: resolvedId,
  orderId: 'order-1',
  orderCode: 'FB261119-4A8341',
  kioskId: 'kiosk-1',
  status: 'CLOSED',
  handlingState: 'RESOLVED',
  version: 4,
  reason: 'Hoa bị dập, giấy gói bị ướt khi nhận tại tủ.',
  createdAt: date,
  acceptedAt: date,
  outcome: 'REPLACEMENT',
  resolution: 'Đã đổi bó hoa mới và khách xác nhận nhận đủ.',
  resolvedAt: date,
  items: [
    {
      orderItemId: 'item-1',
      name: 'Hoa hồng pastel',
      slotCode: 'S03',
      productId: 'product-1',
      bouquetId: 'bouquet-1',
      slotId: 'slot-1',
    },
  ],
  task: {
    id: 'task-1',
    version: 3,
    status: 'COMPLETED',
    orderItemId: 'item-1',
    instructions: 'Kiểm tra tình trạng và chuẩn bị hoa thay.',
    report: 'Hoa bị dập do vận chuyển. Đã chuẩn bị bó hoa mới.',
  },
  replacement: {
    taskId: 'task-1',
    state: 'COLLECTED',
    productId: 'product-1',
    slotId: 'slot-2',
    slotCode: 'S01',
  },
  evidence: {
    items: [
      {
        id: customerPhoto,
        source: 'COMPLAINT',
        createdAt: date,
        url: `/api/me/complaints/${resolvedId}/evidence/${customerPhoto}`,
      },
      {
        id: staffPhoto,
        source: 'STAFF_TASK',
        createdAt: date,
        url: `/api/me/complaints/${resolvedId}/evidence/${staffPhoto}`,
      },
    ],
    page: 1,
    hasMore: false,
  },
};

for (const width of [1440, 390]) {
  test(`seller quality table and detail panel stay compact at ${width}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 1000 });
    const model = await setupSellerUsability(page);
    let reads = 0,
      writes = 0;
    const rows = [
      base,
      {
        ...base,
        id: openId,
        orderCode: 'FB261120-001',
        status: 'OPEN',
        handlingState: 'REPORTED',
        acceptedAt: null,
        resolution: null,
        resolvedAt: null,
        task: null,
        replacement: null,
        evidence: { items: [], page: 1, hasMore: false },
      },
    ];
    await page.route('**/api/me/complaints**', (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() !== 'GET') {
        writes++;
        return route.fulfill({ status: 405, json: {} });
      }
      if (url.pathname.includes('/evidence/')) {
        reads++;
        return route.fulfill({
          path: 'apps/web/public/images/floral-white-online.webp',
          contentType: 'image/webp',
        });
      }
      if (url.pathname === '/api/me/complaints')
        return route.fulfill({
          json: {
            items: rows.filter(
              (row) =>
                !url.searchParams.get('state') ||
                row.handlingState === url.searchParams.get('state'),
            ),
            page: 1,
            hasMore: false,
          },
        });
      return route.fulfill({ json: url.pathname.includes(openId) ? rows[1] : base });
    });
    await page.goto('/seller/complaints');
    const closed = page.getByRole('button', {
      name: `Xem phản ánh đơn ${base.orderCode}`,
      exact: true,
    });
    await expect(closed).toBeVisible();
    await expect(page.getByRole('region', { name: 'Hồ sơ chất lượng hoa' })).toHaveCSS(
      'padding',
      '0px',
    );
    expect((await closed.boundingBox())!.height).toBeLessThan(width === 390 ? 190 : 110);
    await expect(page.getByRole('button', { name: 'Làm mới hồ sơ', exact: true })).toHaveCount(0);
    await expect(page.getByRole('navigation', { name: 'Vị trí hiện tại' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: testInfo.outputPath(`quality-list-${width}.png`) });
    await page.getByRole('searchbox', { name: 'Tìm phản ánh', exact: true }).fill('khongco');
    await expect(page.getByText('Không tìm thấy phản ánh phù hợp', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
    await chooseSelect(page, 'Trạng thái', 'RESOLVED');
    await expect(
      page.getByRole('button', { name: `Xem phản ánh đơn ${rows[1].orderCode}`, exact: true }),
    ).toHaveCount(0);
    await closed.click();
    const panel = page.getByRole('dialog', { name: `Đơn ${base.orderCode}`, exact: true });
    await expect(
      panel.getByRole('region', { name: 'Phản ánh của khách', exact: true }),
    ).toContainText(base.reason);
    await expect(panel.getByRole('region', { name: 'Quá trình xử lý', exact: true })).toContainText(
      base.resolution,
    );
    await expect(panel.getByRole('region', { name: 'Hoa thay thế', exact: true })).toContainText(
      'S01',
    );
    expect(reads).toBe(0);
    await panel.getByRole('button', { name: 'Xem ảnh khách gửi', exact: true }).click();
    await expect(panel.getByRole('img', { name: 'Ảnh khách gửi', exact: true })).toHaveAttribute(
      'src',
      /^blob:/,
    );
    await panel.getByRole('button', { name: 'Xem ảnh xử lý của nhân viên', exact: true }).click();
    await expect(
      panel.getByRole('img', { name: 'Ảnh xử lý của nhân viên', exact: true }),
    ).toHaveAttribute('src', /^blob:/);
    await panel.evaluate((element) => (element.scrollTop = 0));
    await page.screenshot({ path: testInfo.outputPath(`quality-detail-${width}.png`) });
    await panel.getByRole('button', { name: 'Phóng to ảnh khách gửi', exact: true }).click();
    const photo = page.getByRole('dialog', { name: 'Ảnh khách gửi', exact: true });
    await expect(photo).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(photo).not.toBeVisible();
    await expect(panel).toBeVisible();
    const close = panel.getByRole('button', { name: 'Đóng hộp thoại', exact: true });
    await close.focus();
    await page.keyboard.press('Shift+Tab');
    await expect(
      panel.getByRole('button', { name: 'Phóng to ảnh xử lý của nhân viên', exact: true }),
    ).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(close).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(panel).toHaveCount(0);
    await expect(closed).toBeFocused();
    await page.getByRole('button', { name: 'Xóa bộ lọc', exact: true }).click();
    await page
      .getByRole('button', { name: `Xem phản ánh đơn ${rows[1].orderCode}`, exact: true })
      .click();
    await expect(
      page.getByRole('button', { name: 'Tiếp nhận phản ánh', exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath(`quality-reported-${width}.png`) });
    expect(reads).toBe(2);
    expect(writes).toBe(0);
    expect(model.writes).toEqual([]);
  });
}

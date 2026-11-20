import { test, expect } from '@playwright/test';
import { setupSellerUsability } from '../fixtures/seller-usability';
import { chooseOption } from '../fixtures/select';

const id = '80000000-0000-0000-0000-000000000001';
const base = {
  id,
  orderCode: 'FB261120-4A8341',
  orderId: 'order-1',
  kioskId: 'kiosk-1',
  status: 'OPEN',
  version: 1,
  handlingState: 'REPORTED',
  reason:
    'Bó hoa bị dập cánh và giấy gói bị ướt khi nhận tại tủ. Mong shop kiểm tra và hỗ trợ đổi hoa.',
  createdAt: '2026-11-20T02:15:00Z',
  acceptedAt: null,
  outcome: null,
  resolution: null,
  resolvedAt: null,
  items: [{ orderItemId: 'item-1', name: 'Bó hồng pastel · 18 bông', slotCode: 'S03' }],
  task: null,
  replacement: null,
  evidence: { items: [], page: 1, hasMore: false },
};
const task = {
  id: 'task-1',
  version: 2,
  status: 'IN_PROGRESS',
  orderItemId: 'item-1',
  instructions:
    'Kiểm tra tình trạng hoa theo phản ánh. Liên hệ khách để xác nhận và chuẩn bị hoa thay nếu cần.',
  report: null,
};
const report =
  'Đã kiểm tra ảnh và trao đổi với khách. Hoa bị dập trong quá trình vận chuyển. Shop chuẩn bị bó hồng cùng loại để thay thế.';
const replacement = {
  taskId: 'task-1',
  productId: 'product-1',
  slotId: 'slot-1',
  slotCode: 'S04',
  state: 'PLANNED',
  expiresAt: '2026-11-21T02:15:00Z',
};
const accepted = { acceptedAt: '2026-11-20T02:30:00Z' };
const stages = [
  { name: '01-tiep-nhan', title: 'Chờ tiếp nhận', data: {}, action: 'Tiếp nhận phản ánh' },
  {
    name: '02-giao-viec',
    title: 'Giao nhân viên',
    data: { ...accepted, handlingState: 'ACCEPTED' },
    action: 'Giao nhân viên',
  },
  {
    name: '03-dang-kiem-tra',
    title: 'Nhân viên kiểm tra',
    data: { ...accepted, handlingState: 'IN_PROGRESS', task },
    action: 'Chọn hoa thay và ô tủ',
  },
  {
    name: '04-cho-nap-hoa',
    title: 'Chờ nạp hoa thay',
    data: { ...accepted, handlingState: 'IN_PROGRESS', task, replacement },
  },
  {
    name: '05-duyet-bao-cao',
    title: 'Duyệt báo cáo',
    data: {
      ...accepted,
      handlingState: 'REVIEW_REQUIRED',
      task: { ...task, status: 'SUBMITTED', report },
    },
    action: 'Duyệt báo cáo',
  },
  {
    name: '06-duyet-doi-hoa',
    title: 'Duyệt hoa đã nạp',
    data: {
      ...accepted,
      handlingState: 'REVIEW_REQUIRED',
      task: { ...task, status: 'SUBMITTED', report },
      replacement: { ...replacement, state: 'LOADED' },
    },
    action: 'Duyệt báo cáo',
  },
  {
    name: '07-cho-khach-nhan',
    title: 'Chờ khách nhận',
    data: {
      ...accepted,
      handlingState: 'REPLACEMENT_READY',
      task: { ...task, status: 'COMPLETED', report },
      replacement: { ...replacement, state: 'READY' },
      outcome: 'REPLACEMENT',
    },
  },
  {
    name: '08-da-nhan',
    title: 'Khách đã nhận hoa',
    data: {
      ...accepted,
      status: 'RESOLVED_FIXED',
      handlingState: 'RESOLVED',
      task: { ...task, status: 'COMPLETED', report },
      replacement: { ...replacement, state: 'COLLECTED' },
      outcome: 'REPLACEMENT',
      resolution: 'Khách đã nhận bó hoa thay và xác nhận đầy đủ.',
      resolvedAt: '2026-11-20T05:00:00Z',
    },
  },
  {
    name: '09-xet-hoan-tien',
    title: 'Chờ xét hoàn tiền',
    data: {
      ...accepted,
      handlingState: 'REFUND_REVIEW',
      task: { ...task, status: 'COMPLETED', report },
      outcome: 'REFUND_REVIEW',
      resolution: 'Khách đề nghị hoàn tiền. Đã chuyển hồ sơ để quản trị viên xét duyệt.',
    },
  },
  {
    name: '10-can-xu-ly-tiep',
    title: 'Hoa thay hết hạn',
    data: {
      ...accepted,
      handlingState: 'ATTENTION_REQUIRED',
      task: { ...task, status: 'COMPLETED', report },
      replacement: { ...replacement, state: 'EXPIRED' },
    },
  },
];

for (const width of [1440, 390])
  test(`review and capture seller quality stages at ${width}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width, height: 1080 });
    await setupSellerUsability(page);
    let current: object = base;
    await page.route('**/api/me/complaints?*', (r) =>
      r.fulfill({ json: { items: [current], page: 1, hasMore: false } }),
    );
    await page.route(`**/api/me/complaints/${id}?*`, (r) => r.fulfill({ json: current }));
    await page.route('**/api/sellers/*/staff', (r) =>
      r.fulfill({ json: [{ id: 'staff-1', name: 'Nguyễn Minh Anh' }] }),
    );
    await page.route('**/api/me/products', (r) =>
      r.fulfill({
        json: [
          { id: 'product-1', name: 'Bó hồng pastel · 18 bông', status: 'ACTIVE', quantity: 3 },
        ],
      }),
    );
    await page.route('**/api/me/kiosks/kiosk-1/slots', (r) =>
      r.fulfill({
        json: [
          {
            id: 'slot-1',
            kioskId: 'kiosk-1',
            slotCode: 'S04',
            zone: 'PREORDER',
            status: 'RENTED_EMPTY',
            sensorReady: true,
          },
        ],
      }),
    );
    for (const stage of stages) {
      current = { ...base, ...stage.data };
      await page.goto('/seller/complaints');
      await page
        .getByRole('button', { name: `Xem phản ánh đơn ${base.orderCode}`, exact: true })
        .click();
      const panel = page.getByRole('dialog', { name: `Đơn ${base.orderCode}`, exact: true });
      await expect(panel.getByRole('region', { name: 'Phản ánh của khách' })).toBeVisible();
      await expect
        .poll(async () => {
          const box = await panel.boundingBox();
          return box ? Math.abs(box.x + box.width - width) : 999;
        })
        .toBeLessThan(2);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
      await page.screenshot({ path: `test-results/quality-review/${stage.name}-${width}.png` });
      if (stage.action) {
        await panel.getByRole('button', { name: stage.action, exact: true }).click();
        const form = panel.locator('form');
        if (stage.action === 'Giao nhân viên') {
          await chooseOption(
            form.getByRole('combobox', { name: 'Nhân viên', exact: true }),
            'staff-1',
          );
          await form
            .locator('textarea')
            .fill('Kiểm tra hoa bị dập và chuẩn bị phương án hỗ trợ khách.');
        } else if (stage.action === 'Chọn hoa thay và ô tủ') {
          await chooseOption(
            form.getByRole('combobox', { name: 'Mẫu hoa còn tồn', exact: true }),
            'product-1',
          );
          await chooseOption(
            form.getByRole('combobox', { name: 'Ô trống tại kiosk gốc', exact: true }),
            'slot-1',
          );
        } else if (stage.action === 'Duyệt báo cáo') {
          await chooseOption(
            form.getByRole('combobox', { name: 'Kết quả xử lý', exact: true }),
            stage.name === '06-duyet-doi-hoa' ? 'REPLACEMENT' : 'EXPLANATION',
          );
          await form
            .locator('textarea')
            .fill(
              stage.name === '06-duyet-doi-hoa'
                ? 'Shop đã chuẩn bị hoa thay. Khách dùng biên nhận cũ để nhận tại ô S04.'
                : 'Đã kiểm tra và trao đổi kết quả xử lý với khách.',
            );
        }
        await form.scrollIntoViewIfNeeded();
        await expect(form).toBeVisible();
        await page.screenshot({
          path: `test-results/quality-review/${stage.name}-form-${width}.png`,
        });
      }
    }
  });

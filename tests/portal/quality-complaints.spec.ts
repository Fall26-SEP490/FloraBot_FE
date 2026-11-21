import { chooseOption } from '../fixtures/select';
import { expect, test, type Page } from '@playwright/test';

const id = '80000000-0000-0000-0000-000000000001';
const orderId = '80000000-0000-0000-0000-000000000002';
const itemId = '80000000-0000-0000-0000-000000000003';
const photoId = '80000000-0000-0000-0000-000000000004';
const kioskId = '80000000-0000-0000-0000-000000000005';
const token = 'ABCD2345';
const date = '2030-10-10T03:00:00Z';
const detail = {
  id,
  orderId,
  orderCode: 'FB-QUALITY',
  kioskId,
  status: 'OPEN',
  handlingState: 'REPORTED',
  version: 1,
  reason: 'Bó hoa bị dập sau khi nhận.',
  createdAt: date,
  acceptedAt: null as string | null,
  outcome: null as string | null,
  resolution: null as string | null,
  resolvedAt: null,
  items: [{ orderItemId: itemId, name: 'Bó cúc trắng', slotCode: 'A01' }],
  task: null as null | {
    id: string;
    version: number;
    status: string;
    orderItemId: string;
    instructions: string;
    report: string | null;
  },
  replacement: null as null | {
    taskId: string;
    state: string;
    productId: string;
    slotId: string;
    slotCode: string;
  },
  evidence: { items: [], page: 1, hasMore: false },
};

async function role(page: Page, name: 'SELLER' | 'SELLER_STAFF' | 'ADMIN' | 'CUSTOMER') {
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    if (new URL(route.request().url()).pathname === '/api/auth/me')
      return route.fulfill({
        json: {
          id: 'actor',
          role: name,
          name: 'Minh Anh',
          sellerId: 'seller',
          sellerStatus: 'ACTIVE',
        },
      });
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
}

test('Customer reads the outcome and retries a private image with capability only in its POST body', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await role(page, 'CUSTOMER');
  const photoPath = `/api/receipts/complaints/${id}/evidence/${photoId}`;
  await page.route('**/api/receipts/lookup', (route) =>
    route.fulfill({
      json: {
        orderId,
        orderCode: detail.orderCode,
        status: 'DISPUTED',
        createdAt: date,
        completedAt: date,
        hasComplaint: true,
        canComplain: false,
        total: 300000,
        subtotal: 300000,
        discount: 0,
        items: [],
        refunds: { pendingAmount: 0, paidAmount: 0 },
      },
    }),
  );
  await page.route('**/api/receipts/complaints/lookup?*', (route) => {
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ orderId, trackingToken: token });
    expect(route.request().url()).not.toContain(token);
    return route.fulfill({
      json: {
        ...detail,
        handlingState: 'REFUND_REVIEW',
        outcome: 'REFUND_REVIEW',
        resolution: 'Shop đã chuyển hồ sơ cho admin.',
        evidence: {
          items: [{ id: photoId, url: photoPath, source: 'COMPLAINT', createdAt: date }],
          page: 1,
          hasMore: false,
        },
      },
    });
  });
  let reads = 0;
  await page.route(`**${photoPath}`, (route) => {
    reads++;
    expect(route.request().method()).toBe('POST');
    expect(route.request().postDataJSON()).toEqual({ orderId, trackingToken: token });
    return reads === 1
      ? route.fulfill({ status: 503 })
      : route.fulfill({
          path: 'apps/web/public/images/floral-white-online.webp',
          contentType: 'image/webp',
        });
  });
  await page.goto(`/receipt#order=${orderId}&token=${token}`);
  const link = page.getByRole('link', { name: 'Theo dõi phản ánh' });
  await expect(link).toHaveAttribute('href', '/phan-anh');
  await link.click();
  await expect(page.getByText('Chờ xét duyệt hoàn tiền', { exact: true })).toBeVisible();
  await expect(page.getByText('Khoản hoàn chưa được chi.', { exact: false })).toBeVisible();
  expect(page.url()).not.toContain(token);
  expect(reads).toBe(0);
  await page.getByText('Ảnh minh chứng', { exact: true }).click();
  await page.getByRole('button', { name: 'Xem ảnh' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Chưa tải được ảnh' })).toBeVisible();
  await page.getByRole('button', { name: 'Thử tải lại ảnh' }).click();
  await expect(page.getByRole('img', { name: 'Ảnh khách gửi' })).toHaveAttribute('src', /^blob:/);
});

test('Seller accepts, assigns, returns a report and escalates with server versions', async ({
  page,
}) => {
  await role(page, 'SELLER');
  let current = { ...detail };
  const writes: string[] = [];
  await page.route('**/api/sellers/seller/staff', (route) =>
    route.fulfill({ json: [{ id: 'staff', name: 'Thảo' }] }),
  );
  await page.route('**/api/me/complaints?*', (route) =>
    route.fulfill({ json: { items: [current], page: 1, hasMore: false } }),
  );
  await page.route(`**/api/me/complaints/${id}**`, (route) => {
    if (route.request().method() === 'GET') return route.fulfill({ json: current });
    const path = new URL(route.request().url()).pathname.split('/').pop()!;
    const body = route.request().postDataJSON();
    expect(body.version).toBe(current.version);
    writes.push(path);
    if (path === 'accept')
      current = { ...current, version: 4, acceptedAt: date, handlingState: 'ACCEPTED' };
    if (path === 'assignment') {
      expect(body).toMatchObject({
        assigneeId: 'staff',
        orderItemId: itemId,
        taskId: expect.stringMatching(/^[a-f0-9-]{36}$/),
      });
      current = {
        ...current,
        version: 8,
        handlingState: 'REVIEW_REQUIRED',
        task: {
          id: body.taskId,
          version: 3,
          status: 'SUBMITTED',
          orderItemId: itemId,
          instructions: body.instructions,
          report: 'Đã kiểm tra và gửi kết quả xử lý.',
        },
      };
    }
    if (path === 'review') {
      expect(body.taskVersion).toBe(current.task!.version);
      current =
        body.outcome === 'RETURN'
          ? { ...current, version: 12, task: { ...current.task!, version: 5 } }
          : {
              ...current,
              version: 16,
              task: { ...current.task!, version: 6, status: 'COMPLETED' },
              handlingState: 'REFUND_REVIEW',
              outcome: body.outcome,
              resolution: body.resolution,
            };
    }
    return route.fulfill({ json: { version: current.version } });
  });
  await page.goto('/seller/complaints');
  await page.getByRole('button', { name: 'Xem phản ánh đơn FB-QUALITY', exact: true }).click();
  await page.getByRole('button', { name: 'Tiếp nhận phản ánh' }).click();
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  await page.getByRole('button', { name: 'Giao nhân viên' }).click();
  await chooseOption(page.getByRole('combobox', { name: 'Nhân viên', exact: true }), 'staff');
  await page.getByLabel('Hướng dẫn nhân viên').fill('Kiểm tra tình trạng bó hoa và báo cáo.');
  await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  for (const outcome of ['RETURN', 'REFUND_REVIEW']) {
    await page.getByRole('button', { name: 'Duyệt báo cáo' }).click();
    await chooseOption(page.getByLabel('Kết quả xử lý'), outcome);
    await page.getByLabel('Nội dung phản hồi').fill('Đã đối chiếu thông tin phản ánh của khách.');
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
  }
  await expect(page.getByText('Khoản hoàn chưa được chi.', { exact: false })).toBeVisible();
  expect(writes).toEqual(['accept', 'assignment', 'review', 'review']);
});

for (const zone of ['WALK_IN', 'PREORDER']) {
  test(`Seller plans a replacement in an eligible ${zone} slot and cancels it with the latest version`, async ({
    page,
  }) => {
    await role(page, 'SELLER');
    const taskId = '80000000-0000-0000-0000-000000000006';
    const productId = '80000000-0000-0000-0000-000000000007';
    const slotId = '80000000-0000-0000-0000-000000000008';
    let current = {
      ...detail,
      acceptedAt: date,
      handlingState: 'IN_PROGRESS',
      task: {
        id: taskId,
        version: 2,
        status: 'IN_PROGRESS',
        orderItemId: itemId,
        instructions: 'Kiểm tra và chuẩn bị hoa thay.',
        report: null as string | null,
      },
    };
    await page.route('**/api/me/complaints?*', (route) =>
      route.fulfill({ json: { items: [current], page: 1, hasMore: false } }),
    );
    await page.route('**/api/me/products', (route) =>
      route.fulfill({
        json: [
          { id: productId, name: 'Bó cúc vàng', status: 'ACTIVE', quantity: 2 },
          { id: 'sold-out', name: 'Hoa hồng hết hàng', status: 'ACTIVE', quantity: 0 },
        ],
      }),
    );
    await page.route(`**/api/me/kiosks/${kioskId}/slots`, (route) =>
      route.fulfill({
        json: [
          {
            id: slotId,
            slotCode: 'A02',
            kioskId,
            zone,
            status: 'RENTED_EMPTY',
            sensorReady: true,
          },
          {
            id: 'held-preorder',
            slotCode: 'P01',
            kioskId,
            zone: 'PREORDER',
            status: 'HELD',
            sensorReady: true,
            holdOrderId: 'another-order',
          },
          {
            id: 'unmonitored-preorder',
            slotCode: 'P02',
            kioskId,
            zone: 'PREORDER',
            status: 'RENTED_EMPTY',
            sensorReady: false,
          },
          {
            id: 'busy-preorder',
            slotCode: 'P03',
            kioskId,
            zone: 'PREORDER',
            status: 'STOCKED',
            sensorReady: true,
            bouquetId: 'another-bouquet',
          },
        ],
      }),
    );
    await page.route(`**/api/me/complaints/${id}**`, (route) => {
      if (route.request().method() === 'GET') return route.fulfill({ json: current });
      const path = new URL(route.request().url()).pathname;
      const body = route.request().postDataJSON();
      if (path.endsWith('/replacement-plan')) {
        expect(body).toEqual({ version: 1, taskVersion: 2, productId, slotId });
        current = {
          ...current,
          version: 3,
          handlingState: 'REVIEW_REQUIRED',
          task: { ...current.task, status: 'SUBMITTED', version: 4, report: 'Đã kiểm tra bó hoa.' },
          replacement: { taskId, productId, slotId, slotCode: 'A02', state: 'PLANNED' },
        };
      } else {
        expect(path.endsWith('/replacement/cancel')).toBe(true);
        expect(body).toEqual({ version: 3, reason: 'Shop không còn mẫu hoa thay phù hợp.' });
        current = {
          ...current,
          version: 5,
          replacement: { ...current.replacement!, state: 'CANCELLED' },
        };
      }
      return route.fulfill({ json: { version: current.version } });
    });
    await page.goto('/seller/complaints');
    await page.getByRole('button', { name: 'Xem phản ánh đơn FB-QUALITY', exact: true }).click();
    await page.getByRole('button', { name: 'Chọn hoa thay và ô tủ' }).click();
    const products = page.getByRole('combobox', { name: 'Mẫu hoa còn tồn', exact: true });
    const slots = page.getByRole('combobox', { name: 'Ô trống tại kiosk gốc', exact: true });
    await chooseOption(products, productId);
    await chooseOption(slots, slotId);
    await expect(products.locator('option[value="sold-out"]')).toHaveCount(0);
    for (const rejected of ['held-preorder', 'unmonitored-preorder', 'busy-preorder'])
      await expect(slots.locator(`option[value="${rejected}"]`)).toHaveCount(0);
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await page.getByRole('button', { name: 'Duyệt báo cáo' }).click();
    await expect(page.locator('option[value="REPLACEMENT"][disabled]')).toHaveCount(1);
    const cancel = page.getByRole('button', { name: 'Hủy phương án hoa thay' });
    await cancel.click();
    await page.getByLabel('Lý do hủy').fill('Shop không còn mẫu hoa thay phù hợp.');
    await page.getByRole('button', { name: 'Xác nhận', exact: true }).click();
    await expect(cancel).toHaveCount(0);
  });
}
test('Staff submits a quality report without photo or general stocking actions', async ({
  page,
}) => {
  await role(page, 'SELLER_STAFF');
  let status = 'IN_PROGRESS';
  await page.route('**/api/staff/tasks?*', (route) => {
    const lane = new URL(route.request().url()).searchParams.get('status');
    return route.fulfill({
      json: {
        page: 1,
        hasMore: false,
        items:
          lane === status
            ? [
                {
                  id: 'task',
                  kind: 'DELIVERY',
                  workType: 'FLOWER_QUALITY',
                  complaintId: id,
                  version: status === 'IN_PROGRESS' ? 2 : 3,
                  status,
                  instructions: 'Kiểm tra chất lượng bó hoa.',
                  kioskName: 'Kiosk gốc',
                  assigneeName: 'Thảo',
                },
              ]
            : [],
      },
    });
  });
  await page.route('**/api/staff/tasks/task/inventory-maintenance', (route) =>
    route.fulfill({ status: 404 }),
  );
  await page.route('**/api/staff/tasks/task/quality?*', (route) =>
    route.fulfill({ json: { ...detail, handlingState: 'IN_PROGRESS' } }),
  );
  await page.route('**/api/staff/tasks/task/transition', (route) => {
    expect(route.request().postDataJSON()).toEqual({
      version: 2,
      status: 'SUBMITTED',
      report: 'Đã kiểm tra bó hoa theo phản ánh.',
    });
    status = 'SUBMITTED';
    return route.fulfill({ json: {} });
  });
  await page.goto('/staff');
  await page.locator('.staff-task-open').click();
  await expect(page.getByText(detail.reason, { exact: true })).toBeVisible();
  await expect(page.getByText('Nạp hoa bán tại tủ', { exact: true })).toHaveCount(0);
  await page.getByText('Viết báo cáo', { exact: true }).click();
  await page.locator('textarea[id^=report-]').fill('Đã kiểm tra bó hoa theo phản ánh.');
  await page.getByRole('button', { name: 'Gửi báo cáo', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Chờ chủ shop duyệt' })).toBeVisible();
});

test('staff enters replacement loading OTP on web for the assigned quality task', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await role(page, 'SELLER_STAFF');
  await page.route('**/api/staff/tasks?*', (route) =>
    route.fulfill({
      json: {
        page: 1,
        hasMore: false,
        items: [
          {
            id: 'task',
            kind: 'DELIVERY',
            workType: 'FLOWER_QUALITY',
            complaintId: id,
            version: 2,
            status: 'IN_PROGRESS',
            instructions: 'Nạp bó hoa thay thế theo phản ánh.',
            kioskName: 'Kiosk gốc',
            assigneeName: 'Thảo',
          },
        ],
      },
    }),
  );
  await page.route('**/api/staff/tasks/task/quality?*', (route) =>
    route.fulfill({
      json: {
        ...detail,
        handlingState: 'IN_PROGRESS',
        replacement: {
          state: 'PLANNED',
          taskId: 'task',
          productId: 'flower',
          slotId: 'slot',
          slotCode: 'P01',
        },
      },
    }),
  );
  let opened = false;
  await page.route('**/api/staff/tasks/task/inventory-maintenance', (route) =>
    route.fulfill({
      json: {
        kioskId,
        slotId: 'slot',
        slotCode: 'P01',
        action: 'LOAD',
        status: 'IN_PROGRESS',
        sessionStage: opened ? 'Loading' : null,
        sessionSubstate: null,
      },
    }),
  );
  await page.route('**/api/staff/tasks/task/inventory-maintenance/access', (route) => {
    expect(route.request().postDataJSON()).toEqual({ operation: 'START', reason: null });
    return route.fulfill({
      json: {
        id: 'replacement-code',
        code: '012345',
        expiresAt: new Date(Date.now() + 120_000).toISOString(),
      },
    });
  });
  await page.route('**/api/me/maintenance-access/replacement-code/confirm', (route) => {
    expect(route.request().postDataJSON()).toEqual({ code: '012345' });
    opened = true;
    return route.fulfill({ json: { status: 'ACCEPTED' } });
  });
  await page.goto('/staff');
  await page.locator('.staff-task-open').first().click();
  await page.getByRole('button', { name: 'Lấy mã mở ô', exact: true }).click();
  await page.getByLabel('Mã OTP 6 số').fill('012345');
  await page.getByRole('button', { name: 'Xác nhận mở ô', exact: true }).click();
  await expect(page.getByText('Đã gửi lệnh mở ô. Chờ tủ phản hồi.')).toBeVisible();
  expect(opened).toBe(true);
});

test('Admin opens a REFUND_REVIEW case with the staff report and the existing decision entry', async ({
  page,
}) => {
  await role(page, 'ADMIN');
  const escalated = {
    ...detail,
    handlingState: 'REFUND_REVIEW',
    outcome: 'REFUND_REVIEW',
    task: {
      status: 'COMPLETED',
      instructions: 'Kiểm tra bó hoa.',
      report: 'Nhân viên xác nhận hoa bị dập.',
    },
  };
  await page.route('**/api/admin/quality-complaints?*', (route) => {
    expect(new URL(route.request().url()).searchParams.get('state')).toBe('REFUND_REVIEW');
    return route.fulfill({ json: { items: [escalated], page: 1, hasMore: false } });
  });
  await page.route(`**/api/admin/quality-complaints/${id}?*`, (route) =>
    route.fulfill({ json: escalated }),
  );
  await page.goto('/admin/complaints');
  await page.getByRole('button', { name: 'Hồ sơ chất lượng hoa' }).click();
  await page.getByText(/^Đơn FB-QUALITY ·/).click();
  await expect(page.getByText('Nhân viên xác nhận hoa bị dập.', { exact: false })).toBeVisible();
  await expect(page.getByText('Mở quyết định hoàn tiền', { exact: true })).toBeVisible();
});

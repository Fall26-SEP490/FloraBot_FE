import { expect, test } from '@playwright/test';
import { randomBytes, randomInt, randomUUID } from 'node:crypto';
import {
  createPreorderFixture,
  createRoleTaskFixture,
  loginAccount,
  registerCustomer,
  sql,
} from './role-workflows-helpers';

test.describe('FloraBot Role Workflows Integration', () => {
  test('Workflow 1: Customer creates custom preorder by UI, seller quotes by UI, customer accepts to pending-payment, with consistent cancellation and refusal states', async ({
    page,
  }) => {
    test.setTimeout(300_000);

    // 1. Dedicated fixture setup in disposable florabot_browser_tests
    const fixture = createPreorderFixture();

    const customerEmail = `cust-${randomUUID()}@example.invalid`;
    const customerPassword = randomBytes(24).toString('base64url');
    const customerName = `Khách Hàng Mẫu Riêng ${randomInt(100, 999)}`;

    // 2. Customer registers via public /dang-ky UI with 429 rate pacing resilience
    await registerCustomer(page, {
      fullName: customerName,
      email: customerEmail,
      password: customerPassword,
    });
    await expect(page.getByRole('heading', { name: 'Đơn đặt hoa của bạn' })).toBeVisible();

    // Compute future pickup date (3 days ahead within valid 2h-30d range)
    const pickupDate = new Date(Date.now() + 3 * 86_400_000);
    const pickupStr = new Date(pickupDate.getTime() - pickupDate.getTimezoneOffset() * 60_000)
      .toISOString()
      .slice(0, 16);

    // Fast prerequisite check: ensure artificial flower product is sellable and indexed in catalog
    const encodedFlowerName = encodeURIComponent(fixture.flowerName);
    const catalogCheck = await page.request.get(`/api/shop/catalog?search=${encodedFlowerName}`);
    expect(catalogCheck.status()).toBe(200);
    const catalogPayload = (await catalogCheck.json()) as { items: { productId: string }[] };
    expect(
      catalogPayload.items.some((item) => item.productId === fixture.productId),
      'Fixture artificial flower must be sellable in catalog',
    ).toBe(true);

    // 3. Customer places Order 1 (CUSTOM kind) by UI for quoting
    await page.goto('/dat-hoa');
    await page.getByLabel('Tìm mẫu hoa, shop hoặc tủ nhận').fill(fixture.flowerName);
    await page.getByRole('button', { name: 'Tìm hoa', exact: true }).click();
    const catalogItem1 = page.locator('.flower-catalog li').filter({ hasText: fixture.flowerName });
    await catalogItem1.getByRole('button', { name: 'Chọn mẫu và cách nhận' }).click();

    await page.getByLabel('Thời gian mong muốn nhận hoa').fill(pickupStr);
    await page
      .getByLabel('Dịp tặng, màu hoa, ngân sách và lời nhắn')
      .fill('Hoa lụa vàng đồng chúc mừng khai trương sang trọng, ngân sách 500.000 đ');
    await page.getByRole('checkbox').check();

    const preorder1Req = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/member/preorders') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Gửi yêu cầu để shop báo giá', exact: true }).click();
    const preorder1Res = await preorder1Req;
    expect(preorder1Res.status()).toBe(200);
    const preorder1Id = ((await preorder1Res.json()) as { result: string }).result;
    expect(preorder1Id).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: 'Đã nhận yêu cầu của bạn' })).toBeVisible();

    // 4. Customer places Order 2 (CUSTOM kind) to verify seller refusal/rejection consistency
    await page.goto('/dat-hoa');
    await page.getByLabel('Tìm mẫu hoa, shop hoặc tủ nhận').fill(fixture.flowerName);
    await page.getByRole('button', { name: 'Tìm hoa', exact: true }).click();
    const catalogItem2 = page.locator('.flower-catalog li').filter({ hasText: fixture.flowerName });
    await catalogItem2.getByRole('button', { name: 'Chọn mẫu và cách nhận' }).click();

    await page.getByLabel('Thời gian mong muốn nhận hoa').fill(pickupStr);
    await page
      .getByLabel('Dịp tặng, màu hoa, ngân sách và lời nhắn')
      .fill('Đơn hoa mẫu riêng thứ hai để kiểm tra từ chối báo giá');
    await page.getByRole('checkbox').check();

    const preorder2Req = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/member/preorders') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Gửi yêu cầu để shop báo giá', exact: true }).click();
    const preorder2Res = await preorder2Req;
    expect(preorder2Res.status()).toBe(200);
    const preorder2Id = ((await preorder2Res.json()) as { result: string }).result;
    expect(preorder2Id).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: 'Đã nhận yêu cầu của bạn' })).toBeVisible();

    // 5. Customer places Order 3 (CUSTOM kind) to verify customer self-cancellation
    await page.goto('/dat-hoa');
    await page.getByLabel('Tìm mẫu hoa, shop hoặc tủ nhận').fill(fixture.flowerName);
    await page.getByRole('button', { name: 'Tìm hoa', exact: true }).click();
    const catalogItem3 = page.locator('.flower-catalog li').filter({ hasText: fixture.flowerName });
    await catalogItem3.getByRole('button', { name: 'Chọn mẫu và cách nhận' }).click();

    await page.getByLabel('Thời gian mong muốn nhận hoa').fill(pickupStr);
    await page
      .getByLabel('Dịp tặng, màu hoa, ngân sách và lời nhắn')
      .fill('Đơn hoa mẫu riêng thứ ba để kiểm tra khách tự hủy yêu cầu');
    await page.getByRole('checkbox').check();

    const preorder3Req = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/member/preorders') && response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Gửi yêu cầu để shop báo giá', exact: true }).click();
    const preorder3Res = await preorder3Req;
    expect(preorder3Res.status()).toBe(200);
    const preorder3Id = ((await preorder3Res.json()) as { result: string }).result;
    expect(preorder3Id).toMatch(/^[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { name: 'Đã nhận yêu cầu của bạn' })).toBeVisible();

    // 6. Customer cancels Order 3 before quote via /tai-khoan
    await page.goto('/tai-khoan');
    const row3 = page.locator('.member-orders li').filter({ hasText: preorder3Id.slice(0, 8) });
    await row3.locator('summary').click();
    await row3.getByRole('button', { name: 'Hủy yêu cầu' }).click();
    await row3.getByLabel('Lý do hủy').fill('Khách đổi kế hoạch không cần nhận hoa nữa');
    await row3.getByLabel('Tôi đã đối chiếu và xác nhận thông tin trên.').check();

    const cancelReq = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/member/preorders/${preorder3Id}/cancel`) &&
        response.request().method() === 'POST',
    );
    await row3.getByRole('button', { name: 'Xác nhận gửi' }).click();
    expect((await cancelReq).status()).toBe(200);
    await expect(row3.locator('summary')).toContainText('Đã hủy');

    // Customer logs out
    await page.getByRole('button', { name: 'Đăng xuất' }).click();
    await expect(page).toHaveURL(/\/dang-nhap$/);

    // 7. Seller logs in and views /seller/orders
    await loginAccount(page, {
      email: fixture.sellerEmail,
      password: fixture.sellerPassword,
      loginPath: '/dang-nhap',
      expectedUrl: /\/seller$/,
      submitEndpoint: '/api/auth/login',
    });

    await page.goto('/seller/orders');
    await expect(page.getByRole('heading', { name: 'Đơn đặt trước từ website' })).toBeVisible();

    // 8. Seller quotes Order 1 by UI
    const sellerRow1 = page
      .locator('.member-orders li')
      .filter({ hasText: preorder1Id.slice(0, 8) });
    await sellerRow1.locator('summary').click();
    await sellerRow1.getByRole('button', { name: 'Báo giá hoặc từ chối' }).click();
    await sellerRow1.getByLabel('Giá trọn gói (đồng)').fill('500000');
    await sellerRow1.getByLabel('Giờ bắt đầu nhận').fill(pickupStr);
    await sellerRow1
      .getByLabel('Mô tả mẫu hoa, điều kiện hoặc lý do từ chối')
      .fill('Shop đồng ý thực hiện hoa lụa vàng đồng theo yêu cầu');
    await sellerRow1.getByLabel('Tôi đã đối chiếu và xác nhận thông tin trên.').check();

    const quoteReq = page.waitForResponse(
      (response) =>
        response.url().includes(`/preorders/${preorder1Id}/quote`) &&
        response.request().method() === 'POST',
    );
    await sellerRow1.getByRole('button', { name: 'Xác nhận gửi' }).click();
    expect((await quoteReq).status()).toBe(200);
    await expect(sellerRow1.locator('summary')).toContainText('Đã có báo giá');

    // 9. Seller rejects Order 2 by UI (checking "Shop chưa thể nhận đơn này")
    const sellerRow2 = page
      .locator('.member-orders li')
      .filter({ hasText: preorder2Id.slice(0, 8) });
    await sellerRow2.locator('summary').click();
    await sellerRow2.getByRole('button', { name: 'Báo giá hoặc từ chối' }).click();
    await sellerRow2.getByLabel('Shop chưa thể nhận đơn này').check();
    await sellerRow2
      .getByLabel('Mô tả mẫu hoa, điều kiện hoặc lý do từ chối')
      .fill('Shop hiện đã hết phụ kiện và bình cho mẫu hoa lụa này');
    await sellerRow2.getByLabel('Tôi đã đối chiếu và xác nhận thông tin trên.').check();

    const rejectReq = page.waitForResponse(
      (response) =>
        response.url().includes(`/preorders/${preorder2Id}/quote`) &&
        response.request().method() === 'POST',
    );
    await sellerRow2.getByRole('button', { name: 'Xác nhận gửi' }).click();
    expect((await rejectReq).status()).toBe(200);
    await expect(sellerRow2.locator('summary')).toContainText('Shop chưa thể nhận đơn');

    // Verify Order 3 on seller view consistently displays "Đã hủy"
    const sellerRow3 = page
      .locator('.member-orders li')
      .filter({ hasText: preorder3Id.slice(0, 8) });
    await expect(sellerRow3.locator('summary')).toContainText('Đã hủy');

    // Seller logs out
    await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
    await expect(page).toHaveURL(/\/dang-nhap$/);

    // 10. Customer logs back in to review, verify rejection and accept quoted Order 1
    await loginAccount(page, {
      email: customerEmail,
      password: customerPassword,
      loginPath: '/dang-nhap',
      expectedUrl: /\/tai-khoan$/,
      submitEndpoint: '/api/auth/login',
    });

    const custRow2 = page.locator('.member-orders li').filter({ hasText: preorder2Id.slice(0, 8) });
    await expect(custRow2.locator('summary')).toContainText('Shop chưa thể nhận đơn');

    const custRow3 = page.locator('.member-orders li').filter({ hasText: preorder3Id.slice(0, 8) });
    await expect(custRow3.locator('summary')).toContainText('Đã hủy');

    const custRow1 = page.locator('.member-orders li').filter({ hasText: preorder1Id.slice(0, 8) });
    await expect(custRow1.locator('summary')).toContainText('Đã có báo giá');
    await custRow1.locator('summary').click();
    await expect(custRow1.locator('.bank-summary')).toContainText('500.000 đ');

    // Customer accepts the quote to transition to AWAITING_PAYMENT (pending-payment)
    await custRow1.getByRole('button', { name: 'Kiểm tra báo giá' }).click();
    await custRow1.getByLabel('Tôi đã đối chiếu và xác nhận thông tin trên.').check();

    const acceptReq = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/member/preorders/${preorder1Id}/accept`) &&
        response.request().method() === 'POST',
    );
    await custRow1.getByRole('button', { name: 'Xác nhận gửi' }).click();
    expect((await acceptReq).status()).toBe(200);

    // Assert order state is AWAITING_PAYMENT (Chờ thanh toán). Stop before provider payment.
    // Acceptance replaces the displayed request reference with the new order code.
    const refreshed = await page.request.get('/api/member/preorders');
    expect(refreshed.status()).toBe(200);
    const orders = (await refreshed.json()) as {
      items: { id: string; orderCode: string | null }[];
    };
    const acceptedOrder = orders.items.find((item) => item.id === preorder1Id);
    expect(acceptedOrder?.orderCode).toBeTruthy();
    const pendingRow = page
      .locator('.member-orders li')
      .filter({ hasText: acceptedOrder!.orderCode! });
    await expect(pendingRow.locator('summary')).toContainText('Chờ thanh toán');
    await expect(pendingRow.getByRole('button', { name: 'Tạo liên kết thanh toán' })).toBeVisible();

    // Verify DB consistency in florabot_browser_tests
    const order1DbState = sql(
      `SELECT w.state || '|' || COALESCE(o.status, 'NONE') FROM ordering.web_requests w LEFT JOIN ordering.orders o ON o.id = w.order_id WHERE w.id='${preorder1Id}';`,
    );
    expect(order1DbState).toBe('ORDERED|AWAITING_PAYMENT');

    const order2DbState = sql(`SELECT state FROM ordering.web_requests WHERE id='${preorder2Id}';`);
    expect(order2DbState).toBe('REJECTED');

    const order3DbState = sql(`SELECT state FROM ordering.web_requests WHERE id='${preorder3Id}';`);
    expect(order3DbState).toBe('CANCELLED');
  });

  test('Workflow 2: Task lifecycle for Operations Manager, Technician, Seller, and SellerStaff with negative security guards', async ({
    page,
  }) => {
    test.setTimeout(300_000);

    // 1. Dedicated fixture setup with 6 runtime roles (retired STAFF excluded)
    const fixture = createRoleTaskFixture();

    // 2. Operations Manager logs in and assigns INCIDENT task to Technician
    await loginAccount(page, {
      email: fixture.managerEmail,
      password: fixture.managerPassword,
      loginPath: '/admin/login',
      expectedUrl: /\/operations$/,
      submitEndpoint: '/api/auth/admin/login',
    });

    await page.getByText('Phân công công việc mới', { exact: true }).click();
    // Verify wrong-kind action is absent: Operations Manager cannot assign DELIVERY
    await expect(page.locator('#assignment-kind option[value="DELIVERY"]')).toHaveCount(0);
    await expect(page.getByLabel('Loại công việc')).toHaveValue('INCIDENT');

    await page.getByLabel('Nhân viên phụ trách').selectOption(fixture.technicianId);
    await page.getByLabel('Sự cố cần kiểm tra').selectOption(fixture.incidentId);
    await page
      .getByLabel('Hướng dẫn công việc')
      .fill('Kiểm tra chốt khóa ô B01 tại tủ vận hành và báo cáo tình trạng.');

    const assignIncidentReq = page.waitForResponse(
      (response) =>
        response.url().endsWith('/api/operations/staff-tasks') &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Giao công việc', exact: true }).click();
    const assignIncidentRes = await assignIncidentReq;
    expect(assignIncidentRes.status()).toBe(200);
    const incidentTask = (await assignIncidentRes.json()) as { id: string; version: number };
    expect(sql(`SELECT version FROM kiosk_ops.staff_tasks WHERE id='${incidentTask.id}';`)).toBe(
      '1',
    );

    await expect(
      page.getByText('Đã phân công. Nhân viên sẽ thấy công việc trong tài khoản.'),
    ).toBeVisible();

    const incidentCardOnOps = page
      .locator('#staff-tasks article')
      .filter({ hasText: fixture.technicianName });
    await expect(incidentCardOnOps.locator('.staff-task-label')).toHaveText('Chờ bắt đầu');

    // Negative Finance Guard: Operations Manager has zero access to shop wallets or admin payouts
    // SameSeller deliberately conceals foreign shop resources with 404.
    expect((await page.request.get(`/api/sellers/${fixture.sellerId}/wallet`)).status()).toBe(404);
    expect((await page.request.get('/api/admin/withdrawals')).status()).toBe(403);
    expect((await page.request.get('/api/admin/refunds')).status()).toBe(403);
    expect(
      (
        await page.request.post('/api/admin/flows/reconcile_daily', {
          data: { p_date: '2003-03-02' },
        })
      ).status(),
    ).toBe(403);

    // Negative Stock/Delivery Guard: Operations Manager cannot assign DELIVERY tasks
    const invalidDeliveryPost = await page.request.post('/api/operations/staff-tasks', {
      data: {
        id: randomUUID(),
        assigneeId: fixture.technicianId,
        kind: 'DELIVERY',
        kioskId: fixture.kioskId,
        sellerId: fixture.sellerId,
        incidentId: null,
        instructions: 'Manager cannot assign delivery task',
      },
    });
    expect([400, 403]).toContain(invalidDeliveryPost.status());

    await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
    await expect(page).toHaveURL(/\/admin\/login$/);

    // 3. Technician logs in, starts INCIDENT task, and submits repair report
    await loginAccount(page, {
      email: fixture.technicianEmail,
      password: fixture.technicianPassword,
      loginPath: '/admin/login',
      expectedUrl: /\/technician$/,
      submitEndpoint: '/api/auth/admin/login',
    });

    const techIncidentCard = page
      .locator('#staff-tasks article')
      .filter({ hasText: 'Kiểm tra sự cố' });
    await expect(techIncidentCard.locator('.staff-task-label')).toHaveText('Chờ bắt đầu');

    // Transition 1 -> 2: ASSIGNED -> IN_PROGRESS
    await techIncidentCard.getByLabel('Bước tiếp theo').selectOption('IN_PROGRESS');
    await techIncidentCard
      .getByLabel('Nội dung cập nhật')
      .fill('Bắt đầu kiểm tra ổ khóa ô B01 tại tủ theo phân công.');

    const startIncidentReq = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/staff/tasks/${incidentTask.id}/transition`) &&
        response.request().method() === 'POST',
    );
    await techIncidentCard.getByRole('button', { name: 'Xác nhận cập nhật' }).click();
    expect((await startIncidentReq).status()).toBe(200);
    await expect(techIncidentCard.locator('.staff-task-label')).toHaveText('Đang thực hiện');

    // Transition 2 -> 3: IN_PROGRESS -> SUBMITTED
    await techIncidentCard.getByLabel('Bước tiếp theo').selectOption('SUBMITTED');
    await techIncidentCard
      .getByLabel('Nội dung cập nhật')
      .fill('Đã vệ sinh chốt khóa ô B01 và kiểm tra hoạt động đóng mở thành công.');

    const submitIncidentReq = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/staff/tasks/${incidentTask.id}/transition`) &&
        response.request().method() === 'POST',
    );
    await techIncidentCard.getByRole('button', { name: 'Xác nhận cập nhật' }).click();
    expect((await submitIncidentReq).status()).toBe(200);
    await expect(techIncidentCard.locator('.staff-task-label')).toHaveText('Chờ duyệt báo cáo');

    // Negative Stock Guard: Technician has zero stock/shop permissions
    expect((await page.request.get(`/api/sellers/${fixture.sellerId}/slots`)).status()).toBe(403);
    expect((await page.request.get(`/api/sellers/${fixture.sellerId}/products`)).status()).toBe(
      403,
    );

    // Negative Finance Guard: Technician cannot access financial queues
    expect((await page.request.get('/api/admin/withdrawals')).status()).toBe(403);
    expect((await page.request.get('/api/admin/refunds')).status()).toBe(403);

    await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
    await expect(page).toHaveURL(/\/admin\/login$/);

    // 4. Operations Manager reviews and completes INCIDENT task
    await loginAccount(page, {
      email: fixture.managerEmail,
      password: fixture.managerPassword,
      loginPath: '/admin/login',
      expectedUrl: /\/operations$/,
      submitEndpoint: '/api/auth/admin/login',
    });

    const managerReviewCard = page
      .locator('#staff-tasks article')
      .filter({ hasText: fixture.technicianName });
    await expect(managerReviewCard.locator('.staff-task-label')).toHaveText('Chờ duyệt báo cáo');

    // Transition 3 -> 4: SUBMITTED -> COMPLETED
    await managerReviewCard.getByLabel('Bước tiếp theo').selectOption('COMPLETED');
    await managerReviewCard
      .getByLabel('Nội dung cập nhật')
      .fill('Quản lý vận hành nghiệm thu chốt khóa hoạt động tốt và đóng công việc.');

    const reviewIncidentReq = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/operations/staff-tasks/${incidentTask.id}/transition`) &&
        response.request().method() === 'POST',
    );
    await managerReviewCard.getByRole('button', { name: 'Xác nhận cập nhật' }).click();
    expect((await reviewIncidentReq).status()).toBe(200);
    await expect(managerReviewCard.locator('.staff-task-label')).toHaveText('Đã duyệt');

    await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
    await expect(page).toHaveURL(/\/admin\/login$/);

    // 5. Shop Owner logs in, goes to /seller/tasks, and assigns DELIVERY task to own SellerStaff
    await loginAccount(page, {
      email: fixture.sellerOwnerEmail,
      password: fixture.sellerOwnerPassword,
      loginPath: '/dang-nhap',
      expectedUrl: /\/seller$/,
      submitEndpoint: '/api/auth/login',
    });

    await page.goto('/seller/tasks');
    for (const resource of ['wallet', 'slots', 'products', 'staff-tasks']) {
      expect(
        (await page.request.get(`/api/sellers/${fixture.sellerId}/${resource}`)).status(),
      ).toBe(200);
    }
    await page.getByText('Phân công công việc mới', { exact: true }).click();
    // Verify wrong-kind action is absent: Shop Owner cannot assign INCIDENT
    await expect(page.locator('#assignment-kind option[value="INCIDENT"]')).toHaveCount(0);
    await expect(page.getByLabel('Loại công việc')).toHaveValue('DELIVERY');

    await page.getByLabel('Nhân viên phụ trách').selectOption(fixture.sellerStaffId);
    await page
      .getByLabel('Shop và tủ giao hoa')
      .selectOption(`${fixture.sellerId}:${fixture.kioskId}`);
    await page
      .getByLabel('Hướng dẫn công việc')
      .fill('Giao 3 bó hoa lụa vàng đồng vào ô tủ B01 theo đơn.');

    const assignDeliveryReq = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/sellers/${fixture.sellerId}/staff-tasks`) &&
        response.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Giao công việc', exact: true }).click();
    const assignDeliveryRes = await assignDeliveryReq;
    expect(assignDeliveryRes.status()).toBe(200);
    const deliveryTask = (await assignDeliveryRes.json()) as { id: string; version: number };
    expect(sql(`SELECT version FROM kiosk_ops.staff_tasks WHERE id='${deliveryTask.id}';`)).toBe(
      '1',
    );

    await expect(
      page.getByText('Đã phân công. Nhân viên sẽ thấy công việc trong tài khoản.'),
    ).toBeVisible();

    const deliveryCardOnOwner = page
      .locator('#staff-tasks article')
      .filter({ hasText: fixture.sellerStaffName });
    await expect(deliveryCardOnOwner.locator('.staff-task-label')).toHaveText('Chờ bắt đầu');

    await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
    await expect(page).toHaveURL(/\/dang-nhap$/);

    // 6. SellerStaff logs in, starts DELIVERY task, and submits simulated delivery report
    await loginAccount(page, {
      email: fixture.sellerStaffEmail,
      password: fixture.sellerStaffPassword,
      loginPath: '/dang-nhap',
      expectedUrl: /\/staff$/,
      submitEndpoint: '/api/auth/login',
    });

    const staffDeliveryCard = page.locator('#staff-tasks article').filter({ hasText: 'Giao hoa' });
    await expect(staffDeliveryCard.locator('.staff-task-label')).toHaveText('Chờ bắt đầu');

    // Transition 1 -> 2: ASSIGNED -> IN_PROGRESS
    await staffDeliveryCard.getByLabel('Bước tiếp theo').selectOption('IN_PROGRESS');
    await staffDeliveryCard
      .getByLabel('Nội dung cập nhật')
      .fill('Bắt đầu quy trình giao hoa thử nghiệm theo phân công.');

    const startDeliveryReq = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/staff/tasks/${deliveryTask.id}/transition`) &&
        response.request().method() === 'POST',
    );
    await staffDeliveryCard.getByRole('button', { name: 'Xác nhận cập nhật' }).click();
    expect((await startDeliveryReq).status()).toBe(200);
    await expect(staffDeliveryCard.locator('.staff-task-label')).toHaveText('Đang thực hiện');

    // Transition 2 -> 3: IN_PROGRESS -> SUBMITTED (simulated delivery report; does not assert stock happened)
    await staffDeliveryCard.getByLabel('Bước tiếp theo').selectOption('SUBMITTED');
    await staffDeliveryCard
      .getByLabel('Nội dung cập nhật')
      .fill('Báo cáo giao hoa thử nghiệm: đã hoàn thành giao hoa và kiểm tra vị trí tủ.');

    const submitDeliveryReq = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/staff/tasks/${deliveryTask.id}/transition`) &&
        response.request().method() === 'POST',
    );
    await staffDeliveryCard.getByRole('button', { name: 'Xác nhận cập nhật' }).click();
    expect((await submitDeliveryReq).status()).toBe(200);
    await expect(staffDeliveryCard.locator('.staff-task-label')).toHaveText('Chờ duyệt báo cáo');

    // Negative Incident Guard: Seller staff cannot resolve technical incidents
    const foreignIncidentAttempt = await page.request.post(
      `/api/staff/tasks/${incidentTask.id}/resolve-incident`,
      { data: { report: 'Seller staff attempt to resolve technical incident' } },
    );
    expect([403, 404]).toContain(foreignIncidentAttempt.status());

    // Negative Finance Guard: Seller staff cannot view shop wallet or admin withdrawals
    expect((await page.request.get(`/api/sellers/${fixture.sellerId}/wallet`)).status()).toBe(404);
    expect((await page.request.get('/api/admin/withdrawals')).status()).toBe(403);

    await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
    await expect(page).toHaveURL(/\/dang-nhap$/);

    // 7. Shop Owner logs in, reviews simulated delivery report and completes DELIVERY task
    await loginAccount(page, {
      email: fixture.sellerOwnerEmail,
      password: fixture.sellerOwnerPassword,
      loginPath: '/dang-nhap',
      expectedUrl: /\/seller$/,
      submitEndpoint: '/api/auth/login',
    });

    await page.goto('/seller/tasks');
    const ownerReviewCard = page
      .locator('#staff-tasks article')
      .filter({ hasText: fixture.sellerStaffName });
    await expect(ownerReviewCard.locator('.staff-task-label')).toHaveText('Chờ duyệt báo cáo');

    // Transition 3 -> 4: SUBMITTED -> COMPLETED
    await ownerReviewCard.getByLabel('Bước tiếp theo').selectOption('COMPLETED');
    await ownerReviewCard
      .getByLabel('Nội dung cập nhật')
      .fill('Chủ shop nghiệm thu báo cáo công việc giao hoa thử nghiệm.');

    const reviewDeliveryReq = page.waitForResponse(
      (response) =>
        response
          .url()
          .endsWith(`/api/sellers/${fixture.sellerId}/staff-tasks/${deliveryTask.id}/transition`) &&
        response.request().method() === 'POST',
    );
    await ownerReviewCard.getByRole('button', { name: 'Xác nhận cập nhật' }).click();
    expect((await reviewDeliveryReq).status()).toBe(200);
    await expect(ownerReviewCard.locator('.staff-task-label')).toHaveText('Đã duyệt');

    // Negative Incident Guard: Seller cannot access Operations Manager incident or task APIs
    expect((await page.request.get('/api/operations/incidents')).status()).toBe(403);
    expect((await page.request.get('/api/operations/staff-tasks')).status()).toBe(403);

    // Negative Finance Guard: Seller cannot access Platform Admin financial APIs
    expect((await page.request.get('/api/admin/withdrawals')).status()).toBe(403);
    expect((await page.request.get('/api/admin/refunds')).status()).toBe(403);
    expect(
      (
        await page.request.post('/api/admin/flows/reconcile_daily', {
          data: { p_date: '2003-03-02' },
        })
      ).status(),
    ).toBe(403);

    await page.getByRole('button', { name: 'Đăng xuất' }).first().click();

    // 8. Foreign Seller Staff session guards (cross-tenant isolation)
    await loginAccount(page, {
      email: fixture.foreignStaffEmail,
      password: fixture.foreignStaffPassword,
      loginPath: '/dang-nhap',
      expectedUrl: /\/staff$/,
      submitEndpoint: '/api/auth/login',
    });

    // Negative Stock/Tenant Guard: Foreign seller staff cannot access another shop's slots or tasks
    expect((await page.request.get(`/api/sellers/${fixture.sellerId}/slots`)).status()).toBe(403);
    expect((await page.request.get(`/api/sellers/${fixture.sellerId}/staff-tasks`)).status()).toBe(
      404,
    );

    await page.getByRole('button', { name: 'Đăng xuất' }).first().click();
  });
});

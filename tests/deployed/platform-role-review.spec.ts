import { writeFile } from 'node:fs/promises';
import { expect, test, type Page, type TestInfo } from '@playwright/test';

// Explicit live review: no mocked routes; credentials are supplied privately at runtime.
const enabled = process.env.RUN_LIVE_ROLE_REVIEW === '1';
test.skip(!enabled, 'Chỉ chạy khi chủ động kiểm thử dữ liệu BE deploy.');
test.use({
  viewport: { width: 1280, height: 900 },
  video: { mode: 'on', size: { width: 1280, height: 900 } },
  launchOptions: { slowMo: 180 },
});
test.setTimeout(240_000);
const reworkId = process.env.LIVE_REWORK_ID;
const reason =
  'KIỂM THỬ LUỒNG YÊU CẦU BỔ SUNG — ảnh hiện tại là mô hình minh họa, chưa xác nhận lắp đặt vật lý. Kỹ thuật viên cần bổ sung ảnh thực tế, kiểm tra tại điểm lắp đặt và cập nhật báo cáo trước khi Manager nghiệm thu.';
type ApiIssue = { path: string; status: number };
type Step = { route: string; heading: string; alerts: string[] };

async function login(page: Page, role: string) {
  const accounts = JSON.parse(process.env.LIVE_ROLE_REVIEW_ACCOUNTS || '[]') as {
    role: string;
    email: string;
    password: string;
  }[];
  const account = accounts.find((item) => item.role === role);
  if (!account) throw new Error(`Thiếu tài khoản BE cấp cho ${role}`);
  await page.goto('/admin/login');
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const expected =
    role === 'ADMIN'
      ? /\/admin$/
      : role === 'OPERATIONS_MANAGER'
        ? /\/operations$/
        : /\/technician$/;
  await expect(page).toHaveURL(expected, { timeout: 25_000 });
  const session = await page.request.get('/api/auth/me');
  expect(session.status()).toBe(200);
  const data = await session.json();
  expect(data.role).toBe(role);
  return data;
}

function observe(page: Page) {
  const apiIssues: ApiIssue[] = [];
  const pageErrors: string[] = [];
  const writes: { path: string; status: number }[] = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));
  page.on('response', (response) => {
    const path = new URL(response.url()).pathname + new URL(response.url()).search;
    if (!path.startsWith('/api/')) return;
    if (response.status() >= 400) apiIssues.push({ path, status: response.status() });
    if (response.request().method() !== 'GET') writes.push({ path, status: response.status() });
  });
  return { apiIssues, pageErrors, writes };
}

async function show(page: Page, route: string, steps: Step[], info: TestInfo) {
  await page.goto(route);
  const heading = page.locator('main h1').first();
  await expect(heading).toBeVisible();
  await expect(page.locator('main [role="status"]').filter({ hasText: /^Đang tải/ })).toHaveCount(
    0,
    { timeout: 25_000 },
  );
  const alerts = await page.locator('main [role="alert"]').allTextContents();
  steps.push({ route, heading: await heading.innerText(), alerts });
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
  });
  await page.screenshot({
    path: info.outputPath(route.replaceAll('/', '_') + '.png'),
    fullPage: true,
  });
}

async function save(info: TestInfo, data: unknown) {
  await writeFile(info.outputPath('live-review.json'), JSON.stringify(data, null, 2));
}

test('01 Admin — login, approval queues and oversight with real BE data', async ({
  page,
}, info) => {
  await login(page, 'ADMIN');
  const seen = observe(page);
  const steps: Step[] = [];
  try {
    for (const route of [
      '/admin',
      '/admin/approvals',
      '/admin/complaints',
      '/admin/refunds',
      '/admin/kiosk-refunds',
      '/admin/withdrawals',
      '/admin/incidents',
      '/admin/tasks',
      '/admin/orders',
      '/admin/installations',
      '/admin/shops',
      '/admin/slots',
      '/admin/accounts',
      '/admin/managers',
      '/admin/reports',
      '/admin/reconciliation',
    ])
      await show(page, route, steps, info);
    await page.goto('/admin/installations');
    const list = await page.request.get('/api/operations/kiosk-applications?page=1');
    expect(list.status()).toBe(200);
    const items = (await list.json()).items;
    const target = items.find((item: { id: string }) => item.id === reworkId);
    if (target) {
      const row = page.getByRole('row').filter({ hasText: target.shopName });
      await row.getByRole('button', { name: 'Chi tiết', exact: true }).click();
      await expect(page.locator('#detail-panel-title')).toContainText(target.shopName);
      await expect(
        page.getByRole('button', { name: 'Nghiệm thu Đạt & Bàn giao Kiosk', exact: true }),
      ).toHaveCount(0);
      await expect(
        page.getByRole('button', {
          name: 'Gửi yêu cầu làm lại (Chuyển về INSTALLING)',
          exact: true,
        }),
      ).toHaveCount(0);
      await page.screenshot({
        path: info.outputPath('admin-real-installation-read-only.png'),
        fullPage: true,
      });
    }
    await save(info, { role: 'ADMIN', steps, ...seen });
    expect(seen.writes.filter((item) => !item.path.startsWith('/api/auth/'))).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    expect(seen.apiIssues).toEqual([]);
  } finally {
    await save(info, { role: 'ADMIN', steps, ...seen });
    await page.request.post('/api/auth/logout', { data: {} });
  }
});

test('02 Manager — resources, real installation review and authorized rework', async ({
  page,
}, info) => {
  await login(page, 'OPERATIONS_MANAGER');
  const seen = observe(page);
  const steps: Step[] = [];
  try {
    for (const route of [
      '/operations',
      '/operations/tasks',
      '/operations/technicians',
      '/operations/sellers',
      '/operations/customers',
      '/operations/installations',
    ])
      await show(page, route, steps, info);
    const inventory = page.getByRole('button', { name: 'Kho tủ khả dụng', exact: true });
    await inventory.click();
    await expect(
      page.getByRole('heading', { name: 'Kho thiết bị Kiosk khả dụng', exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: info.outputPath('manager-real-inventory.png'), fullPage: true });
    await page.keyboard.press('Escape');
    if (reworkId) {
      const response = await page.request.get(`/api/operations/kiosk-applications/${reworkId}`);
      expect(response.status()).toBe(200);
      const { application: detail } = await response.json();
      expect(['AWAITING_HANDOVER', 'INSTALLING']).toContain(detail.status);
      await page.getByRole('row').filter({ hasText: detail.shopName }).getByRole('button').click();
      await expect(page.locator('#detail-panel-title')).toContainText(detail.shopName);
      if (detail.status === 'AWAITING_HANDOVER') {
        await expect(page.getByRole('img', { name: 'Minh chứng #1', exact: true })).toBeVisible();
        await page.getByLabel('Lý do yêu cầu làm lại:', { exact: true }).fill(reason);
        const result = page.waitForResponse(
          (r) =>
            new URL(r.url()).pathname === `/api/operations/kiosk-applications/${reworkId}/rework` &&
            r.request().method() === 'POST',
        );
        await page
          .getByRole('button', { name: 'Gửi yêu cầu làm lại (Chuyển về INSTALLING)', exact: true })
          .click();
        expect((await result).status()).toBe(200);
        await expect(
          page.getByText('Đã yêu cầu kỹ thuật viên kiểm tra / sửa lại.', { exact: true }),
        ).toBeVisible();
      }
      const check = await page.request.get(`/api/operations/kiosk-applications/${reworkId}`);
      expect(check.status()).toBe(200);
      const { application: updated } = await check.json();
      expect(updated.status).toBe('INSTALLING');
      expect(updated.reworkReason).toBe(reason);
      await page.screenshot({
        path: info.outputPath('manager-real-rework-sent.png'),
        fullPage: true,
      });
    }
    const forbidden = await page.request.get('/api/admin/accounts?page=1');
    expect(forbidden.status()).toBe(403);
    expect(seen.writes.filter((item) => item.path.endsWith('/handover'))).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    expect(seen.apiIssues).toEqual([]);
  } finally {
    await save(info, { role: 'OPERATIONS_MANAGER', steps, ...seen });
    await page.request.post('/api/auth/logout', { data: {} });
  }
});

test('03 Technician — assigned work and receives the real Manager rework', async ({
  page,
}, info) => {
  const session = await login(page, 'TECHNICIAN');
  const seen = observe(page);
  const steps: Step[] = [];
  try {
    for (const route of ['/technician', '/technician/installations'])
      await show(page, route, steps, info);
    const tasks = await page.request.get('/api/staff/tasks?page=1');
    expect(tasks.status()).toBe(200);
    const assigned = await tasks.json();
    if (assigned.items.length === 0)
      await expect(page.getByRole('heading', { name: 'Lắp đặt kiosk', exact: true })).toBeVisible();
    if (reworkId) {
      const response = await page.request.get(`/api/staff/kiosk-installations/${reworkId}`);
      expect(response.status()).toBe(200);
      const detail = await response.json();
      expect(detail.status).toBe('INSTALLING');
      expect(detail.reworkReason).toBe(reason);
      await page.getByLabel('Tìm phiếu lắp đặt', { exact: true }).fill(detail.kioskCode);
      await expect(page.locator('.tech-job-card')).toHaveCount(1);
      await page.locator('.tech-job-card').click();
      await expect(page.locator('#job-detail-title')).toHaveText(detail.shopName);
      await expect(page.locator('.tech-job-detail-card [role="alert"]')).toContainText(reason);
      await expect(page.getByLabel('Nội dung báo cáo chi tiết:')).toBeVisible();
      await expect(
        page.getByRole('button', { name: 'Nộp báo cáo hoàn thành', exact: true }),
      ).toBeDisabled();
      await expect(
        page.getByRole('button', { name: 'Nghiệm thu Đạt & Bàn giao Kiosk', exact: true }),
      ).toHaveCount(0);
      await page.screenshot({
        path: info.outputPath('technician-real-rework-received.png'),
        fullPage: true,
      });
    }
    const forbidden = await page.request.get('/api/admin/accounts?page=1');
    expect(forbidden.status()).toBe(403);
    expect(seen.writes.filter((item) => !item.path.startsWith('/api/auth/'))).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
    expect(seen.apiIssues).toEqual([]);
    await save(info, {
      role: session.role,
      assignedIncidentsInPage: assigned.items.length,
      hasMore: assigned.hasMore,
      steps,
      ...seen,
    });
  } finally {
    await save(info, { role: 'TECHNICIAN', steps, ...seen });
    await page.request.post('/api/auth/logout', { data: {} });
  }
});

test('04 Admin — real refund detail and daily report without payouts', async ({ page }, info) => {
  await login(page, 'ADMIN');
  const seen = observe(page);
  const steps: Step[] = [];
  try {
    await show(page, '/admin/refunds', steps, info);
    const details = page.locator('.admin-refunds details').first();
    if (await details.count()) {
      const response = page.waitForResponse(
        (r) =>
          new URL(r.url()).pathname.startsWith('/api/admin/refunds/') &&
          r.request().method() === 'GET',
      );
      await details.locator('summary').click();
      expect((await response).status()).toBe(200);
      await expect(details.getByText('Đang tải khoản hoàn…')).toHaveCount(0);
      await page.screenshot({
        path: info.outputPath('admin-real-refund-detail.png'),
        fullPage: true,
      });
    }
    await show(page, '/admin/reports', steps, info);
    for (const report of ['v_admin_queue', 'v_revenue_daily', 'v_platform_revenue']) {
      await page.getByLabel('Chọn báo cáo', { exact: true }).selectOption(report);
      const result = await page.request.get(`/api/admin/reports/${report}`);
      expect(result.status()).toBe(200);
      expect(Array.isArray(await result.json())).toBe(true);
      await expect(page.getByText('Đang tải báo cáo…', { exact: true })).toHaveCount(0);
    }
    await show(page, '/admin/reconciliation', steps, info);
    await page.getByLabel('Ngày đối soát (giờ Việt Nam)', { exact: true }).fill('2026-11-01');
    const daily = page.waitForResponse(
      (r) =>
        new URL(r.url()).pathname === '/api/admin/flows/reconcile_daily' &&
        r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Xem báo cáo ngày', exact: true }).click();
    expect((await daily).status()).toBe(200);
    await expect(
      page.getByRole('heading', { name: 'Báo cáo ngày 2026-11-01', exact: true }),
    ).toBeVisible();
    await page.screenshot({ path: info.outputPath('admin-real-daily-report.png'), fullPage: true });
    expect(
      seen.writes.filter(
        (item) =>
          !item.path.startsWith('/api/auth/') && item.path !== '/api/admin/flows/reconcile_daily',
      ),
    ).toEqual([]);
    expect(seen.apiIssues).toEqual([]);
    expect(seen.pageErrors).toEqual([]);
  } finally {
    await save(info, { role: 'ADMIN_DETAILED_REVIEW', steps, ...seen });
    await page.request.post('/api/auth/logout', { data: {} });
  }
});

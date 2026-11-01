import { readFile } from 'node:fs/promises';
import { expect, test, type Page } from '@playwright/test';

const enabled = process.env.RUN_LIVE_TECHNICIAN === '1';
const applicationId = process.env.LIVE_WRITE_APPLICATION_ID;
const report =
  'KIỂM THỬ TÍCH HỢP FE — kiểm tra luồng bắt đầu, tải ảnh và gửi báo cáo trên BE deploy. Ảnh đính kèm là mô hình minh họa tạm được cho phép dùng test; CHƯA xác nhận lắp đặt vật lý, nguồn điện hoặc thiết bị. Không dùng báo cáo kiểm thử này làm nghiệm thu thực tế.';

test.skip(!enabled, 'Chỉ chạy chủ động với tài khoản BE cấp, không dùng API giả lập.');

async function login(page: Page) {
  const email = process.env.LIVE_TECHNICIAN_EMAIL;
  const password = process.env.LIVE_TECHNICIAN_PASSWORD;
  if (!email || !password) throw new Error('Thiếu thông tin đăng nhập Technician BE cấp.');
  const response = await page.request.post('/api/auth/admin/login', { data: { email, password } });
  expect(response.status(), 'Đăng nhập BE deploy qua FE proxy').toBe(200);
  const session = await page.request.get('/api/auth/me');
  expect(session.status()).toBe(200);
  const account = await session.json();
  expect(account.role).toBe('TECHNICIAN');
  return account;
}

async function screenshot(page: Page, path: string) {
  await page.evaluate(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path, fullPage: true });
}

test('BE deploy: Technician reads assigned incidents and installation records through FE', async ({
  page,
}, info) => {
  const session = await login(page);
  try {
    const tasksResponse = await page.request.get('/api/staff/tasks?page=1');
    expect(tasksResponse.status()).toBe(200);
    const tasks = await tasksResponse.json();
    expect(Array.isArray(tasks.items)).toBe(true);
    await page.goto('/technician');
    await expect(
      page.getByRole('heading', { name: 'Công việc kỹ thuật', exact: true, level: 1 }),
    ).toBeVisible();
    if (tasks.items.length === 0)
      await expect(
        page.getByRole('heading', { name: 'Chưa có công việc', exact: true }),
      ).toBeVisible();
    else
      for (const task of tasks.items) await expect(page.locator(`#task-${task.id}`)).toBeVisible();
    await screenshot(page, info.outputPath('technician-real-tasks.png'));
    const response = await page.request.get('/api/staff/kiosk-installations');
    expect(response.status()).toBe(200);
    const jobs = await response.json();
    expect(Array.isArray(jobs)).toBe(true);
    await page.goto('/technician/installations');
    await expect(page.getByRole('heading', { name: 'Lắp đặt kiosk', exact: true })).toBeVisible();
    await expect(page.locator('.tech-job-card')).toHaveCount(jobs.length);
    for (const job of jobs.slice(0, 10)) {
      const detailResponse = await page.request.get(`/api/staff/kiosk-installations/${job.id}`);
      expect(detailResponse.status()).toBe(200);
      const detail = await detailResponse.json();
      await page
        .getByRole('button', {
          name: new RegExp(job.shopName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
        })
        .click();
      await expect(page.locator('#job-detail-title')).toHaveText(detail.shopName);
      await expect(page.locator('.job-address-primary')).toHaveText(detail.installationAddress);
      await expect(page.getByRole('button', { name: /Nghiệm thu|Bàn giao kiosk/i })).toHaveCount(0);
      await screenshot(page, info.outputPath(`technician-real-${job.id}.png`));
      await page.getByRole('button', { name: 'Danh sách lắp đặt', exact: true }).click();
    }
    await info.attach('real-read-summary', {
      body: Buffer.from(
        JSON.stringify(
          {
            role: session.role,
            tasksInPage: tasks.items.length,
            hasMore: tasks.hasMore,
            jobs: jobs.map((job: { id: string; status: string; kioskCode: string }) => ({
              id: job.id,
              status: job.status,
              kioskCode: job.kioskCode,
            })),
          },
          null,
          2,
        ),
      ),
      contentType: 'application/json',
    });
  } finally {
    await page.request.post('/api/auth/logout', { data: {} });
  }
});

test('BE deploy: explicitly selected installation start, illustrative evidence, submit and read-back', async ({
  page,
}, info) => {
  test.skip(
    !applicationId,
    'Không ghi dữ liệu khi chưa chỉ định chính xác hồ sơ test được cho phép.',
  );
  await login(page);
  const calls: { method: string; path: string; status: number }[] = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/'))
      calls.push({
        method: response.request().method(),
        path: url.pathname,
        status: response.status(),
      });
  });
  try {
    const getDetail = async () => {
      const response = await page.request.get(`/api/staff/kiosk-installations/${applicationId}`);
      expect(response.status()).toBe(200);
      return response.json();
    };
    let detail = await getDetail();
    expect(detail.id).toBe(applicationId);
    expect(['SCHEDULED', 'INSTALLING', 'AWAITING_HANDOVER']).toContain(detail.status);
    await page.goto('/technician/installations');
    await page.getByLabel('Tìm phiếu lắp đặt', { exact: true }).fill(detail.kioskCode);
    await expect(page.locator('.tech-job-card')).toHaveCount(1);
    await page.locator('.tech-job-card').click();
    await expect(page.locator('#job-detail-title')).toHaveText(detail.shopName);
    if (detail.status === 'SCHEDULED') {
      const pending = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            `/api/staff/kiosk-installations/${applicationId}/start` &&
          response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Bắt đầu lắp đặt', exact: true }).click();
      expect((await pending).status()).toBe(200);
      await expect(page.getByLabel('Nội dung báo cáo chi tiết:')).toBeVisible();
      detail = await getDetail();
      expect(detail.status).toBe('INSTALLING');
    }
    if (detail.status === 'INSTALLING') {
      const beforeResponse = await page.request.get(
        `/api/staff/kiosk-installations/${applicationId}/evidence`,
      );
      expect(beforeResponse.status()).toBe(200);
      const before = await beforeResponse.json();
      if (before.length === 0) {
        await page.locator('input[type="file"]').setInputFiles({
          name: 'TEST-anh-mo-hinh-chua-lap-dat.webp',
          mimeType: 'image/webp',
          buffer: await readFile('apps/web/public/images/kiosk-model.webp'),
        });
        await page.getByRole('button', { name: 'Tải ảnh lên', exact: true }).click();
        await expect(
          page.getByText(
            'Đã tải lên và đính kèm ảnh TEST-anh-mo-hinh-chua-lap-dat.webp thành công.',
            { exact: true },
          ),
        ).toBeVisible({ timeout: 45000 });
      }
      await page.getByLabel('Nội dung báo cáo chi tiết:').fill(report);
      const submit = page.waitForResponse(
        (response) =>
          new URL(response.url()).pathname ===
            `/api/staff/kiosk-installations/${applicationId}/submit` &&
          response.request().method() === 'POST',
      );
      await page.getByRole('button', { name: 'Nộp báo cáo hoàn thành', exact: true }).click();
      expect((await submit).status()).toBe(200);
    }
    detail = await getDetail();
    expect(detail.status).toBe('AWAITING_HANDOVER');
    expect(detail.technicianReport).toBe(report);
    const evidenceResponse = await page.request.get(
      `/api/staff/kiosk-installations/${applicationId}/evidence`,
    );
    expect(evidenceResponse.status()).toBe(200);
    const evidence = await evidenceResponse.json();
    expect(evidence.length).toBeGreaterThan(0);
    const image = await page.request.get(
      `/api/staff/kiosk-installations/${applicationId}/evidence/${evidence[0].id}`,
    );
    expect(image.status()).toBe(200);
    expect(image.headers()['content-type']).toMatch(/^image\//);
    expect((await image.body()).byteLength).toBeGreaterThan(0);
    await expect(
      page.getByRole('heading', { name: 'Ảnh lắp đặt đã gửi', exact: true }),
    ).toBeVisible();
    await expect(page.getByText(report, { exact: true })).toBeVisible();
    await screenshot(page, info.outputPath('technician-real-submitted.png'));
    expect(calls.filter((call) => call.path.endsWith('/handover'))).toEqual([]);
    await info.attach('real-write-summary', {
      body: Buffer.from(
        JSON.stringify(
          {
            applicationId,
            status: detail.status,
            evidenceCount: evidence.length,
            imageStatus: image.status(),
            reportLabel: 'Ảnh minh họa và báo cáo kiểm thử, không phải nghiệm thu vật lý',
            calls,
          },
          null,
          2,
        ),
      ),
      contentType: 'application/json',
    });
  } finally {
    await page.request.post('/api/auth/logout', { data: {} });
  }
});

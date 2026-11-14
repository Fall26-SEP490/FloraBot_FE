import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.beforeEach(async ({ page }) => {
  await page.route('**/api/admin/withdrawals?*', (route) =>
    route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
  );
});

const row = {
  id: 'incident-1',
  kind: 'DISPENSE_FAILED',
  status: 'OPEN',
  reason: 'Cửa không mở khi nhận hoa.',
  createdAt: '2026-10-07T10:00:00Z',
  resolvedAt: null,
  decision: null,
  orderId: 'order-1',
  kioskId: 'kiosk-1',
  slotId: 'slot-1',
  location: {
    kioskId: 'kiosk-1',
    kioskCode: 'FPT-01',
    kioskName: 'Đại học FPT',
    address: 'Thủ Đức',
  },
  slot: { id: 'slot-1', slotCode: 'A01', status: 'FAULT' },
};
async function setup(page: Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'admin',
        name: 'Quản trị viên',
        role: 'ADMIN',
        sellerId: null,
        sellerStatus: null,
      },
    }),
  );
  await page.route('**/api/admin/sellers?*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/admin/slots', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/packages', (route) => route.fulfill({ json: [] }));
}
for (const width of [390, 1440]) {
  test(`Admin monitors incident evidence without operational writes ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(page);
    let writes = 0;
    await page.route('**/api/admin/incidents?*', (route) =>
      route.fulfill({ json: { items: [row], page: 1, hasMore: false } }),
    );
    await page.route('**/api/admin/incidents/incident-1', (route) =>
      route.fulfill({
        json: {
          incident: row,
          evidence: {
            items: [
              { id: 'good', url: 'https://example.invalid/evidence.jpg', createdAt: row.createdAt },
              { id: 'bad', url: 'javascript:alert(1)', createdAt: row.createdAt },
            ],
            page: 1,
            hasMore: false,
          },
        },
      }),
    );
    await page.route('**/flows/resolve_device_fault', (route) => {
      writes++;
      return route.fulfill({ status: 500 });
    });
    await page.goto('/admin/incidents');
    const section = page.locator('.admin-incidents');
    await section.locator('summary').click();
    await expect(section.getByRole('link', { name: 'Mở ảnh minh chứng 1' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    await expect(section.locator('a[href^="javascript:"]')).toHaveCount(0);
    await expect(section.getByText('Chế độ giám sát.', { exact: false })).toBeVisible();
    await expect(section.getByLabel('Kết quả kiểm tra và xử lý')).toHaveCount(0);
    await expect(section.getByRole('button', { name: 'Xác nhận đóng sự cố' })).toHaveCount(0);
    await expect(section.locator('form')).toHaveCount(0);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(writes).toBe(0);
  });
}

test('Admin recovers read errors and paginates without closing incidents', async ({ page }) => {
  await setup(page);
  let fail = true;
  await page.route('**/api/admin/incidents?*', (route) => {
    if (fail) return route.fulfill({ status: 503 });
    const pageNumber = Number(new URL(route.request().url()).searchParams.get('page'));
    return route.fulfill({
      json: { items: pageNumber === 2 ? [] : [row], page: pageNumber, hasMore: pageNumber === 1 },
    });
  });
  await page.route('**/api/admin/incidents/incident-1', (route) =>
    route.fulfill({ json: { incident: row, evidence: { items: [], page: 1, hasMore: false } } }),
  );
  await page.goto('/admin/incidents');
  const section = page.locator('.admin-incidents');
  await expect(section.getByRole('alert')).toContainText('Chưa tải được sự cố');
  fail = false;
  await section.getByRole('button', { name: 'Cập nhật danh sách sự cố' }).click();
  await section.getByRole('button', { name: 'Trang sự cố sau' }).click();
  await expect(section.getByText('Trang 2', { exact: true })).toBeVisible();
  await section.getByRole('button', { name: 'Trang sự cố trước' }).click();
  await section.locator('summary').click();
  await expect(section.getByText('Chưa có ảnh đính kèm.')).toBeVisible();
  await expect(section.locator('form')).toHaveCount(0);
});

test('Admin can read the resolved incident decision and time', async ({ page }) => {
  await setup(page);
  const closed = {
    ...row,
    status: 'RESOLVED_FIXED',
    decision: 'Đã kiểm tra và khắc phục khóa.',
    resolvedAt: '2026-11-14T08:00:00Z',
  };
  await page.route('**/api/admin/incidents?*', (route) =>
    route.fulfill({ json: { items: [closed], page: 1, hasMore: false } }),
  );
  await page.route('**/api/admin/incidents/incident-1', (route) =>
    route.fulfill({ json: { incident: closed, evidence: { items: [], page: 1, hasMore: false } } }),
  );
  await page.goto('/admin/incidents');
  const section = page.locator('.admin-incidents');
  await section.getByLabel('Trạng thái sự cố').selectOption('RESOLVED_FIXED');
  await section.locator('summary').click();
  await expect(section.getByRole('heading', { name: 'Đã xử lý', exact: true })).toBeVisible();
  await expect(section.getByText(closed.decision)).toBeVisible();
  await expect(section.locator('form')).toHaveCount(0);
});

test('Admin opens staff task evidence URL and paginates incident evidence', async ({ page }) => {
  await setup(page);
  const incidentId = '01a1cc2a-bf1d-7b9b-8339-997499973215';
  const taskAttachmentId = '01a1cc2b-0000-7000-8000-000000000001';
  const disputeAttachmentId = '01a1cc2b-0000-7000-8000-000000000002';
  const requestedPages: string[] = [];
  await page.route('**/api/admin/incidents?*', (route) =>
    route.fulfill({ json: { items: [{ ...row, id: incidentId }], page: 1, hasMore: false } }),
  );
  await page.route(`**/api/admin/incidents/${incidentId}*`, (route) => {
    const url = new URL(route.request().url());
    const evPage = url.searchParams.get('evidencePage') || '1';
    requestedPages.push(evPage);
    return route.fulfill({
      json: {
        incident: { ...row, id: incidentId },
        evidence:
          evPage === '2'
            ? {
                page: 2,
                hasMore: false,
                items: [
                  {
                    id: disputeAttachmentId,
                    url: `/api/admin/evidence/${disputeAttachmentId}`,
                    createdAt: row.createdAt,
                    source: 'INCIDENT',
                    taskId: null,
                  },
                ],
              }
            : {
                page: 1,
                hasMore: true,
                items: [
                  {
                    id: taskAttachmentId,
                    url: `/api/admin/incidents/${incidentId}/evidence/${taskAttachmentId}`,
                    createdAt: row.createdAt,
                    source: 'STAFF_TASK',
                    taskId: '01a1cc2b-1111-7000-8000-000000000009',
                  },
                ],
              },
      },
    });
  });

  await page.goto('/admin/incidents');
  const section = page.locator('.admin-incidents');
  await section.locator('summary').click();
  const link1 = section.getByRole('link', { name: 'Mở ảnh minh chứng 1' });
  await expect(link1).toHaveAttribute(
    'href',
    `/api/admin/incidents/${incidentId}/evidence/${taskAttachmentId}`,
  );
  await expect(section.getByText('· Ảnh kiểm tra kỹ thuật')).toBeVisible();
  await section.getByRole('button', { name: 'Ảnh trang sau' }).click();
  await expect(section.getByText('Trang ảnh 2', { exact: true })).toBeVisible();
  const link21 = section.getByRole('link', { name: 'Mở ảnh minh chứng 21' });
  await expect(link21).toHaveAttribute('href', `/api/admin/evidence/${disputeAttachmentId}`);
  await expect(section.getByText('· Ảnh báo sự cố')).toBeVisible();
  expect(requestedPages).toEqual(['1', '2']);
});

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
  test(`Admin reviews evidence, handles refund guard and resolves incident ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(page);
    let resolved = false;
    let attempts = 0;
    await page.route('**/api/admin/incidents?*', (route) =>
      route.fulfill({ json: { items: resolved ? [] : [row], page: 1, hasMore: false } }),
    );
    await page.route('**/api/admin/incidents/incident-1', (route) =>
      route.fulfill({
        json: {
          incident: { ...row, status: resolved ? 'RESOLVED_FIXED' : 'OPEN' },
          evidence: {
            items: [
              { id: 'good', url: 'https://example.invalid/evidence.jpg', createdAt: row.createdAt },
              { id: 'bad', url: 'javascript:alert(1)', createdAt: row.createdAt },
            ],
            hasMore: false,
          },
        },
      }),
    );
    await page.route('**/flows/resolve_device_fault', (route) => {
      expect(route.request().postDataJSON()).toEqual({
        p_dispute: row.id,
        p_note: 'Đã kiểm tra khóa và cảm biến tại ô A01.',
      });
      attempts++;
      if (attempts === 1)
        return route.fulfill({
          status: 409,
          json: { detail: 'Phải chi hoàn cho khách trước khi đóng sự cố.' },
        });
      resolved = true;
      return route.fulfill({ json: { result: null } });
    });
    await page.goto('/admin/incidents');
    const section = page.locator('.admin-incidents');
    await section.locator('summary').click();
    await expect(section.getByRole('link', { name: 'Mở ảnh minh chứng 1' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    await expect(section.locator('a[href^="javascript:"]')).toHaveCount(0);
    await section.getByRole('button', { name: 'Kiểm tra kết quả xử lý' }).click();
    await expect(section.getByLabel('Kết quả kiểm tra và xử lý')).toBeFocused();
    expect(attempts).toBe(0);
    await section
      .getByLabel('Kết quả kiểm tra và xử lý')
      .fill('Đã kiểm tra khóa và cảm biến tại ô A01.');
    await section.getByRole('button', { name: 'Kiểm tra kết quả xử lý' }).click();
    await expect(section.getByRole('button', { name: 'Xác nhận đóng sự cố' })).toBeFocused();
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
    await section.screenshot({ path: `.impeccable/review/portal-incidents-${width}.png` });
    await section.getByRole('button', { name: 'Xác nhận đóng sự cố' }).click();
    await expect(section.getByRole('alert')).toContainText('Phải chi hoàn');
    await expect(section.getByLabel('Kết quả kiểm tra và xử lý')).toHaveValue(
      'Đã kiểm tra khóa và cảm biến tại ô A01.',
    );
    await section.getByRole('button', { name: 'Kiểm tra kết quả xử lý' }).click();
    await section.getByRole('button', { name: 'Xác nhận đóng sự cố' }).click();
    await expect(section.getByRole('status')).toContainText('Đã ghi nhận xử lý');
    await expect(section.getByRole('status')).toBeFocused();
    await expect(section.getByText('Chưa có sự cố trong nhóm này.')).toBeVisible();
    expect(attempts).toBe(2);
  });
}

test('Queue pagination, read failure and lost resolution response', async ({ page }) => {
  await setup(page);
  let fail = true;
  let resolved = false;
  let attempts = 0;
  await page.route('**/api/admin/incidents?*', (route) => {
    if (fail) return route.fulfill({ status: 503 });
    const url = new URL(route.request().url());
    const pageNumber = Number(url.searchParams.get('page'));
    return route.fulfill({
      json: { items: pageNumber === 2 ? [] : [row], page: pageNumber, hasMore: pageNumber === 1 },
    });
  });
  await page.route('**/api/admin/incidents/incident-1', (route) =>
    route.fulfill({
      json: {
        incident: {
          ...row,
          status: resolved ? 'RESOLVED_FIXED' : 'OPEN',
          decision: resolved ? 'Đã xử lý' : null,
        },
        evidence: { items: [], hasMore: false },
      },
    }),
  );
  await page.route('**/flows/resolve_device_fault', (route) => {
    attempts++;
    resolved = true;
    return route.abort();
  });
  await page.goto('/admin/incidents');
  const section = page.locator('.admin-incidents');
  await expect(section.getByRole('alert')).toContainText('Chưa tải được sự cố');
  fail = false;
  await section.getByRole('button', { name: 'Cập nhật danh sách sự cố' }).click();
  await section.getByRole('button', { name: 'Trang sự cố sau' }).click();
  await expect(section.getByText('Trang 2', { exact: true })).toBeVisible();
  await section.getByRole('button', { name: 'Trang sự cố trước' }).click();
  await section.locator('summary').click();
  await section.getByLabel('Kết quả kiểm tra và xử lý').fill('Đã kiểm tra thực tế.');
  await section.getByRole('button', { name: 'Kiểm tra kết quả xử lý' }).click();
  await section.getByRole('button', { name: 'Xác nhận đóng sự cố' }).click();
  await expect(section.getByRole('status')).toContainText('Chưa xác nhận được kết quả');
  await expect(section.getByRole('heading', { name: 'Đã xử lý', exact: true })).toBeVisible();
  await expect(section.getByRole('button', { name: 'Kiểm tra kết quả xử lý' })).toHaveCount(0);
  expect(attempts).toBe(1);
});

test('Background refresh during pointer activation does not discard an incident confirmation', async ({
  page,
}) => {
  await setup(page);
  let reads = 0;
  let writes = 0;
  let release = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/admin/incidents?*', (route) =>
    route.fulfill({ json: { items: [row], page: 1, hasMore: false } }),
  );
  await page.route('**/api/admin/incidents/incident-1', async (route) => {
    reads++;
    if (reads > 1) await gate;
    await route.fulfill({ json: { incident: row, evidence: { items: [], hasMore: false } } });
  });
  await page.route('**/flows/resolve_device_fault', (route) => {
    writes++;
    return route.fulfill({
      status: 409,
      json: { detail: 'Đã có thay đổi trên máy chủ. Cập nhật hồ sơ.' },
    });
  });
  await page.goto('/admin/incidents');
  const section = page.locator('.admin-incidents');
  await section.locator('summary').click();
  await section.getByLabel('Kết quả kiểm tra và xử lý').fill('Đã kiểm tra thực tế.');
  await section.getByRole('button', { name: 'Kiểm tra kết quả xử lý' }).click();
  const confirm = section.getByRole('button', { name: 'Xác nhận đóng sự cố' });
  await expect(confirm).toBeFocused();
  await confirm.hover();
  await page.mouse.down();
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect.poll(() => reads).toBeGreaterThan(1);
  await page.mouse.up();
  release();
  await expect.poll(() => writes).toBe(1);
  await expect(section.getByRole('alert')).toContainText('Đã có thay đổi trên máy chủ');
});

import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const row = {
  id: 'complaint-1',
  orderId: 'order-1',
  orderCode: 'FB-TEST-1',
  kioskId: 'kiosk-1',
  status: 'OPEN',
  reason: 'Hoa bị dập khi nhận.',
  createdAt: '2026-10-07T10:00:00Z',
  decision: null,
  refundAmount: null,
  resolvedAt: null,
  orderTotal: 350000,
};
async function setup(page: Page) {
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({ json: { id: 'admin', name: 'Quản trị', role: 'ADMIN' } }),
  );
  await page.route('**/api/admin/sellers?*', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/admin/slots', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/packages', (route) => route.fulfill({ json: [] }));
  for (const name of ['incidents', 'withdrawals'])
    await page.route(`**/api/admin/${name}?*`, (route) =>
      route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
    );
}
for (const width of [390, 1440])
  test(`Complaint decision validation, review and accessibility ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    await setup(page);
    let closed = false;
    let attempts = 0;
    const amount = width === 390 ? 100000 : 0;
    await page.route('**/api/admin/complaints?*', (route) =>
      route.fulfill({ json: { items: closed ? [] : [row], page: 1, hasMore: false } }),
    );
    await page.route('**/api/admin/complaints/complaint-1', (route) =>
      route.fulfill({
        json: {
          complaint: row,
          items: [
            {
              name: 'Bó cúc trắng',
              quantity: 1,
              unitPrice: 350000,
              total: 350000,
              status: 'ACTIVE',
            },
          ],
          evidence: {
            items: [
              { id: 'good', url: 'https://example.invalid/flower.jpg' },
              { id: 'bad', url: 'javascript:alert(1)' },
            ],
            hasMore: false,
          },
        },
      }),
    );
    await page.route('**/flows/resolve_dispute', (route) => {
      attempts++;
      expect(route.request().postDataJSON()).toEqual({
        p_dispute: row.id,
        p_refund: amount,
        p_decision: 'Đã đối chiếu ảnh và thông tin đơn.',
      });
      closed = true;
      return route.fulfill({ json: { result: null } });
    });
    await page.goto('/admin/complaints');
    const section = page.locator('.admin-complaints');
    await section.locator('summary').click();
    await expect(section.getByRole('link', { name: 'Xem ảnh phản ánh 1' })).toHaveAttribute(
      'rel',
      'noopener noreferrer',
    );
    await expect(section.getByRole('link', { name: 'Xem ảnh phản ánh 2' })).toHaveCount(0);
    await section.getByRole('button', { name: 'Kiểm tra quyết định' }).click();
    await expect(section.getByLabel('Số tiền đề nghị hoàn (đồng)')).toBeFocused();
    await section.getByLabel('Số tiền đề nghị hoàn (đồng)').fill('350001');
    await section.getByLabel('Lý do và căn cứ xử lý').fill('Đã đối chiếu ảnh và thông tin đơn.');
    await section.getByRole('button', { name: 'Kiểm tra quyết định' }).click();
    await expect(section.getByText('Số tiền không được vượt giá trị đơn.')).toBeVisible();
    await section.getByLabel('Số tiền đề nghị hoàn (đồng)').fill(String(amount));
    await section.getByRole('button', { name: 'Kiểm tra quyết định' }).click();
    await expect(section.locator('h4')).toBeFocused();
    await section.getByRole('button', { name: 'Sửa quyết định' }).click();
    await expect(section.getByLabel('Số tiền đề nghị hoàn (đồng)')).toBeFocused();
    expect(attempts).toBe(0);
    await section.getByRole('button', { name: 'Kiểm tra quyết định' }).click();
    expect(
      (
        await new AxeBuilder({ page })
          .include('.admin-complaints')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await section.screenshot({ path: `.impeccable/review/admin-complaints-${width}.png` });
    await section.getByRole('button', { name: 'Xác nhận quyết định' }).click();
    await expect(section.getByRole('status')).toHaveText(
      'Đã ghi nhận quyết định cho đơn FB-TEST-1.',
    );
    await expect(section.getByRole('status')).toBeFocused();
    expect(attempts).toBe(1);
  });

test('Uncertain decision requires explicit detail reload and shows persisted outcome', async ({
  page,
}) => {
  await setup(page);
  let closed = false;
  let attempts = 0;
  await page.route('**/api/admin/complaints?*', (route) =>
    route.fulfill({ json: { items: [row], page: 1, hasMore: false } }),
  );
  await page.route('**/api/admin/complaints/complaint-1', (route) =>
    route.fulfill({
      json: {
        complaint: {
          ...row,
          status: closed ? 'RESOLVED_REFUND' : 'OPEN',
          refundAmount: 100000,
          decision: 'Đã đối chiếu ảnh.',
        },
        items: [],
        evidence: { items: [], hasMore: false },
      },
    }),
  );
  await page.route('**/flows/resolve_dispute', (route) => {
    attempts++;
    return route.abort();
  });
  await page.goto('/admin/complaints');
  const section = page.locator('.admin-complaints');
  await section.locator('summary').click();
  await section.getByLabel('Số tiền đề nghị hoàn (đồng)').fill('100000');
  await section.getByLabel('Lý do và căn cứ xử lý').fill('Đã đối chiếu ảnh.');
  await section.getByRole('button', { name: 'Kiểm tra quyết định' }).click();
  await section.getByRole('button', { name: 'Xác nhận quyết định' }).click();
  await expect(section.getByRole('alert')).toContainText('Chưa xác nhận được kết quả');
  await expect(section.getByRole('button', { name: 'Kiểm tra quyết định' })).toHaveCount(0);
  closed = true;
  await section.getByRole('button', { name: 'Tải lại hồ sơ' }).click();
  await expect(section.getByRole('heading', { name: 'Đã duyệt hoàn 100.000 đ' })).toBeVisible();
  await expect(section.getByRole('button', { name: 'Kiểm tra quyết định' })).toHaveCount(0);
  expect(attempts).toBe(1);
});

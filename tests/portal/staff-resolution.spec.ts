import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 1440])
  test(`Technician incident repair validation and recovery ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ json: { id: 'actor', name: 'Thảo', role: 'TECHNICIAN' } }),
    );
    let completed = false;
    let attempt: unknown;
    let calls = 0;
    let codeRequests = 0;
    await page.route('**/api/staff/tasks?*', (route) =>
      route.fulfill({
        json: {
          page: 1,
          hasMore: false,
          items: [
            {
              id: 'task',
              kind: 'INCIDENT',
              status: completed ? 'SUBMITTED' : 'IN_PROGRESS',
              version: completed ? 3 : 2,
              assigneeName: 'Thảo',
              kioskName: 'Tủ FPT',
              address: 'Thủ Đức',
              instructions: 'Kiểm tra cửa tủ theo phân công',
            },
          ],
        },
      }),
    );
    await page.route('**/api/staff/tasks/task?*', (route) =>
      route.fulfill({
        json: {
          kioskStatus: 'ONLINE',
          incident: null,
          slotCode: 'S01',
          slotStatus: 'FAULT',
          history: [],
        },
      }),
    );
    await page.route('**/api/staff/tasks/task/repair-access', (route) => {
      expect(route.request().method()).toBe('POST');
      expect(route.request().postData()).toBeNull();
      codeRequests++;
      if (codeRequests === 1) return route.fulfill({ status: 404 });
      return route.fulfill({
        json: {
          id: 'challenge',
          code: '013582',
          expiresAt: new Date(Date.now() + 120_000).toISOString(),
        },
      });
    });
    await page.route('**/api/staff/tasks/task/resolve-incident', (route) => {
      calls++;
      if (calls === 1) {
        attempt = route.request().postDataJSON();
        return route.abort('failed');
      }
      expect(route.request().postDataJSON()).toEqual(attempt);
      completed = true;
      return route.fulfill({ json: { id: 'operation', version: 3 } });
    });
    await page.goto('/technician');
    await page.locator('.technician-task-body > summary').click();
    const access = page.getByRole('region', { name: 'Mã xác nhận sửa ô tủ' });
    await expect(page.getByRole('button', { name: 'Gửi báo cáo', exact: true })).toHaveCount(0);
    const codeButton = access.getByRole('button', { name: 'Lấy mã sửa ô tủ' });
    await codeButton.click();
    await expect(access.getByRole('alert')).toContainText('Kiểm tra chủ shop đã duyệt');
    await codeButton.click();
    await expect(access.getByRole('status')).toContainText('013582');
    expect(
      await page.evaluate(() => {
        return [...Object.values(localStorage), ...Object.values(sessionStorage)]
          .join(' ')
          .includes('013582');
      }),
    ).toBe(false);
    const panel = page.locator('details.staff-resolution');
    await panel.locator('summary').click();
    await panel.getByRole('button', { name: 'Gửi báo cáo sửa ô tủ' }).click();
    await expect(panel.getByText('Mô tả ít nhất 10 ký tự.')).toBeVisible();
    await expect(panel.getByText('Xác nhận đã kiểm tra thực tế tại tủ.')).toBeVisible();
    expect(calls).toBe(0);
    await panel
      .getByLabel('Kết quả sửa chữa và kiểm tra')
      .fill('Đã thay chốt cửa và kiểm tra hoạt động tại tủ.');
    await panel.getByRole('checkbox').check();
    expect(
      (
        await new AxeBuilder({ page })
          .include('.staff-resolution')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    await page.screenshot({ path: `artifacts/staff-resolution-${width}.png`, fullPage: true });
    await panel.getByRole('button', { name: 'Gửi báo cáo sửa ô tủ' }).click();
    await expect(panel.getByRole('alert')).toContainText('Chưa xác nhận được kết quả');
    await page.reload();
    await page.locator('.technician-task-body > summary').click();
    await expect(codeButton).toBeVisible();
    await expect(access.getByText('013582')).toHaveCount(0);
    await panel.locator('summary').click();
    await panel.getByRole('button', { name: 'Gửi lại báo cáo cùng mã thao tác' }).click();
    await expect(panel).toHaveCount(0);
    await expect(
      page.locator('article').getByText('Chờ duyệt báo cáo', { exact: true }),
    ).toBeVisible();
    expect(calls).toBe(2);
    expect(
      await page.evaluate(() =>
        Object.keys(sessionStorage).filter((k) => k.startsWith('florabot-staff-resolution:')),
      ),
    ).toEqual([]);

    // Verify wrong-kind action absent: seller staff never renders technical incident resolution
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: { id: 'seller-staff-1', name: 'Nhân viên', role: 'SELLER_STAFF', sellerId: 'shop-1' },
      }),
    );
    await page.goto('/staff');
    await expect(page.getByText('Ghi nhận đã sửa sự cố')).toHaveCount(0);
  });

test('Whole-kiosk incident reports call resolution instead of a generic task transition', async ({
  page,
}) => {
  let submitted = false;
  const writes: string[] = [];
  await page.route('**/api/**', (route) => {
    const req = route.request();
    const path = new URL(req.url()).pathname;
    if (path === '/api/auth/me')
      return route.fulfill({ json: { id: 'tech', name: 'Kỹ thuật viên', role: 'TECHNICIAN' } });
    if (path === '/api/staff/tasks')
      return route.fulfill({
        json: {
          page: 1,
          hasMore: false,
          items: [
            {
              id: 'whole-kiosk',
              kind: 'INCIDENT',
              status: submitted ? 'SUBMITTED' : 'IN_PROGRESS',
              version: submitted ? 2 : 1,
              assigneeId: 'tech',
              assigneeName: 'Kỹ thuật viên',
              kioskName: 'Kiosk thử nghiệm',
              address: 'Địa điểm thử nghiệm',
              instructions: 'Kiểm tra kết nối toàn bộ kiosk',
              report: null,
            },
          ],
        },
      });
    if (path === '/api/staff/tasks/whole-kiosk')
      return route.fulfill({
        json: {
          kioskStatus: 'ONLINE',
          slotCode: null,
          slotStatus: null,
          history: [],
          incident: {
            kind: 'DEVICE_FAULT',
            status: submitted ? 'RESOLVED_FIXED' : 'OPEN',
            slotId: null,
            reason: 'Mất kết nối',
            createdAt: '2026-11-18T01:00:00Z',
          },
        },
      });
    if (req.method() !== 'GET') {
      writes.push(path);
      expect(path).toBe('/api/staff/tasks/whole-kiosk/resolve-incident');
      const body = req.postDataJSON();
      expect(body.version).toBe(1);
      expect(body.report).toBe('Đã kiểm tra và khắc phục kết nối tại kiosk.');
      expect(body.id).toMatch(/^[0-9a-f-]{36}$/i);
      submitted = true;
      return route.fulfill({ json: { id: body.id, version: 2 } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/technician');
  await page.locator('.technician-task-body > summary').click();
  await expect(page.getByRole('button', { name: 'Gửi báo cáo', exact: true })).toHaveCount(0);
  const panel = page.locator('details.staff-resolution');
  await panel.locator('summary').click();
  await panel
    .getByLabel('Kết quả sửa chữa và kiểm tra')
    .fill('Đã kiểm tra và khắc phục kết nối tại kiosk.');
  await panel.getByRole('checkbox').check();
  await panel.getByRole('button', { name: 'Ghi nhận và gửi báo cáo', exact: true }).click();
  await expect.poll(() => writes).toEqual(['/api/staff/tasks/whole-kiosk/resolve-incident']);
  await expect(page.getByText('Chờ duyệt báo cáo', { exact: true }).last()).toBeVisible();
});

import { expect, test, type Page } from '@playwright/test';
import { chooseOption } from '../fixtures/select';
import { chooseVietnamDate } from '../fixtures/vietnam-date';

const productId = '30000000-0000-0000-0000-000000000001';
const kioskId = '40000000-0000-0000-0000-000000000001';
async function mock(page: Page, role = 'CUSTOMER') {
  await page.route('**/hub/**', (route) => route.abort());
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me')
      return route.fulfill({ json: { id: 'review-user', role, name: 'Kiểm tra giao diện' } });
    if (path === '/api/shop/catalog')
      return route.fulfill({
        json: {
          items: [
            {
              productId,
              kioskId,
              sellerId: 'shop',
              name: 'Hoa kiểm tra',
              shopName: 'Shop hoa',
              kioskName: 'Kiosk kiểm tra',
              address: 'Hà Nội',
              price: 200000,
              bouquets: [],
              zone: 'PREORDER',
              preorderAvailable: true,
            },
          ],
          page: 1,
          hasMore: false,
        },
      });
    if (path.endsWith('/preorder-availability'))
      return route.fulfill({ json: { available: true } });
    if (path.endsWith('/catalog/accessories')) return route.fulfill({ json: [] });
    if (path === '/api/operations/technicians' || path === '/api/operations/eligible-kiosks')
      return route.fulfill({ json: [] });
    if (route.request().method() !== 'GET') return route.abort();
    return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
  });
}

for (const width of [320, 390, 1280]) {
  test(`quote groups required fields before optional accessories at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });
    await mock(page);
    const nearId = '40000000-0000-0000-0000-000000000002';
    const sellerId = '20000000-0000-0000-0000-000000000001';
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 10.77, longitude: 106.68 });
    await page.route('**/api/shop/catalog?*', (route) =>
      route.fulfill({
        json: {
          items: [
            {
              productId,
              sellerId,
              kioskId,
              name: 'Bó hoa tươi - Only rose 18 (Size 50 bông)',
              shopName: 'Shop Hoa Của Tâm',
              kioskName: 'Tủ xa',
              price: 200000,
              zone: 'PREORDER',
              bouquets: [],
              preorderAvailable: true,
            },
            {
              productId,
              sellerId,
              kioskId: nearId,
              name: 'Bó hoa tươi - Only rose 18 (Size 50 bông)',
              shopName: 'Shop Hoa Của Tâm',
              kioskName: 'Tủ gần',
              price: 200000,
              zone: 'PREORDER',
              bouquets: [],
              preorderAvailable: true,
            },
          ],
          hasMore: false,
        },
      }),
    );
    await page.route('**/api/kiosks', (route) =>
      route.fulfill({
        json: [
          { id: kioskId, latitude: 10.9, longitude: 106.78, status: 'ONLINE' },
          { id: nearId, latitude: 10.771, longitude: 106.681, status: 'ONLINE' },
        ],
      }),
    );
    await page.route('**/catalog/accessories', (route) =>
      route.fulfill({
        json: [
          {
            id: 'ribbon',
            name: 'Nơ',
            price: 10000,
            availableQuantity: 5,
          },
        ],
      }),
    );
    await page.goto(`/dat-hoa/${productId}/${kioskId}`);
    await page.getByRole('button', { name: 'Đặt trước', exact: true }).click();
    const panel = page.getByRole('dialog', { name: 'Yêu cầu đặt trước', exact: true });
    const optional = panel.locator('details.flower-request-accessories');
    await expect(optional).not.toHaveAttribute('open');
    const brief = panel.getByRole('textbox', { name: 'Bạn muốn bó hoa như thế nào?', exact: true });
    await brief.fill('Hoa hồng pastel tặng sinh nhật');
    expect(
      await brief.evaluate(
        (el) =>
          !!(
            el.compareDocumentPosition(
              document.querySelector('details.flower-request-accessories')!,
            ) & Node.DOCUMENT_POSITION_FOLLOWING
          ),
      ),
    ).toBe(true);
    await optional.locator('summary').click();
    await panel.getByRole('button', { name: 'Thêm Nơ', exact: true }).click();
    await expect(optional.locator('summary')).toContainText('Đã chọn 1');
    await expect(panel.locator('.flower-request-reference-price')).toContainText('210.000 đ');
    await optional.locator('summary').click();
    await expect(brief).toHaveValue('Hoa hồng pastel tặng sinh nhật');
    await panel.getByRole('button', { name: 'Tìm tủ gần tôi', exact: true }).click();
    await expect(panel.locator('.flower-request-nearest')).toContainText('Tủ gần');
    await panel.getByRole('button', { name: 'Chọn tủ này', exact: true }).click();
    await expect(panel.getByRole('combobox', { name: 'Tủ nhận hoa', exact: true })).toContainText(
      'Tủ gần',
    );
    await optional.locator('summary').click();
    await expect(panel.getByRole('status', { name: 'Số lượng Nơ', exact: true })).toHaveText('1');
    await optional.locator('summary').click();
    await panel.locator('.flower-request-scroll').evaluate((el) => {
      el.scrollTop = 0;
    });
    expect(await panel.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await expect(
      panel.getByRole('button', { name: 'Gửi yêu cầu đặt trước', exact: true }),
    ).toBeVisible();
    const footerBounds = (await panel.locator('.flower-request-footer').boundingBox())!;
    await expect(
      panel.getByRole('button', { name: 'Gửi yêu cầu đặt trước', exact: true }),
    ).toBeInViewport();
    expect(footerBounds.y + footerBounds.height).toBeLessThanOrEqual(780);
    await panel.screenshot({ path: test.info().outputPath('compact-quote-verified.png') });
  });
  test(`quote rejects past hours before submit and keeps calendar/footer in view at ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 780 });
    await page.clock.setFixedTime(new Date('2026-11-26T14:25:00+07:00'));
    await mock(page);
    await page.goto(`/dat-hoa/${productId}/${kioskId}`);
    await page.getByRole('button', { name: 'Đặt trước', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Yêu cầu đặt trước', exact: true });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tư vấn FloraBot', exact: true })).toBeHidden();
    const time = dialog.getByRole('combobox', { name: 'Giờ nhận hoa', exact: true });
    await expect(time).toBeDisabled();
    await chooseVietnamDate(dialog, 'Ngày nhận hoa', '2026-11-26');
    await time.click();
    await expect(page.getByRole('option', { name: '02:00', exact: true })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(page.getByRole('option', { name: '14:30', exact: true })).toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await expect(page.getByRole('option', { name: '15:30', exact: true })).not.toHaveAttribute(
      'aria-disabled',
      'true',
    );
    await page.keyboard.press('Escape');
    await chooseOption(time, '15:30');
    await expect(dialog.locator('.flower-request-field-error')).toHaveCount(0);
    const footer = dialog.locator('.flower-request-footer');
    const before = await footer.boundingBox();
    await page.clock.setFixedTime(new Date('2026-11-26T14:31:00+07:00'));
    await page.evaluate(() => window.dispatchEvent(new Event('focus')));
    await expect(
      dialog.getByRole('alert').filter({ hasText: 'Giờ nhận phải sau ít nhất 1 giờ' }),
    ).toBeVisible();
    const after = await footer.boundingBox();
    expect(Math.abs(after!.y - before!.y)).toBeLessThanOrEqual(2);
    await dialog.getByRole('combobox', { name: 'Ngày nhận hoa', exact: true }).click();
    const calendar = page.locator('[data-vietnam-calendar]');
    const bounds = await calendar.boundingBox();
    expect(bounds!.x).toBeGreaterThanOrEqual(0);
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(780);
    await page.screenshot({ path: test.info().outputPath(`quote-calendar-${width}.png`) });
  });
}

test('hiding floating launchers does not hide the advisor dialog itself', async ({ page }) => {
  await mock(page);
  await page.goto('/dat-hoa');
  const launcher = page.getByRole('button', { name: 'Tư vấn FloraBot', exact: true });
  await launcher.click();
  const dialog = page.getByRole('dialog', { name: 'Tư vấn FloraBot', exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('textbox', { name: 'Câu hỏi cho FloraBot' })).toBeVisible();
  await expect(launcher).toBeHidden();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(launcher).toBeVisible();
});

for (const [role, path] of [
  ['TECHNICIAN', '/technician'],
  ['OPERATIONS_MANAGER', '/operations'],
  ['OPERATIONS_MANAGER', '/operations/tasks'],
  ['ADMIN', '/admin/tasks'],
]) {
  test(`${role} desktop sidebar opens on hover and collapses without shifting content at ${path}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await mock(page, role);
    await page.goto(path);
    const sidebar = page.locator('.workspace-sidebar');
    await expect(sidebar).toHaveCSS('width', '78px');
    const content = await page.locator('.dashboard-content').boundingBox();
    await sidebar.hover();
    await expect(sidebar).toHaveCSS('width', '258px');
    expect((await page.locator('.dashboard-content').boundingBox())!.x).toBe(content!.x);
    await page.mouse.move(1200, 100);
    await expect(sidebar).toHaveCSS('width', '78px');
  });
}

for (const [role, path] of [
  ['TECHNICIAN', '/technician'],
  ['OPERATIONS_MANAGER', '/operations/tasks'],
  ['ADMIN', '/admin/tasks'],
]) {
  test(`${role} mobile content gets full width and menu restores focus`, async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mock(page, role);
    await page.goto(path);
    const main = page.locator('.workspace-portal-root .dashboard-content');
    await expect(main).toBeVisible();
    await expect.poll(async () => (await main.boundingBox())?.width ?? 0).toBeGreaterThan(340);
    const navigation = page.getByRole('navigation', { name: 'Điều hướng quản lý' });
    await expect(navigation).toBeHidden();
    await page.getByRole('button', { name: 'Mở danh mục quản lý', exact: true }).click();
    await expect(navigation).toBeVisible();
    await navigation.getByRole('link').first().focus();
    await page.keyboard.press('Escape');
    await expect(navigation).toBeHidden();
    await expect(
      page.getByRole('button', { name: 'Mở danh mục quản lý', exact: true }),
    ).toBeFocused();
    await page.screenshot({ path: test.info().outputPath(`workspace-${role}.png`) });
  });
}

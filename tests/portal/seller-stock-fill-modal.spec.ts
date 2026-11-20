import { test, expect } from '@playwright/test';

for (const [width, sensor, offline] of [
  [1440, false, false],
  [390, false, false],
  [1440, true, false],
  [390, false, true],
] as const) {
  test(`stock modal selects a product and preserves ${offline ? 'offline blocking' : sensor ? 'sensor' : 'legacy'} flow at ${width}px`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    const kiosk = '10000000-0000-0000-0000-000000000001';
    const slot = '20000000-0000-0000-0000-000000000001';
    const product = '30000000-0000-0000-0000-000000000001';
    const writes: { path: string; body: Record<string, unknown> }[] = [];
    const assignmentWrites: Record<string, unknown>[] = [];
    await page.setViewportSize({ width, height: 960 });
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me')
        return route.fulfill({
          json: {
            id: 'fill-user',
            name: 'Shop',
            role: 'SELLER',
            sellerId: 'fill-shop',
            sellerStatus: 'ACTIVE',
          },
        });
      if (path === '/api/sellers/fill-shop/kiosks')
        return route.fulfill({
          json: [{ id: kiosk, code: 'K01', name: 'Kiosk', status: offline ? 'OFFLINE' : 'ONLINE' }],
        });
      if (path === `/api/me/kiosks/${kiosk}/slots`)
        return route.fulfill({
          json: [
            {
              id: slot,
              kioskId: kiosk,
              slotCode: 'S01',
              zone: 'WALK_IN',
              status: 'RENTED_EMPTY',
              bouquetId: null,
              sensorEnabled: sensor,
              sensorReady: sensor,
            },
          ],
        });
      if (path === '/api/me/products')
        return route.fulfill({
          json: [
            {
              id: product,
              name: 'Hoa hồng',
              price: 350000,
              quantity: 1,
              status: 'ACTIVE',
              shelfLifeHours: 24,
            },
          ],
        });
      if (path.endsWith('/active')) return route.fulfill({ status: 204 });
      if (path === '/api/sellers/fill-shop/staff')
        return route.fulfill({ json: [{ id: 'staff-1', name: 'Nhân viên A' }] });
      if (path.includes('/photos'))
        return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
      if (path === '/api/me/inventory-tasks' && route.request().method() === 'POST') {
        assignmentWrites.push(route.request().postDataJSON());
        return route.fulfill({ json: { id: assignmentWrites[0].id } });
      }
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        writes.push({ path, body });
        return route.fulfill({
          json: sensor
            ? {
                id: body.sessionId,
                stage: 'AwaitLoading',
                action: 'LOAD',
                slotId: slot,
                kioskId: kiosk,
                expiresAt: new Date(Date.now() + 600000).toISOString(),
              }
            : { id: 'stock-result' },
        });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto('/seller/stock');
    await page.getByRole('button', { name: 'Xem chi tiết ô S01', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Nạp hoa vào ô S01', exact: true });
    const submit = modal.getByRole('button', {
      name: sensor ? 'Mở ô và nạp hoa' : 'Nạp hoa',
      exact: true,
    });
    await expect(submit).toBeDisabled();
    const picker = modal.getByRole('combobox', { name: 'Mẫu hoa', exact: true });
    expect((await picker.boundingBox())!.height).toBeLessThanOrEqual(48);
    await picker.click();
    await page.getByRole('option', { name: 'Hoa hồng — Còn 1 bó', exact: true }).click();
    await page.screenshot({ path: testInfo.outputPath(`stock-fill-${width}.png`) });
    if (offline) {
      await expect(submit).toBeDisabled();
      await expect(
        modal.getByText('Kiosk đang ngoại tuyến. Chờ tủ kết nối lại để nạp hoa.', { exact: true }),
      ).toBeVisible();
      expect(writes).toEqual([]);
      return;
    }
    if (sensor) {
      await modal.getByRole('tab', { name: 'Giao nhân viên', exact: true }).click();
      await expect(modal.getByRole('button', { name: 'Giao việc', exact: true })).toBeVisible();
      await expect(submit).toBeHidden();
      await modal
        .getByLabel('Hướng dẫn nhân viên', { exact: true })
        .fill('Nạp hoa đúng mẫu vào ô S01.');
      await modal.getByRole('combobox', { name: 'Nhân viên', exact: true }).click();
      await page.getByRole('option', { name: 'Nhân viên A', exact: true }).click();
      await modal.getByRole('combobox', { name: 'Mẫu hoa', exact: true }).click();
      await page.getByRole('option', { name: 'Hoa hồng', exact: true }).click();
      await page.screenshot({ path: testInfo.outputPath('stock-assign.png') });
      await modal.getByRole('button', { name: 'Giao việc', exact: true }).click();
      await expect(
        modal.getByText('Đã giao công việc cho nhân viên.', { exact: true }),
      ).toBeVisible();
      expect(assignmentWrites).toHaveLength(1);
      expect(assignmentWrites[0]).toMatchObject({
        assigneeId: 'staff-1',
        action: 'LOAD',
        slotId: slot,
        kioskId: kiosk,
        productId: product,
        expectedBouquetId: null,
      });
      await modal.getByRole('tab', { name: 'Tự thao tác tại tủ', exact: true }).click();
      await expect(picker).toContainText('Hoa hồng');
      expect(writes).toEqual([]);
      await modal.getByText('Ghi chú nạp hoa', { exact: true }).click();
      const reason = modal.getByRole('textbox', { name: 'Lý do nạp hoa', exact: true });
      await reason.fill('');
      await expect(submit).toBeDisabled();
      await expect(
        modal.getByText('Nhập lý do nạp hoa ít nhất 5 ký tự.', { exact: true }),
      ).toBeVisible();
      await reason.fill('Nạp hoa bán trực tiếp');
    }
    await expect(submit).toBeEnabled();
    await expect(modal.getByText('Hạn bán 24 giờ từ lúc nạp', { exact: true })).toBeVisible();
    await expect(modal.locator('.stock-slot-support')).not.toHaveAttribute('open', '');
    expect(await modal.locator('select[size]').count()).toBe(0);
    await page.screenshot({ path: test.info().outputPath(`fill-${width}-${sensor}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await submit.click();
    await expect.poll(() => writes.length).toBe(1);
    if (sensor) {
      expect(writes[0].path).toBe('/api/me/maintenance-open');
      expect(writes[0].body).toMatchObject({
        slotId: slot,
        kioskId: kiosk,
        productId: product,
        action: 'LOAD',
        operation: 'START',
        expectedBouquetId: null,
      });
    } else
      expect(writes[0]).toEqual({
        path: '/api/me/flows/stock_bouquet',
        body: { productId: product, slotId: slot },
      });
  });
}

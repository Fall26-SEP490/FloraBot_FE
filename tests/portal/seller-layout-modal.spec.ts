import { test, expect } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`seller layout modal balances slot selections and submits at ${width}px`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    const writes: unknown[] = [];
    await page.setViewportSize({ width, height: 960 });
    await page.route('**/api/**', (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me')
        return route.fulfill({
          json: {
            id: 'layout-user',
            name: 'Shop',
            role: 'SELLER',
            sellerId: 'layout-shop',
            sellerStatus: 'ACTIVE',
          },
        });
      if (path === '/api/sellers/layout-shop/kiosks')
        return route.fulfill({
          json: [{ id: 'layout-kiosk', name: 'Kiosk', code: 'K01', status: 'ONLINE' }],
        });
      if (path === '/api/me/kiosks/layout-kiosk/slots')
        return route.fulfill({
          json: Array.from({ length: 4 }, (_, i) => ({
            id: `slot-${i}`,
            slotCode: `A0${i + 1}`,
            kioskId: 'layout-kiosk',
            status: 'RENTED_EMPTY',
            zone: i < 2 ? 'WALK_IN' : 'PREORDER',
            bouquetId: null,
            sensorEnabled: false,
          })),
        });
      if (route.request().method() === 'POST') {
        expect(path).toBe('/api/me/kiosks/layout-kiosk/layout-requests');
        writes.push(route.request().postDataJSON());
        return route.fulfill({ json: { id: 'layout-request' } });
      }
      return route.fulfill({ json: [] });
    });
    await page.goto('/seller/stock');
    await page.getByRole('button', { name: 'Yêu cầu đổi ô tủ', exact: true }).click();
    const modal = page.getByRole('dialog', { name: 'Đổi ô tủ', exact: true });
    const close = modal.locator('.management-modal-close');
    await expect(close).toBeVisible();
    for (const hovered of [false, true]) {
      if (hovered) await close.hover();
      const surface = await close.evaluate((el) => {
        const style = getComputedStyle(el);
        return {
          border: style.borderTopWidth,
          background: style.backgroundColor,
          shadow: style.boxShadow,
        };
      });
      expect(surface).toEqual({ border: '0px', background: 'rgba(0, 0, 0, 0)', shadow: 'none' });
    }
    const walk = modal.getByRole('combobox', { name: 'Ô tại chỗ', exact: true });
    const preorder = modal.getByRole('combobox', { name: 'Ô đặt trước', exact: true });
    const submit = modal.getByRole('button', { name: 'Gửi yêu cầu', exact: true });
    await expect(walk).toHaveText('2 ô');
    await expect(preorder).toHaveText('2 ô');
    expect((await walk.boundingBox())!.y).toBe((await preorder.boundingBox())!.y);
    await expect(submit).toBeDisabled();
    await walk.click();
    await page.getByRole('option', { name: '3 ô', exact: true }).click();
    await expect(preorder).toHaveText('1 ô');
    await preorder.click();
    await page.getByRole('option', { name: '3 ô', exact: true }).click();
    await expect(walk).toHaveText('1 ô');
    const reason = modal.getByRole('textbox', { name: 'Lý do', exact: true });
    await reason.fill('Tăng ô đặt trước dịp lễ');
    expect(await reason.evaluate((el) => getComputedStyle(el).borderTopStyle)).toBe('solid');
    await expect(submit).toBeEnabled();
    await page.screenshot({ path: test.info().outputPath(`layout-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await submit.click();
    await expect(modal.getByText('Đã gửi yêu cầu.', { exact: true })).toBeVisible();
    expect(writes).toEqual([
      { walkInSlots: 1, preorderSlots: 3, reason: 'Tăng ô đặt trước dịp lễ' },
    ]);
    await modal.getByRole('button', { name: 'Hủy', exact: true }).click();
    await expect(modal).not.toBeVisible();
  });
}

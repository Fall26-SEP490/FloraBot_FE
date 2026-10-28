import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test('Avatar menu preserves workspace, purchase, and profile destinations for every role', async ({
  page,
}) => {
  for (const [role, label, destination] of [
    ['ADMIN', 'Quản trị hệ thống', '/admin'],
    ['OPERATIONS_MANAGER', 'Điều hành vận hành', '/operations'],
    ['TECHNICIAN', 'Công việc kỹ thuật', '/technician'],
    ['SELLER_STAFF', 'Công việc tại shop', '/staff'],
    ['STAFF', 'Khu vực làm việc', '/workspace'],
    ['CUSTOMER', 'Hoạt động mua hoa', '/tai-khoan'],
    ['SELLER', 'Quản lý shop', '/seller'],
  ]) {
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ json: { id: role, role, name: 'UAT' } }),
    );
    await page.goto('/ve-florabot');
    const header = page.getByRole('banner');
    await header.getByRole('button', { name: 'Mở menu người dùng của UAT' }).click();
    await expect(header.getByRole('link', { name: label, exact: true })).toHaveAttribute(
      'href',
      destination,
    );
    await expect(header.getByRole('link', { name: 'Hồ sơ cá nhân', exact: true })).toHaveAttribute(
      'href',
      '/ho-so',
    );
    if (role === 'SELLER') {
      await expect(
        header.getByRole('link', { name: 'Hoạt động mua hoa', exact: true }),
      ).toHaveAttribute('href', '/tai-khoan');
    }
    await page.unroute('**/api/auth/me');
  }
});

for (const width of [390, 1440]) {
  test(`Public shell persists across navigation and preserves form input ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    let documents = 0;
    let sessions = 0;
    let catalogs = 0;
    page.on('request', (request) => {
      if (request.resourceType() === 'document') documents++;
    });
    await page.route('**/api/auth/me', (route) => {
      sessions++;
      return route.fulfill({ json: { id: 'member', name: 'Hoa', role: 'CUSTOMER' } });
    });
    await page.route('**/api/shop/catalog?*', (route) => {
      catalogs++;
      return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
    });
    await page.goto('/ve-florabot');
    const header = page.getByRole('banner');
    const footer = page.getByRole('contentinfo');
    const accountToggle = header.getByRole('button', { name: 'Mở menu người dùng của Hoa' });
    await expect(accountToggle).toBeVisible();
    await accountToggle.click();
    await expect(header.locator('#site-user-menu')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(header.locator('#site-user-menu')).toHaveCount(0);
    await expect(accountToggle).toBeFocused();
    const originalHeader = await header.elementHandle();
    const originalFooter = await footer.elementHandle();
    if (width < 1250) await header.getByRole('button', { name: 'Menu', exact: true }).click();
    await header.getByRole('link', { name: 'Sản phẩm hoa', exact: true }).click();
    await expect(page).toHaveURL('/dat-hoa');
    await expect(page.locator('.catalog-empty-title')).toContainText('chưa có mẫu hoa', {
      ignoreCase: true,
    });
    expect(
      await originalHeader!.evaluate((element) => element === document.querySelector('header')),
    ).toBe(true);
    expect(
      await originalFooter!.evaluate((element) => element === document.querySelector('footer')),
    ).toBe(true);
    if (width < 1250) {
      await expect(header.getByRole('navigation')).toBeHidden();
      const toggle = header.getByRole('button', { name: 'Menu', exact: true });
      await toggle.click();
      await header.getByRole('link', { name: 'Sản phẩm hoa', exact: true }).focus();
      await page.keyboard.press('Escape');
      await expect(toggle).toBeFocused();
    }
    const search = page.getByLabel('Tìm mẫu hoa, shop hoặc tủ nhận');
    await search.fill('Hoa hồng');
    await page.clock.install();
    await page.clock.fastForward(65_000);
    await expect(search).toHaveValue('Hoa hồng');
    expect(sessions).toBe(1);
    expect(catalogs).toBe(1);
    await footer.getByRole('link', { name: 'Liên hệ & hỗ trợ' }).click();
    await expect(page).toHaveURL('/lien-he');
    expect(documents).toBe(1);
    await expect(page.getByRole('banner')).toHaveCount(1);
    await expect(page.getByRole('contentinfo')).toHaveCount(1);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `artifacts/shared-shell-${width}.png`, fullPage: true });
  });
}

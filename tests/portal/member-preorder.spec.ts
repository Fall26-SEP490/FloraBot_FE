import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const member = {
  id: '10000000-0000-0000-0000-000000000010',
  name: 'Khách yêu hoa',
  role: 'CUSTOMER',
  sellerId: null,
  sellerStatus: null,
  packageExpiresAt: null,
};
const flower = {
  productId: '30000000-0000-0000-0000-000000000001',
  sellerId: '20000000-0000-0000-0000-000000000001',
  shopName: 'Tiệm Hoa Nhỏ',
  name: 'Hoa hồng pastel',
  description: 'Bó hồng dành cho sinh nhật',
  price: 350000,
  kioskId: '40000000-0000-0000-0000-000000000001',
  kioskName: 'Tủ FPT',
  address: 'Thủ Đức',
  photo: null,
  bouquets: ['50000000-0000-0000-0000-000000000001'],
};
for (const role of ['CUSTOMER', 'SELLER'])
  for (const kind of ['CUSTOM', 'STOCK'])
    test(`${role} places ${kind} with explicit review and no door action`, async ({ page }) => {
      await page.route('**/api/auth/me', (route) => route.fulfill({ json: { ...member, role } }));
      await page.route('**/api/shop/catalog?*', (route) =>
        route.fulfill({ json: { items: [flower], page: 1, hasMore: false } }),
      );
      let submitted = 0;
      await page.route('**/api/member/preorders', async (route) => {
        const input = route.request().postDataJSON();
        expect(input.kind).toBe(kind);
        expect(input.productId).toBe(flower.productId);
        expect(input.kioskId).toBe(flower.kioskId);
        expect(input.id).toMatch(/^[a-f0-9-]{36}$/);
        submitted++;
        await route.fulfill({ json: { result: input.id } });
      });
      await page.goto('/dat-hoa');
      await page.getByRole('button', { name: 'Chọn mẫu và cách nhận' }).click();
      if (kind === 'CUSTOM') {
        await page.getByLabel('Thời gian mong muốn nhận hoa').fill('2026-10-10T16:30');
        await page
          .getByLabel('Dịp tặng, màu hoa, ngân sách và lời nhắn')
          .fill('Hoa sinh nhật màu hồng, ngân sách 400.000 đồng');
      } else await page.getByRole('radio', { name: /Mua hoa có sẵn/ }).check();
      await page.getByRole('checkbox').check();
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(axe.violations).toEqual([]);
      await page
        .getByRole('button', {
          name:
            kind === 'CUSTOM' ? 'Gửi yêu cầu để shop báo giá' : 'Giữ bó hoa và tiếp tục thanh toán',
          exact: true,
        })
        .click();
      await expect(page.getByRole('heading', { name: 'Đã nhận yêu cầu của bạn' })).toBeVisible();
      expect(submitted).toBe(1);
    });

for (const width of [390, 1440])
  test(`Member registration is accessible and responsive ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/dang-ky');
    await expect(page.getByRole('heading', { name: 'Tạo tài khoản FloraBot' })).toBeVisible();
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({
      path: `.impeccable/review/member-register-${width}.png`,
      fullPage: true,
    });
  });

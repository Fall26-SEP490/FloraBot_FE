import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

for (const width of [390, 820, 1440])
  test(`Navigation stays available and does not cover anchor headings ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const header = page.locator('.site-header');
    await expect(header).toHaveClass(/navigation-ready/);
    const menu = page.getByRole('button', { name: 'Menu' });
    if (await menu.isVisible()) await menu.click();
    await page
      .getByRole('navigation', { name: 'Điều hướng chính' })
      .getByRole('link', { name: 'Vị trí tủ', exact: true })
      .click();
    await expect(page).toHaveURL(/#vi-tri$/);
    await expect
      .poll(() => header.evaluate((element) => Math.round(element.getBoundingClientRect().top)))
      .toBe(0);
    const bounds = await page.evaluate(() => ({
      header: document.querySelector('.site-header')!.getBoundingClientRect().bottom,
      target: document.querySelector('#locations-title')!.getBoundingClientRect().top,
    }));
    expect(bounds.target).toBeGreaterThanOrEqual(bounds.header);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page.screenshot({ path: `.impeccable/review/sticky-navigation-${width}.png` });
  });

for (const width of [390, 1440])
  test(`Customer navigation has real pages and keyboard accessible menu ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const header = page.locator('.site-header');
    await expect(header).toHaveClass(/navigation-ready/);
    const menu = page.getByRole('button', { name: 'Menu' });
    const nav = page.getByRole('navigation', { name: 'Điều hướng chính' });
    if (await menu.isVisible()) {
      await menu.click();
      await expect(menu).toHaveAttribute('aria-expanded', 'true');
      await page.keyboard.press('Escape');
      await expect(menu).toBeFocused();
      await expect(nav).toBeHidden();
      await menu.click();
    }
    for (const name of [
      'Trang chủ',
      'Về chúng tôi',
      'Sản phẩm hoa',
      'Cách đặt & nhận hoa',
      'Vị trí tủ',
      'Liên hệ',
    ])
      await expect(nav.getByRole('link', { name, exact: true })).toBeVisible();
    await page.screenshot({ path: `.impeccable/review/customer-navigation-${width}.png` });
    await nav.getByRole('link', { name: 'Về chúng tôi' }).click();
    await expect(page).toHaveURL(/\/ve-florabot$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Hoa cho những điều bạn muốn nói.',
    );
    for (const [path, heading] of [
      ['/huong-dan-dat-hoa', 'Từ một ý tưởng nhỏ đến bó hoa trên tay.'],
      ['/lien-he', 'Bạn cần hỗ trợ điều gì?'],
    ]) {
      await page.goto(path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(heading);
      expect(
        (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
          .violations,
      ).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );
    }
    await page.goto('/#dat-truoc');
    const preorder = page.locator('#dat-truoc');
    await expect(preorder.locator('ol > li')).toHaveCount(3);
    expect(
      (
        await new AxeBuilder({ page })
          .include('#dat-truoc')
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(
      await page
        .locator('.site-header')
        .evaluate((element) => Math.round(element.getBoundingClientRect().width)),
    ).toBe(width);
    await preorder.screenshot({ path: `.impeccable/review/preorder-section-${width}.png` });
  });

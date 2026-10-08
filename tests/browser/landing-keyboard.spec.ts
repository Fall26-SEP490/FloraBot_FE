import { expect, test } from '@playwright/test';

const focusable = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[tabindex]';

for (const path of ['/', '/chinh-sach-rieng-tu']) {
  test(`Expanded page keeps 44px targets and a complete keyboard path: ${path}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    if (path === '/') {
      const map = page.getByRole('button', { name: 'Mở bản đồ', exact: true });
      await map.scrollIntoViewIfNeeded();
      await map.click();
      await expect(page.locator('.leaflet-container')).toBeVisible();
      await page.locator('#dang-ky').scrollIntoViewIfNeeded();
      await expect(page.locator('#dang-ky button[type=submit]')).toBeEnabled();
    }
    // Include controls inside all optional disclosures, not just the initial fold.
    await page.locator('details').evaluateAll((elements) =>
      elements.forEach((element) => {
        (element as HTMLDetailsElement).open = true;
      }),
    );
    if (path === '/') {
      await page.locator('.gift-demo').scrollIntoViewIfNeeded();
      await expect(page.getByRole('button', { name: 'Xem gợi ý hoa', exact: true })).toBeEnabled();
    }
    await page.evaluate(() => document.fonts.ready);
    const targets = await page.locator(focusable).evaluateAll((elements) =>
      elements
        .filter((element) => {
          const target = element as HTMLElement;
          return (
            target.tabIndex >= 0 &&
            !target.matches(':disabled') &&
            target.getClientRects().length > 0
          );
        })
        .map((element) => {
          const rect = element.getBoundingClientRect();
          return {
            width: rect.width,
            height: rect.height,
            name: element.textContent?.trim() || element.id,
          };
        }),
    );
    expect(targets.length).toBeGreaterThan(10);
    expect(targets.filter((target) => target.width < 44 || target.height < 44)).toEqual([]);

    await page.getByRole('link', { name: 'Bỏ qua tới nội dung', exact: true }).focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    const seen = new Set<number>();
    for (let index = 0; index < targets.length; index++) {
      const focused = await page.evaluate((selector) => {
        const elements = [...document.querySelectorAll<HTMLElement>(selector)].filter(
          (element) =>
            element.tabIndex >= 0 &&
            !element.matches(':disabled') &&
            element.getClientRects().length > 0,
        );
        const active = document.activeElement as HTMLElement;
        const rect = active.getBoundingClientRect();
        const style = getComputedStyle(active);
        const left = Math.max(0, rect.left),
          right = Math.min(innerWidth, rect.right);
        const top = Math.max(0, rect.top),
          bottom = Math.min(innerHeight, rect.bottom);
        const visible =
          right - left >= Math.min(44, rect.width) && bottom - top >= Math.min(44, rect.height);
        const hit = visible
          ? document.elementFromPoint((left + right) / 2, (top + bottom) / 2)
          : null;
        return {
          index: elements.indexOf(active),
          name: active.textContent?.trim() || active.id,
          visible: visible && hit !== null && active.contains(hit),
          outline: style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) >= 2,
        };
      }, focusable);
      expect(focused.index, focused.name).toBeGreaterThanOrEqual(0);
      expect(
        seen.has(focused.index),
        `Repeated focus before reaching all controls: ${focused.name}`,
      ).toBe(false);
      expect(focused.visible, `Focus hidden or obscured: ${focused.name}`).toBe(true);
      expect(focused.outline, `Missing visible outline: ${focused.name}`).toBe(true);
      seen.add(focused.index);
      if (index < targets.length - 1) await page.keyboard.press('Tab');
    }
    expect(seen.size).toBe(targets.length);
    // Reverse navigation must also escape the map and reach the first control.
    for (let index = 1; index < targets.length; index++) await page.keyboard.press('Shift+Tab');
    await expect(
      page.getByRole('link', { name: 'Bỏ qua tới nội dung', exact: true }),
    ).toBeFocused();
  });
}

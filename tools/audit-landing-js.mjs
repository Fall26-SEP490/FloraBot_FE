/* global document, performance, TextEncoder */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { chromium } from '@playwright/test';

const url = process.env.LANDING_AUDIT_URL || 'http://127.0.0.1:3010/';
const target = new URL(url);
if (!['127.0.0.1', 'localhost'].includes(target.hostname)) {
  throw new Error('Use a local production preview for this audit.');
}
const builtHtml = await readFile('apps/web/.next/server/app/index.html');
const report = {
  measuredAt: new Date().toISOString(),
  url,
  builtHtmlSha256: createHash('sha256').update(builtHtml).digest('hex'),
  budgetBytes: 100000,
  budgetEnforced: false,
  definition:
    'JavaScript response bodies plus executable inline scripts; cold browser contexts. Initial viewport and fully hydrated islands are separate measurements. Encoded totals conservatively add uncompressed inline bytes; headers are excluded.',
  viewports: [],
};

const browser = await chromium.launch();
try {
  for (const width of [390, 820, 1440]) {
    const context = await browser.newContext({
      viewport: { width, height: 1000 },
      serviceWorkers: 'block',
    });
    const page = await context.newPage();
    const protocol = await context.newCDPSession(page);
    await protocol.send('Network.enable');
    await protocol.send('Network.setCacheDisabled', { cacheDisabled: true });
    const response = await page.goto(url);
    if (!response?.ok()) throw new Error('Landing preview is unavailable.');
    const servedHash = createHash('sha256')
      .update(await response.body())
      .digest('hex');
    if (servedHash !== report.builtHtmlSha256)
      throw new Error('Preview does not serve the current production build.');
    await page.waitForLoadState('networkidle');

    async function snapshot() {
      return page.evaluate(() => {
        const resources = performance
          .getEntriesByType('resource')
          .filter((entry) => /\.m?js(?:\?|$)/.test(entry.name))
          .map((entry) => ({
            url: entry.name,
            encodedBytes: entry.encodedBodySize,
            decodedBytes: entry.decodedBodySize,
          }));
        const inlineBytes = Array.from(document.querySelectorAll('script:not([src])'))
          .filter(
            (script) =>
              !script.type ||
              ['module', 'text/javascript', 'application/javascript'].includes(script.type),
          )
          .reduce(
            (total, script) =>
              total + new TextEncoder().encode(script.textContent || '').byteLength,
            0,
          );
        return {
          inlineBytes,
          encodedBodyBytes:
            inlineBytes + resources.reduce((total, entry) => total + entry.encodedBytes, 0),
          decodedBodyBytes:
            inlineBytes + resources.reduce((total, entry) => total + entry.decodedBytes, 0),
          resources,
        };
      });
    }

    const initial = await snapshot();
    const openMap = page.getByRole('button', { name: 'Mở bản đồ', exact: true });
    await openMap.scrollIntoViewIfNeeded();
    await openMap.click();
    await page.locator('.leaflet-container').waitFor();
    await page.locator('.gift-tool > summary').click();
    await page.locator('.gift-demo').scrollIntoViewIfNeeded();
    await page.getByRole('button', { name: 'Xem gợi ý hoa', exact: true }).click();
    await page.locator('.gift-results li').first().waitFor();
    await page.waitForFunction(() => {
      const button = document.querySelector('.gift-demo button');
      return button && !button.disabled;
    });
    await page.locator('#dang-ky').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const button = document.querySelector('#dang-ky button[type="submit"]');
      return button && !button.disabled;
    });
    await page.waitForLoadState('networkidle');
    const interactive = await snapshot();
    if (interactive.resources.some((entry) => entry.decodedBytes === 0)) {
      throw new Error(
        'Missing resource-size evidence; inspect same-origin timing before claiming a budget result.',
      );
    }
    report.viewports.push({
      width,
      height: 1000,
      initial,
      interactive,
      initialUnderBudget: initial.decodedBodyBytes < report.budgetBytes,
      interactiveUnderBudget: interactive.decodedBodyBytes < report.budgetBytes,
    });
    console.log(
      `${width}px: initial ${initial.decodedBodyBytes} bytes; fully interactive ${interactive.decodedBodyBytes} bytes (decoded, including inline).`,
    );
    await context.close();
  }
} finally {
  await browser.close();
}
await mkdir('artifacts', { recursive: true });
await writeFile('artifacts/landing-js-budget.json', JSON.stringify(report, null, 2) + '\n');
console.log(
  'JavaScript sizes are informational; the user removed the 100 kB release gate on 2026-10-08.',
);

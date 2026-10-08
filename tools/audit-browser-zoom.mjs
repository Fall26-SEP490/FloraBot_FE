/* global window, document, chrome */
import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { chromium } from '@playwright/test';

const origin = 'http://127.0.0.1:3010';
const temporary = await mkdtemp(join(tmpdir(), 'florabot-browser-zoom-'));
assert.equal(dirname(resolve(temporary)), resolve(tmpdir()), 'Unexpected temporary directory');
assert(basename(temporary).startsWith('florabot-browser-zoom-'));
const extension = join(temporary, 'extension');
await mkdir(extension);
await writeFile(
  join(extension, 'manifest.json'),
  JSON.stringify({
    manifest_version: 3,
    name: 'FloraBot local zoom verification',
    version: '1.0.0',
    background: { service_worker: 'worker.js' },
    permissions: ['tabs'],
    host_permissions: [origin + '/*'],
  }),
);
await writeFile(join(extension, 'worker.js'), 'chrome.runtime.onInstalled.addListener(() => {});');
await mkdir('artifacts', { recursive: true });
await mkdir('.impeccable/review', { recursive: true });
const report = {
  measuredAt: new Date().toISOString(),
  mechanism: 'chrome.tabs.setZoom/getZoom in an isolated Chromium profile',
  pages: [],
};
let context;
try {
  // Full Chromium supports extensions in headless mode; the default headless shell does not.
  context = await chromium.launchPersistentContext(join(temporary, 'profile'), {
    channel: 'chromium',
    headless: true,
    viewport: null,
    args: [
      '--window-size=1440,1000',
      `--disable-extensions-except=${extension}`,
      `--load-extension=${extension}`,
    ],
  });
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  const page = context.pages()[0] ?? (await context.newPage());
  const protocol = await context.newCDPSession(page);
  for (const [route, file, name] of [
    ['/', 'index.html', 'landing'],
    ['/chinh-sach-rieng-tu', 'chinh-sach-rieng-tu.html', 'privacy'],
  ]) {
    const response = await page.goto(origin + route);
    assert(response?.ok(), 'Production preview unavailable');
    const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
    const htmlHash = hash(await response.body());
    assert.equal(
      htmlHash,
      hash(await readFile(join('apps/web/.next/server/app', file))),
      'Preview must serve the current build',
    );
    const tabId = await worker.evaluate(async (url) => {
      const tabs = await chrome.tabs.query({ url: url + '*' });
      if (tabs.length !== 1) throw new Error('Expected exactly one local test tab');
      return tabs[0].id;
    }, origin + route);
    const setZoom = async (factor) => {
      await worker.evaluate(async ({ id, value }) => chrome.tabs.setZoom(id, value), {
        id: tabId,
        value: factor,
      });
      assert.equal(await worker.evaluate((id) => chrome.tabs.getZoom(id), tabId), factor);
      await page.evaluate(() => document.fonts.ready);
    };
    const metrics = () =>
      page.evaluate(() => ({
        innerWidth: window.innerWidth,
        outerWidth: window.outerWidth,
        devicePixelRatio: window.devicePixelRatio,
        visualScale: window.visualViewport.scale,
        fontSize: window.getComputedStyle(document.documentElement).fontSize,
        scrollWidth: document.documentElement.scrollWidth,
      }));
    await setZoom(1);
    const before = await metrics();
    await setZoom(2);
    await page.waitForFunction(
      (width) => Math.abs(window.innerWidth * 2 - width) <= 2,
      before.innerWidth,
    );
    const zoomed = await metrics();
    assert.equal(zoomed.outerWidth, before.outerWidth, 'Browser window must remain unchanged');
    assert.equal(
      zoomed.fontSize,
      before.fontSize,
      'Do not substitute CSS text resizing for browser zoom',
    );
    assert.equal(zoomed.devicePixelRatio, before.devicePixelRatio * 2);
    assert.equal(zoomed.visualScale, before.visualScale, 'Do not substitute pinch zoom');

    if (route === '/') {
      await page.getByRole('button', { name: 'Mở bản đồ', exact: true }).scrollIntoViewIfNeeded();
      await page.getByRole('button', { name: 'Mở bản đồ', exact: true }).click();
      await page.locator('.leaflet-container').waitFor();
    }
    for (const summary of await page.locator('details > summary').all()) {
      if (!(await summary.evaluate((element) => element.parentElement.open))) await summary.click();
    }
    if (route === '/') {
      await page.locator('.gift-demo').scrollIntoViewIfNeeded();
      await page.getByRole('button', { name: 'Xem gợi ý hoa', exact: true }).click();
      await page.locator('.gift-results li').first().waitFor();
      await page.locator('#dang-ky').scrollIntoViewIfNeeded();
      await page.getByRole('button', { name: 'Đăng ký tư vấn', exact: true }).click();
      await page.locator('#shop-error').waitFor();
      assert.equal(
        await page.locator('#shop-name').evaluate((element) => element === document.activeElement),
        true,
      );
    }
    const expanded = await metrics();
    assert(expanded.scrollWidth <= expanded.innerWidth, `Horizontal overflow at 200% on ${route}`);
    const clipped = await page
      .locator('h1,h2,h3,p,label,input,select,button,summary')
      .evaluateAll((elements) =>
        elements
          .filter(
            (element) =>
              element.getClientRects().length && !element.closest('.honeypot,.leaflet-container'),
          )
          .filter((element) => {
            const rect = element.getBoundingClientRect();
            return (
              rect.left < -1 ||
              rect.right > window.innerWidth + 1 ||
              element.scrollWidth > element.clientWidth + 1
            );
          })
          .map((element) => ({ tag: element.tagName, text: element.textContent?.slice(0, 100) })),
      );
    assert.deepEqual(clipped, [], `Clipped content at 200% on ${route}`);
    // Capture the physical browser viewport: Playwright full-page clips use CSS pixels at native zoom.
    for (const [position, selector] of [
      ['top', '.site-header'],
      ['content', route === '/' ? '#dang-ky' : '.privacy-content'],
    ]) {
      await page.locator(selector).scrollIntoViewIfNeeded();
      const screenshot = await protocol.send('Page.captureScreenshot', {
        format: 'png',
        captureBeyondViewport: false,
      });
      const bytes = Buffer.from(screenshot.data, 'base64');
      assert(
        bytes.readUInt32BE(16) >= before.innerWidth,
        'Screenshot must include the physical viewport',
      );
      await writeFile(`.impeccable/review/browser-zoom-200-${name}-${position}.png`, bytes);
    }
    report.pages.push({ route, htmlHash, before, zoomed, expanded, clipped });
    await setZoom(1);
  }
  await writeFile('artifacts/browser-zoom.json', JSON.stringify(report, null, 2));
} finally {
  await context?.close();
  // Only remove the fresh disposable profile and extension created by this run.
  await rm(temporary, { recursive: true, force: true });
}

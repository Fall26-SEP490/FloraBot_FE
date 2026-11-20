import { expect, test } from '@playwright/test';
import { setupSellerUsability, shopId } from '../fixtures/seller-usability';

const header = 'invoice_id,product_id,product_name,paid_date,quantity,season,holiday';
const csv = `${header}\r\no1,p1,"Bó hoa hồng ""Đỏ"", Size 50",2026-11-19,2,AUTUMN,TEACHERS_DAY\r\no2,p2,"'=SUM(1,2)",2026-11-19,1,AUTUMN,TEACHERS_DAY\r\n`;

for (const options of [
  { bom: false, refresh: false },
  { bom: true, refresh: false },
  { bom: false, refresh: true },
]) {
  test(`Excel CSV preserves delimiters, UTF-8 and values ${JSON.stringify(options)}`, async ({
    page,
  }) => {
    await setupSellerUsability(page);
    let reads = 0;
    let requested: URL | undefined;
    await page.route('**/api/auth/refresh', (route) => route.fulfill({ json: {} }));
    await page.route(`**/api/sellers/${shopId}/ai/sales.csv?*`, (route) => {
      requested = new URL(route.request().url());
      if (options.refresh && reads++ === 0) return route.fulfill({ status: 401, json: {} });
      return route.fulfill({
        contentType: 'text/csv; charset=utf-8',
        body: (options.bom ? '\uFEFF' : '') + csv,
      });
    });
    await page.goto('/seller/seasonal');
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Tải Excel', exact: true }).click();
    const download = await pending;
    expect(await download.failure()).toBeNull();
    expect(download.suggestedFilename()).toMatch(
      /^doanh-so-\d{4}-\d{2}-\d{2}-\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
    const stream = await download.createReadStream();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    const bytes = Buffer.concat(chunks);
    expect(bytes.subarray(0, 2).toString()).toBe('PK');
    const xml = bytes.toString('utf8');
    expect(xml).toContain('Bó hoa hồng &quot;Đỏ&quot;, Size 50');
    expect(xml).toContain('<c r="E2"><v>2</v></c>');
    expect(xml).toContain("'=SUM(1,2)");
    expect(xml).not.toContain('<f>');
    await download.saveAs(test.info().outputPath('export.xlsx'));
    expect(requested?.searchParams.get('from')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(requested?.searchParams.get('to')).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
}

for (const invalidBody of [false, true]) {
  test(`Failed export shows an error without downloading a broken file (${invalidBody})`, async ({
    page,
  }) => {
    await setupSellerUsability(page);
    await page.route(`**/api/sellers/${shopId}/ai/sales.csv?*`, (route) =>
      route.fulfill(
        invalidBody
          ? { contentType: 'text/html', body: '<html>Unavailable</html>' }
          : { status: 503, json: { detail: 'Chưa xuất được dữ liệu. Vui lòng thử lại.' } },
      ),
    );
    let downloads = 0;
    page.on('download', () => downloads++);
    await page.goto('/seller/seasonal');
    await page.getByRole('button', { name: 'Tải Excel', exact: true }).click();
    await expect(page.locator('.seller-seasonal').getByRole('alert')).toContainText(
      invalidBody ? 'Dữ liệu xuất chưa đúng định dạng CSV' : 'Chưa xuất được dữ liệu',
    );
    await expect(page.getByRole('button', { name: 'Tải Excel', exact: true })).toBeEnabled();
    expect(downloads).toBe(0);
  });
}

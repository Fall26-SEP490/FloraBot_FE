import { test, expect } from '@playwright/test';

test('fault evidence uploads on selection, retries explicitly, and uses the replacement photo', async ({
  page,
}) => {
  test.setTimeout(90_000);
  let uploads = 0;
  let slotStatus = 'RENTED_EMPTY';
  const reports: Record<string, unknown>[] = [];
  const kiosk = '10000000-0000-0000-0000-000000000001';
  const slot = '20000000-0000-0000-0000-000000000001';
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me')
      return route.fulfill({
        json: {
          id: 'fault-user',
          name: 'Shop',
          role: 'SELLER',
          sellerId: 'fault-shop',
          sellerStatus: 'ACTIVE',
        },
      });
    if (path === '/api/sellers/fault-shop/kiosks')
      return route.fulfill({ json: [{ id: kiosk, name: 'Kiosk', code: 'K01', status: 'ONLINE' }] });
    if (path === `/api/me/kiosks/${kiosk}/slots`)
      return route.fulfill({
        json: [
          {
            id: slot,
            kioskId: kiosk,
            slotCode: 'S01',
            zone: 'WALK_IN',
            status: slotStatus,
            bouquetId: null,
            sensorEnabled: false,
          },
        ],
      });
    if (path.endsWith('/evidence/report_device_fault')) {
      uploads++;
      return route.fulfill(
        uploads === 1
          ? { status: 503, json: { detail: 'Chưa lưu được ảnh thử nghiệm.' } }
          : { json: { reference: `evidence:v1:photo-${uploads}` } },
      );
    }
    if (path === '/api/sellers/fault-shop/flows/report_device_fault') {
      reports.push(route.request().postDataJSON());
      slotStatus = 'FAULT';
      return route.fulfill({ json: { result: 'incident-1' } });
    }
    return route.fulfill({ json: [] });
  });
  await page.goto('/seller/stock');
  await page.getByRole('button', { name: 'Xem chi tiết ô S01', exact: true }).click();
  await page.locator('.stock-slot-support > summary').click();
  await page.getByRole('button', { name: 'Báo sự cố', exact: true }).click();
  await page
    .getByRole('textbox', { name: 'Tình trạng cần kiểm tra' })
    .fill('Cửa ô không đóng đúng sau khi thao tác');
  const review = page.getByRole('button', { name: 'Tiếp tục', exact: true });
  await expect(review).toBeDisabled();
  const file = page.locator('.evidence-upload input[type="file"]');
  const imageBytes = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=',
    'base64',
  );
  await file.setInputFiles({
    name: 'first.png',
    mimeType: 'image/png',
    buffer: imageBytes,
  });
  await expect(page.getByText('Chưa lưu được ảnh thử nghiệm.', { exact: true })).toBeVisible();
  await expect(review).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Tải ảnh minh chứng', exact: true })).toHaveCount(
    0,
  );
  expect(reports).toEqual([]);
  await page.getByRole('button', { name: 'Thử tải lại', exact: true }).click();
  await expect(review).toBeEnabled();
  await file.setInputFiles({
    name: 'f9b34ef7-72ee-4321-8f96-f328a953cd36-IMG_8687-replacement.png',
    mimeType: 'image/png',
    buffer: imageBytes,
  });
  await expect(
    page.getByText('Đã lưu ảnh. Hãy gửi báo cáo trong 30 phút.', { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page
        .getByRole('img', { name: 'Ảnh minh chứng đã chọn', exact: true })
        .evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBe(1);
  const previewSource = await page
    .getByRole('img', { name: 'Ảnh minh chứng đã chọn', exact: true })
    .getAttribute('src');
  await page.getByRole('button', { name: 'Phóng to ảnh minh chứng', exact: true }).click();
  const photoDialog = page.getByRole('dialog', { name: 'Ảnh minh chứng', exact: true });
  await expect(photoDialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(photoDialog).not.toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Nạp hoa vào ô S01', exact: true })).toBeVisible();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    const preview = page.getByRole('button', { name: 'Phóng to ảnh minh chứng', exact: true });
    await expect(preview).toContainText(
      'f9b34ef7-72ee-4321-8f96-f328a953cd36-IMG_8687-replacement.png',
    );
    await expect(page.locator('.evidence-file-control .evidence-file-name')).toHaveCount(0);
    await preview.click();
    const bounds = await photoDialog.boundingBox();
    expect(Math.abs(bounds!.x + bounds!.width / 2 - width / 2)).toBeLessThan(2);
    expect(Math.abs(bounds!.y + bounds!.height / 2 - 960 / 2)).toBeLessThan(2);
    await photoDialog.screenshot({ path: test.info().outputPath(`image-centered-${width}.png`) });
    await photoDialog.getByRole('button', { name: 'Đóng ảnh', exact: true }).click();
  }
  const description = page.getByRole('textbox', { name: 'Tình trạng cần kiểm tra' });
  await description.fill('');
  await review.click();
  const validation = page.getByText('Mô tả sự cố ít nhất 5 ký tự.', { exact: true });
  await expect(validation).toBeVisible();
  expect(await validation.evaluate((el) => getComputedStyle(el).backgroundColor)).toBe(
    'rgba(0, 0, 0, 0)',
  );
  await description.fill('Cửa ô không đóng đúng sau khi thao tác');
  await review.click();
  const modal = page.getByRole('dialog');
  await page.getByRole('button', { name: 'Phóng to ảnh minh chứng', exact: true }).click();
  expect(await photoDialog.getByRole('img').getAttribute('src')).toMatch(/^blob:/);
  expect(previewSource).toMatch(/^blob:/);
  await expect
    .poll(() =>
      photoDialog.getByRole('img').evaluate((el) => (el as HTMLImageElement).naturalWidth),
    )
    .toBe(1);
  await photoDialog.getByRole('button', { name: 'Đóng ảnh', exact: true }).click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 960 });
    await modal.screenshot({ path: test.info().outputPath(`fault-confirm-${width}.png`) });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  }
  expect(reports).toEqual([]);
  await page.getByRole('button', { name: 'Gửi báo cáo', exact: true }).click();
  await expect.poll(() => reports.length).toBe(1);
  expect(uploads).toBe(3);
  expect(reports[0]).toMatchObject({
    p_kiosk: kiosk,
    p_slot: slot,
    p_photo: 'evidence:v1:photo-3',
    p_desc: 'Cửa ô không đóng đúng sau khi thao tác',
  });
  await expect(
    page.getByText('Đã gửi báo cáo', {
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    page.getByText('Ô đang có sự cố hoặc đang khóa. Liên hệ đội ngũ để theo dõi xử lý.', {
      exact: true,
    }),
  ).toHaveCount(0);
  await modal.screenshot({ path: test.info().outputPath('fault-complete.png') });
  await modal.getByRole('button', { name: 'Đóng', exact: true }).click();
  await expect(modal).not.toBeVisible();
  await page.getByRole('button', { name: 'Xem chi tiết ô S01', exact: true }).click();
  await expect(page.locator('.stock-slot-support')).toHaveAttribute('open', '');
  await expect(
    page.getByText('Ô đang có sự cố hoặc đang khóa. Liên hệ đội ngũ để theo dõi xử lý.', {
      exact: true,
    }),
  ).toBeVisible();
});

import { expect, test } from '@playwright/test';
import { setupSellerUsability, sampleRequest, shopId } from '../fixtures/seller-usability';

test.use({ timezoneId: 'America/New_York' });
for (const width of [1440, 390]) {
  test(`seller quote uses inline Vietnamese errors and UTC+7 calendar at ${width}`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(90_000);
    await page.setViewportSize({ width, height: 1000 });
    const model = await setupSellerUsability(page);
    await page.goto('/seller/orders');
    await page.locator(`#preorder-${sampleRequest.id} > summary`).click();
    const drawer = page.getByRole('dialog');
    await drawer.getByRole('button', { name: 'Báo giá hoặc từ chối', exact: true }).click();
    const pickup = drawer.getByRole('combobox', { name: 'Giờ bắt đầu nhận', exact: true });
    await pickup.click();
    const calendar = page.getByRole('dialog', {
      name: 'Giờ bắt đầu nhận (giờ Việt Nam)',
      exact: true,
    });
    await calendar.getByRole('combobox', { name: 'Năm', exact: true }).click();
    await page.getByRole('option', { name: '2026', exact: true }).click();
    await calendar.getByRole('combobox', { name: 'Tháng', exact: true }).click();
    await page.getByRole('option', { name: '11', exact: true }).click();
    await calendar.getByRole('button', { name: '21/11/2026', exact: true }).click();
    await calendar.getByRole('combobox', { name: 'Giờ', exact: true }).click();
    await page.getByRole('option', { name: '23', exact: true }).click();
    await calendar.getByRole('combobox', { name: 'Phút', exact: true }).click();
    await page.getByRole('option', { name: '45', exact: true }).click();
    const bounds = await calendar.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.y).toBeGreaterThanOrEqual(0);
    expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(1000);
    await page.screenshot({ path: testInfo.outputPath(`calendar-${width}.png`) });
    await calendar.getByRole('button', { name: 'Xong', exact: true }).click();
    await expect(pickup).toContainText('21/11/2026 23:45');
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await drawer
      .getByRole('checkbox', { name: 'Tôi đã đối chiếu và xác nhận thông tin trên.', exact: true })
      .check();
    const note = drawer.getByRole('textbox', { name: 'Ghi chú cho khách', exact: true });
    await note.fill('');
    const send = drawer.getByRole('button', { name: 'Gửi báo giá', exact: true });
    await send.click();
    await expect(drawer.locator('.form-field-error')).toContainText(
      'Vui lòng nhập hoặc chọn thông tin này.',
    );
    await expect(note).toHaveAttribute('aria-invalid', 'true');
    expect(model.writes).toEqual([]);
    await note.fill('abc');
    await send.click();
    await expect(drawer.locator('.form-field-error')).toContainText('Nhập ít nhất 5 ký tự.');
    await page.screenshot({ path: testInfo.outputPath(`quote-inline-error-${width}.png`) });
    await note.fill('Bó hoa theo yêu cầu');
    await page.route(`**/api/sellers/${shopId}/preorders/${sampleRequest.id}/quote`, (route) => {
      expect(route.request().postDataJSON().pickupAt).toBe('2026-11-21T16:45:00.000Z');
      return route.fulfill({ json: { result: sampleRequest.id } });
    });
    await send.click();
    await expect(drawer.getByText('Đã gửi báo giá.', { exact: true })).toBeVisible();
  });
}

test('seller shared feedback prevents browser bubbles across dynamically mounted forms', async ({
  page,
}) => {
  await setupSellerUsability(page);
  await page.goto('/seller/products');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await page.evaluate(() => {
    const form = document.createElement('form');
    form.innerHTML =
      '<label>Email<input type="email" required aria-describedby="shared-hint" /></label><small id="shared-hint">Gợi ý</small><label>Lý do<textarea minlength="5" required></textarea></label><button>Kiểm tra</button>';
    form.id = 'shared-validation-check';
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      form.dataset.submitted = 'yes';
    });
    document.querySelector('#main')!.append(form);
  });
  const form = page.locator('#shared-validation-check');
  await form.getByRole('button').click();
  await expect(form.locator('.form-field-error')).toHaveCount(2);
  await form.getByRole('textbox', { name: 'Email', exact: true }).fill('abc');
  await form.getByRole('textbox', { name: 'Lý do', exact: true }).fill('a');
  await form.getByRole('button').click();
  await expect(form).toContainText('Nhập địa chỉ email hợp lệ.');
  await expect(form).toContainText('Nhập ít nhất 5 ký tự.');
  await expect(form).not.toHaveAttribute('data-submitted');
  await form.getByRole('textbox', { name: 'Email', exact: true }).fill('test@example.com');
  await form.getByRole('textbox', { name: 'Lý do', exact: true }).fill('Đủ nội dung');
  await form.getByRole('button').click();
  await expect(form).toHaveAttribute('data-submitted', 'yes');
  await expect(form.getByRole('textbox', { name: 'Email', exact: true })).toHaveAttribute(
    'aria-describedby',
    'shared-hint',
  );
});

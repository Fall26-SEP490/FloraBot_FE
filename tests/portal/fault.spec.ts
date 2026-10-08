import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const sellerId = '20000000-0000-0000-0000-000000000099';
const slot = {
  id: '40000000-0000-0000-0000-000000000099',
  kioskId: '50000000-0000-0000-0000-000000000099',
  slotCode: 'A01',
  status: 'RENTED_EMPTY',
  bouquetId: null,
  kioskCode: 'FPT-01',
  kioskName: 'Đại học FPT',
  kioskAddress: 'Thủ Đức',
  productId: null,
  qrCode: null,
  priceSnapshot: null,
  sellableUntil: null,
};
const photo = 'evidence:v1:test-reference';
async function setup(page: Page) {
  await page.route('**/evidence/report_device_fault', (route) =>
    route.fulfill({ json: { reference: photo } }),
  );
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      json: {
        id: 'user',
        name: 'Shop hoa',
        role: 'SELLER',
        sellerId,
        sellerStatus: 'PAST_DUE',
        packageExpiresAt: '2020-01-01',
      },
    }),
  );
  await page.route('**/wallet', (route) =>
    route.fulfill({
      json: {
        balance: null,
        entries: [],
        bankConfigured: false,
        minimumWithdrawal: 50000,
        withdrawals: [],
        hasMoreEntries: false,
        hasMoreWithdrawals: false,
      },
    }),
  );
  await page.route('**/products', (route) => route.fulfill({ json: [] }));
  await page.route('**/subscriptions', (route) =>
    route.fulfill({ json: { package: null, subscriptions: [] } }),
  );
}
async function open(page: Page) {
  await page.goto('/seller');
  await page.locator('.seller-stock summary').click();
  await page.getByRole('button', { name: 'Báo sự cố ô A01' }).click();
}
async function fill(page: Page) {
  await page.getByLabel('Tình trạng cần kiểm tra').fill('Khóa ô A01 không phản hồi.');
  await page
    .getByLabel('Ảnh minh chứng', { exact: true })
    .setInputFiles({ name: 'evidence.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
  await page.getByRole('button', { name: 'Tải ảnh minh chứng', exact: true }).click();
  await expect(page.getByText(/Đã lưu ảnh evidence.png/)).toBeVisible();
  await page.getByRole('button', { name: 'Kiểm tra báo cáo' }).click();
}
for (const width of [390, 1440]) {
  test(`Fault validation, review, business error and successful report ${width}`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await setup(page);
    let status = 'RENTED_EMPTY';
    let attempts = 0;
    await page.route('**/slots', (route) => route.fulfill({ json: [{ ...slot, status }] }));
    await page.route('**/flows/report_device_fault', (route) => {
      expect(route.request().postDataJSON()).toEqual({
        p_kiosk: slot.kioskId,
        p_slot: slot.id,
        p_desc: 'Khóa ô A01 không phản hồi.',
        p_photo: photo,
      });
      attempts++;
      if (attempts === 1)
        return route.fulfill({
          status: 409,
          json: { detail: 'Cửa đang mở, chờ cảm biến đóng cửa.' },
        });
      status = 'FAULT';
      return route.fulfill({ json: { result: 'fault-id' } });
    });
    await open(page);
    await page.getByRole('button', { name: 'Kiểm tra báo cáo' }).click();
    await expect(page.getByLabel('Tình trạng cần kiểm tra')).toBeFocused();
    await page.getByLabel('Tình trạng cần kiểm tra').fill('Khóa ô A01 không phản hồi.');
    await page.getByRole('button', { name: 'Kiểm tra báo cáo' }).click();
    await expect(page.getByText('Tải ảnh minh chứng trước khi gửi.')).toBeVisible();
    expect(attempts).toBe(0);
    await fill(page);
    await expect(page.getByRole('button', { name: 'Xác nhận báo sự cố' })).toBeFocused();
    await expect(page.getByText(/Báo sự cố có thể dừng bán/)).toBeVisible();
    expect(attempts).toBe(0);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    await page
      .locator('.fault-report')
      .screenshot({ path: `.impeccable/review/portal-fault-${width}.png` });
    await page.getByRole('button', { name: 'Xác nhận báo sự cố' }).click();
    await expect(page.locator('.fault-report').getByRole('alert')).toContainText('Cửa đang mở');
    await expect(page.getByLabel('Tình trạng cần kiểm tra')).toHaveValue(
      'Khóa ô A01 không phản hồi.',
    );
    await page.getByRole('button', { name: 'Kiểm tra báo cáo' }).click();
    await page.getByRole('button', { name: 'Xác nhận báo sự cố' }).click();
    await expect(page.locator('.fault-report').getByRole('status')).toContainText(
      'Đã ghi nhận báo cáo',
    );
    await expect(page.locator('.seller-stock summary')).toContainText('Có sự cố');
    await expect(page.getByRole('button', { name: 'Báo sự cố ô A01' })).toHaveCount(0);
    expect(attempts).toBe(2);
  });
}

test('Unknown outcome survives reload and blocks another report until explicit reconciliation', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/slots', (route) => route.fulfill({ json: [slot] }));
  let attempts = 0;
  await page.route('**/flows/report_device_fault', (route) => {
    attempts++;
    return route.abort();
  });
  await open(page);
  await fill(page);
  await page.getByRole('button', { name: 'Xác nhận báo sự cố' }).click();
  await expect(page.getByText(/Chưa xác nhận được kết quả lần gửi trước/)).toBeVisible();
  await page.reload();
  await page.locator('.seller-stock summary').click();
  await expect(page.getByText(/Chưa xác nhận được kết quả lần gửi trước/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Báo sự cố ô A01' })).toHaveCount(0);
  expect(attempts).toBe(1);
  await page.getByRole('button', { name: 'Đã đối chiếu với đội ngũ' }).click();
  await page.getByRole('button', { name: 'Báo sự cố ô A01' }).click();
  await page.getByLabel('Tình trạng cần kiểm tra').fill('Hủy nội dung thử');
  await page.getByRole('button', { name: 'Hủy báo cáo' }).click();
  await expect(page.getByRole('button', { name: 'Báo sự cố ô A01' })).toBeFocused();
  expect(attempts).toBe(1);
});

test('Private upload failure preserves the report and can be retried before submission', async ({
  page,
}) => {
  await setup(page);
  await page.route('**/slots', (route) => route.fulfill({ json: [slot] }));
  let uploads = 0;
  await page.route('**/evidence/report_device_fault', (route) => {
    uploads++;
    return route.fulfill(
      uploads === 1
        ? { status: 503, json: { detail: 'Kho ảnh chưa sẵn sàng.' } }
        : { json: { reference: photo } },
    );
  });
  await open(page);
  await page.getByLabel('Tình trạng cần kiểm tra').fill('Khóa ô A01 không phản hồi.');
  await page
    .getByLabel('Ảnh minh chứng', { exact: true })
    .setInputFiles({ name: 'evidence.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
  await page.getByRole('button', { name: 'Tải ảnh minh chứng', exact: true }).click();
  await expect(page.getByText('Kho ảnh chưa sẵn sàng.')).toBeVisible();
  await expect(page.getByLabel('Tình trạng cần kiểm tra')).toHaveValue(
    'Khóa ô A01 không phản hồi.',
  );
  await page.getByRole('button', { name: 'Kiểm tra báo cáo' }).click();
  await expect(page.getByText('Tải ảnh minh chứng trước khi gửi.')).toBeVisible();
  await page.getByRole('button', { name: 'Tải ảnh minh chứng', exact: true }).click();
  await expect(page.getByText(/Đã lưu ảnh evidence.png/)).toBeVisible();
  expect(uploads).toBe(2);
});

test('Pending flowers require private evidence and confirmation before return', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 950 });
  await setup(page);
  await page.route('**/slots', (route) =>
    route.fulfill({ json: [{ ...slot, status: 'PENDING_REMOVAL', bouquetId: 'bouquet-id' }] }),
  );
  await page.route('**/evidence/return_to_seller', (route) =>
    route.fulfill({ json: { reference: photo } }),
  );
  let submissions = 0;
  await page.route('**/flows/return_to_seller', (route) => {
    submissions++;
    expect(route.request().postDataJSON()).toEqual({
      p_slot: slot.id,
      p_reason: 'Nhận lại hoa hết hạn',
      p_photo_url: photo,
      p_damaged: false,
    });
    return route.fulfill({ json: { result: null } });
  });
  await page.goto('/seller');
  await page.locator('.seller-stock summary').click();
  await page.getByLabel('Lý do nhận lại hoa').fill('Nhận lại hoa hết hạn');
  await page
    .getByLabel('Ảnh minh chứng', { exact: true })
    .setInputFiles({ name: 'return.png', mimeType: 'image/png', buffer: Buffer.from('fixture') });
  await page.getByRole('button', { name: 'Tải ảnh minh chứng', exact: true }).click();
  await expect(page.getByText(/Đã lưu ảnh return.png/)).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag22aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Kiểm tra thông tin trả hoa' }).click();
  await expect(page.getByRole('button', { name: 'Xác nhận đã nhận lại hoa' })).toBeFocused();
  expect(submissions).toBe(0);
  await page.getByRole('button', { name: 'Xác nhận đã nhận lại hoa' }).click();
  await expect(page.getByText('Đã ghi nhận trả hoa và cập nhật ô tủ.')).toBeVisible();
  expect(submissions).toBe(1);
});

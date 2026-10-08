import { expect, type Locator } from '@playwright/test';

export const evidencePng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jN1sAAAAASUVORK5CYII=',
  'base64',
);

export async function uploadEvidence(scope: Locator) {
  await scope
    .getByLabel('Ảnh minh chứng', { exact: true })
    .setInputFiles({ name: 'evidence.png', mimeType: 'image/png', buffer: evidencePng });
  await scope.getByRole('button', { name: 'Tải ảnh minh chứng', exact: true }).click();
  await expect(
    scope.getByRole('status').filter({ hasText: 'Đã lưu ảnh evidence.png' }),
  ).toBeVisible();
}

import type { Locator, Page } from '@playwright/test';

export async function fillPickup(scope: Page | Locator, localDateTime: string) {
  const [day, time] = localDateTime.split('T');
  await scope.getByLabel('Ngày nhận hoa', { exact: true }).fill(day.split('-').reverse().join('/'));
  await scope.getByLabel('Giờ nhận hoa', { exact: true }).fill(time);
}

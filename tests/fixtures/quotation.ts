import type { Locator, Page } from '@playwright/test';
import { chooseVietnamDate } from './vietnam-date';
import { chooseSelect } from './select';

export async function fillPickup(scope: Page | Locator, localDateTime: string) {
  const [day, time] = localDateTime.split('T');
  await chooseVietnamDate(scope, 'Ngày nhận hoa', day);
  const [hour, minute] = time.split(':');
  await chooseSelect(scope, 'Giờ nhận hoa', `${hour}:${Number(minute) >= 30 ? '30' : '00'}`);
}

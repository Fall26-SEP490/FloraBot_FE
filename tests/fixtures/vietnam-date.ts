import type { Locator, Page } from '@playwright/test';

export async function chooseVietnamDate(
  scope: Page | Locator,
  label: string,
  value: string,
  kind: 'date' | 'time' | 'month' = 'date',
) {
  const page = 'page' in scope ? scope.page() : scope;
  await scope.getByRole('combobox', { name: label, exact: true }).click();
  const calendar = page.locator('[data-vietnam-calendar]');
  if (!value) {
    await calendar.getByRole('button', { name: 'Xóa', exact: true }).click();
    return;
  }
  if (kind === 'time') {
    const [hour, minute] = value.split(':');
    await calendar.getByRole('combobox', { name: 'Giờ', exact: true }).click();
    await page.getByRole('option', { name: hour, exact: true }).click();
    await calendar.getByRole('combobox', { name: 'Phút', exact: true }).click();
    await page.getByRole('option', { name: minute, exact: true }).click();
    await calendar.getByRole('button', { name: 'Xong', exact: true }).click();
    return;
  }
  const [year, month, day] = value.split('-');
  await calendar.getByRole('combobox', { name: 'Năm', exact: true }).click();
  await page.getByRole('option', { name: String(Number(year)), exact: true }).click();
  if (kind === 'month') {
    await calendar.getByRole('button', { name: `Tháng ${Number(month)}`, exact: true }).click();
  } else {
    await calendar.getByRole('combobox', { name: 'Tháng', exact: true }).click();
    await page.getByRole('option', { name: String(Number(month)), exact: true }).click();
    await calendar.getByRole('button', { name: `${day}/${month}/${year}`, exact: true }).click();
  }
}

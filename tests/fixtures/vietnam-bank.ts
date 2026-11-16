import type { Page } from '@playwright/test';

export async function chooseVietnamBank(
  page: Page,
  label: string,
  search: string,
  bankName: string,
) {
  await page.getByLabel(label).fill(search);
  await page
    .getByRole('option')
    .filter({ has: page.getByText(bankName, { exact: true }) })
    .click();
}

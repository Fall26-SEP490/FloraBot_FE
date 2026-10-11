import { expect, type Page } from '@playwright/test';
import { resolve } from 'node:path';

export function getBackendRoot(): string {
  return process.env.FLORABOT_BE_ROOT ? resolve(process.env.FLORABOT_BE_ROOT) : resolve('../BE');
}

export function getKioskRoot(): string {
  return process.env.FLORABOT_KIOS_ROOT
    ? resolve(process.env.FLORABOT_KIOS_ROOT)
    : resolve('../Kios');
}

export function getGatewayUrl(): string {
  const port = process.env.FLORABOT_GATEWAY_PORT || process.env.GATEWAY_PORT || '5084';
  return `http://127.0.0.1:${port}`;
}

export async function loginAdminWithPacing(page: Page, email: string, pass: string): Promise<void> {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(pass);
  const loginResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/auth/admin/login') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const res = await loginResponse;
  if (res.status() === 429) {
    await expect(page.locator('main').getByRole('alert')).toContainText('Bạn thao tác hơi nhanh');
    await page.waitForTimeout(60_000);
    const retryLogin = page.waitForResponse(
      (r) => r.url().endsWith('/api/auth/admin/login') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    expect((await retryLogin).status()).toBe(200);
  } else {
    expect(res.status()).toBe(200);
  }
  await expect(page).toHaveURL(/\/admin$/);
}

export async function loginSellerWithPacing(
  page: Page,
  email: string,
  pass: string,
): Promise<void> {
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(pass);
  const sellerLogin = page.waitForResponse(
    (response) =>
      response.url().endsWith('/api/auth/login') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  const res = await sellerLogin;
  if (res.status() === 429) {
    await expect(page.locator('main').getByRole('alert')).toContainText('Bạn thao tác hơi nhanh');
    await page.waitForTimeout(60_000);
    const retryLogin = page.waitForResponse(
      (r) => r.url().endsWith('/api/auth/login') && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
    expect((await retryLogin).status()).toBe(200);
  } else {
    expect(res.status()).toBe(200);
  }
  await expect(page).toHaveURL(/\/seller$/);
}

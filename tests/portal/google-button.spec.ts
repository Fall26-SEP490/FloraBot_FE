import { expect, test } from '@playwright/test';

for (const route of ['/dang-nhap', '/dang-ky']) {
  test(`Google native button remains visible and forwards credentials on ${route}`, async ({
    page,
  }) => {
    let googleRequest: unknown;
    const session = {
      id: '10000000-0000-0000-0000-000000000009',
      name: 'Google QA',
      role: 'CUSTOMER',
      sellerId: null,
    };
    await page.route('**/api/**', (request) => request.fulfill({ json: {} }));
    await page.route('**/api/auth/me', (request) => request.fulfill({ status: 401, json: {} }));
    await page.route('**/api/auth/config', (request) =>
      request.fulfill({
        json: {
          googleEnabled: true,
          googleClientId: 'test-client.apps.googleusercontent.com',
          registrationEmailEnabled: true,
        },
      }),
    );
    await page.route('https://accounts.google.com/gsi/client', (request) =>
      request.fulfill({
        contentType: 'application/javascript',
        body: `(() => {
        let settings;
        window.google = { accounts: { id: {
          initialize(value) { settings = value; },
          renderButton(container) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = 'Google QA sign in';
            button.onclick = () => settings.callback({ credential: 'test-only-google-credential' });
            container.appendChild(button);
          }
        } } };
      })();`,
      }),
    );
    await page.route('**/api/auth/google', async (request) => {
      googleRequest = request.request().postDataJSON();
      await request.fulfill({ json: session });
    });
    await page.goto(route);
    const container = page.getByTestId('google-button-container');
    await expect(container).toBeVisible();
    await expect(container).toHaveCSS('opacity', '1');
    await expect(container).toHaveCSS('position', 'static');
    await expect(container.locator('button')).toHaveCSS('transform', 'none');
    await container.getByRole('button', { name: 'Google QA sign in' }).click();
    await expect.poll(() => googleRequest).toEqual({ idToken: 'test-only-google-credential' });
    await expect(page).toHaveURL(/\/tai-khoan/);
  });
}

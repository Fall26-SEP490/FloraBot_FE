import { type Page } from '@playwright/test';

// Provider UI and callbacks are simulated. Payment state is always served by the API fixture.
export async function mockPayos(page: Page) {
  await page.route('https://cdn.payos.vn/payos-checkout/v1/stable/payos-initialize.js', (route) =>
    route.fulfill({
      contentType: 'text/javascript',
      body: `
      window.PayOSCheckout = { usePayOS(config) {
        window.payosTestConfig = config;
        return {
          open() {
            const iframe = document.createElement('iframe');
            iframe.src = config.CHECKOUT_URL.replace('/web/', '/embedded/');
            document.getElementById(config.ELEMENT_ID).appendChild(iframe);
          },
          exit() { document.getElementById(config.ELEMENT_ID)?.querySelector('iframe')?.remove(); }
        };
      }};
    `,
    }),
  );
  await page.route('https://pay.payos.vn/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<html lang="vi"><meta charset="utf-8"><title>PayOS thử nghiệm</title><body><h1>QR thanh toán thử nghiệm</h1></body></html>',
    }),
  );
}

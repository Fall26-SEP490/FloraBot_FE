import type { Page } from '@playwright/test';
import fixture from '../fixtures/landing-api-data.json';
export { fixture };
export async function mockLandingClientData(page: Page) {
  await page.route('**/api/kiosk-packages', (route) => route.fulfill({ json: fixture.packages }));
  await page.route('**/api/shop/catalog?**', (route) => {
    const pageNumber = Number(new URL(route.request().url()).searchParams.get('page') || '1');
    return route.fulfill({
      json: {
        items: pageNumber === 1 ? fixture.catalog.slice(0, 3) : fixture.catalog.slice(3),
        page: pageNumber,
        hasMore: pageNumber === 1,
      },
    });
  });
}

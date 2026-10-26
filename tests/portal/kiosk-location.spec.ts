import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const sellerId = '20000000-0000-0000-0000-000000000001';

const sampleSellerKiosks = [
  {
    id: 'kiosk-01',
    code: 'KS-01',
    name: 'Kiosk Landmark 81',
    address: '720A Äiá»‡n BiÃªn Phá»§, P. 22, BÃ¬nh Tháº¡nh, TP.HCM',
    region: 'TP. Há»“ ChÃ­ Minh',
    status: 'ONLINE',
    latitude: 10.795,
    longitude: 106.7218,
    locationComplete: true,
    canEditLocation: true,
  },
  {
    id: 'kiosk-02',
    code: 'KS-02',
    name: 'Kiosk FPT University',
    address: null,
    region: 'TP. Thá»§ Äá»©c',
    status: 'ONLINE',
    latitude: null,
    longitude: null,
    locationComplete: false,
    canEditLocation: true,
  },
  {
    id: 'kiosk-03',
    code: 'KS-03',
    name: 'Kiosk Shared Central',
    address: '123 LÃª Lá»£i, Quáº­n 1, TP.HCM',
    region: 'TP. Há»“ ChÃ­ Minh',
    status: 'MAINTENANCE',
    latitude: 10.7769,
    longitude: 106.7009,
    locationComplete: true,
    canEditLocation: false, // shared legacy / not wholly assigned
  },
];

// Deployed public contract: GET /api/kiosks returns an array and accepts no parameters.
const sampleCustomerLocations = [
  {
    id: 'kiosk-01',
    code: 'KS-01',
    name: 'Kiosk Landmark 81',
    address: '720A Äiá»‡n BiÃªn Phá»§, P. 22, BÃ¬nh Tháº¡nh, TP.HCM',
    region: 'TP. Há»“ ChÃ­ Minh',
    status: 'ONLINE',
    latitude: 10.795,
    longitude: 106.7218,
    locationComplete: true,
  },
  {
    id: 'kiosk-02',
    code: 'KS-02',
    name: 'Kiosk Maintenance Hub',
    address: '456 Hai Ba Trung, District 3',
    region: 'TP. Há»“ ChÃ­ Minh',
    status: 'MAINTENANCE',
    latitude: 10.788,
    longitude: 106.692,
    locationComplete: true,
  },
  {
    id: 'kiosk-03',
    code: 'KS-03',
    name: 'Kiosk Shared Central',
    address: '123 LÃª Lá»£i, Quáº­n 1, TP.HCM',
    region: 'TP. Há»“ ChÃ­ Minh',
    status: 'OFFLINE',
    latitude: 10.7769,
    longitude: 106.7009,
    locationComplete: true,
  },
  {
    id: 'kiosk-04',
    code: 'KS-XSS',
    name: 'Safe XSS Test <script>window.__xss_fired=true</script>',
    address: '999 XSS Ave <img src="x" onerror="window.__xss_fired=true">',
    region: 'TP. Há»“ ChÃ­ Minh',
    status: 'ONLINE',
    latitude: 10.78,
    longitude: 106.7,
    locationComplete: true,
  },
];

test.beforeEach(async ({ page }) => {
  // Mock tiles so tests are fast and reliable offline
  await page.route('https://tile.openstreetmap.org/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'image/png',
      body: (
        globalThis as unknown as { Buffer: { from: (s: string, enc: string) => unknown } }
      ).Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  );

  // Common workspace mocks
  await page.route('**/api/**/wallet', (route) =>
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
  await page.route('**/api/**/slots', (route) => route.fulfill({ json: [] }));
  await page.route('**/api/**/products', (route) => route.fulfill({ json: [] }));
});

test.describe('Seller Kiosks Management (/seller/kiosks)', () => {
  test('SELLER can access /seller/kiosks, see required banner, and view kiosks', async ({
    page,
  }) => {
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: {
          id: 'user-seller',
          name: 'Chá»§ shop Hoa TÆ°Æ¡i',
          role: 'SELLER',
          sellerId,
          sellerStatus: 'ACTIVE',
        },
      }),
    );

    await page.route(`**/api/sellers/${sellerId}/kiosks`, (route) =>
      route.fulfill({ json: sampleSellerKiosks }),
    );

    await page.goto('/seller/kiosks');

    // Page heading in workspace
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Vá»‹ trÃ­ kiosk');

    // Missing-location required-action banner
    const banner = page.locator('.kiosk-required-banner');
    await expect(banner).toBeVisible();
    await expect(banner).toContainText('YÃªu cáº§u cáº­p nháº­t vá»‹ trÃ­ kiosk');
    await expect(banner).toContainText('1'); // 1 kiosk incomplete

    // Check kiosk cards rendered
    await expect(page.getByRole('heading', { name: 'Kiosk Landmark 81' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Kiosk FPT University' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Kiosk Shared Central' })).toBeVisible();

    // Check MAINTENANCE status is labeled 'Báº£o trÃ¬', NOT 'Hoáº¡t Ä‘á»™ng'
    const maintenanceCard = page.locator('.kiosk-card').filter({ hasText: 'Kiosk Shared Central' });
    await expect(maintenanceCard.locator('.kiosk-status-badge')).toHaveText('Báº£o trÃ¬');

    // Shared / uneditable kiosk has notice and disabled inputs
    await expect(maintenanceCard.locator('.kiosk-permission-notice')).toContainText(
      'Tá»§ kiosk nÃ y dÃ¹ng chung hoáº·c chÆ°a Ä‘Æ°á»£c gÃ¡n toÃ n quyá»n cho shop',
    );
    await expect(maintenanceCard.locator('input[name="address"]')).toBeDisabled();
    await expect(maintenanceCard.locator('input[name="latitude"]')).toBeDisabled();
    await expect(maintenanceCard.locator('input[name="longitude"]')).toBeDisabled();
  });

  test('SELLER_STAFF is restricted from writing/updating kiosk locations', async ({ page }) => {
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: {
          id: 'user-staff',
          name: 'NhÃ¢n viÃªn giao nháº­n',
          role: 'SELLER_STAFF',
          sellerId,
          sellerStatus: 'ACTIVE',
        },
      }),
    );

    await page.goto('/seller/kiosks');

    // Role guard in Workspace redirects non-SELLER to their assigned workspace (/staff)
    await expect(page).toHaveURL('/staff');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'ChÃ o NhÃ¢n viÃªn giao nháº­n',
    );
    // Staff navigation does not expose /seller/kiosks
    await expect(page.getByRole('link', { name: 'Vá»‹ trÃ­ kiosk' })).toBeHidden();
  });

  test('Validates inputs, differentiates 0 from blank, and handles out-of-range coords', async ({
    page,
  }) => {
    let savedPayload: unknown = null;
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: {
          id: 'user-seller',
          name: 'Chá»§ shop',
          role: 'SELLER',
          sellerId,
          sellerStatus: 'ACTIVE',
        },
      }),
    );

    await page.route(
      `**/api/sellers/${sellerId}/kiosks`,
      (route) => route.fulfill({ json: [sampleSellerKiosks[1]] }), // incomplete kiosk
    );

    await page.route(`**/api/sellers/${sellerId}/kiosks/kiosk-02/location`, (route) => {
      savedPayload = route.request().postDataJSON();
      return route.fulfill({
        json: {
          ...sampleSellerKiosks[1],
          latitude: 0,
          longitude: 0,
          locationComplete: true,
        },
      });
    });

    await page.goto('/seller/kiosks');

    const card = page.locator('.kiosk-card').filter({ hasText: 'Kiosk FPT University' });
    const addressInput = card.locator('input[name="address"]');
    const latInput = card.locator('input[name="latitude"]');
    const lonInput = card.locator('input[name="longitude"]');
    const submitBtn = card.locator('button[type="submit"]');

    // 1. Submit with empty address
    await submitBtn.click();
    await expect(card.locator('.kiosk-feedback-error')).toContainText(
      'Vui lÃ²ng nháº­p Ä‘á»‹a chá»‰ cá»¥ thá»ƒ cá»§a kiosk.',
    );

    // 2. Fill address but leave coordinates blank (must NOT coerce blank to 0)
    await addressInput.fill('Khu CÃ´ng Nghá»‡ Cao, TP. Thá»§ Äá»©c');
    await latInput.fill('');
    await lonInput.fill('');
    await submitBtn.click();
    await expect(card.locator('.kiosk-feedback-error')).toContainText(
      'Cáº£ vÄ© Ä‘á»™ vÃ  kinh Ä‘á»™ Ä‘á»u pháº£i Ä‘Æ°á»£c cung cáº¥p cÃ¹ng nhau.',
    );

    // 3. Invalid latitude bounds (>90)
    await latInput.fill('95.5');
    await lonInput.fill('106.8098');
    await submitBtn.click();
    await expect(card.locator('.kiosk-feedback-error')).toContainText(
      'VÄ© Ä‘á»™ pháº£i lÃ  sá»‘ há»£p lá»‡ trong khoáº£ng tá»« -90 Ä‘áº¿n 90.',
    );

    // 4. Invalid longitude bounds (>180)
    await latInput.fill('10.8414');
    await lonInput.fill('190.5');
    await submitBtn.click();
    await expect(card.locator('.kiosk-feedback-error')).toContainText(
      'Kinh Ä‘á»™ pháº£i lÃ  sá»‘ há»£p lá»‡ trong khoáº£ng tá»« -180 Ä‘áº¿n 180.',
    );

    // 5. Valid coordinate 0 (equator/prime meridian) MUST be accepted as numeric 0, not rejected
    await latInput.fill('0');
    await lonInput.fill('0');
    await submitBtn.click();
    await expect(card.locator('.kiosk-feedback-success')).toContainText('thÃ nh cÃ´ng');
    expect(savedPayload).toEqual({
      address: 'Khu CÃ´ng Nghá»‡ Cao, TP. Thá»§ Äá»©c',
      latitude: 0,
      longitude: 0,
    });
  });

  test('Successfully updates location via PUT and shows preview link without API key', async ({
    page,
  }) => {
    let putPayload: unknown = null;

    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: {
          id: 'user-seller',
          name: 'Chá»§ shop',
          role: 'SELLER',
          sellerId,
          sellerStatus: 'ACTIVE',
        },
      }),
    );

    await page.route(`**/api/sellers/${sellerId}/kiosks`, (route) =>
      route.fulfill({ json: [sampleSellerKiosks[1]] }),
    );

    await page.route(`**/api/sellers/${sellerId}/kiosks/kiosk-02/location`, (route) => {
      putPayload = route.request().postDataJSON();
      return route.fulfill({
        json: {
          ...sampleSellerKiosks[1],
          address: 'Khu CÃ´ng Nghá»‡ Cao, TP. Thá»§ Äá»©c',
          latitude: 10.8414,
          longitude: 106.8098,
          locationComplete: true,
        },
      });
    });

    await page.goto('/seller/kiosks');

    const card = page.locator('.kiosk-card').filter({ hasText: 'Kiosk FPT University' });
    await card.locator('input[name="address"]').fill('Khu CÃ´ng Nghá»‡ Cao, TP. Thá»§ Äá»©c');
    await card.locator('input[name="latitude"]').fill('10.8414');
    await card.locator('input[name="longitude"]').fill('106.8098');

    // Google Maps preview link check: no key, destination coords only, target="_blank", rel="noopener noreferrer"
    const previewLink = card.locator('.kiosk-external-link');
    await expect(previewLink).toBeVisible();
    const href = await previewLink.getAttribute('href');
    expect(href).toContain('google.com/maps/search/?api=1&query=10.8414%2C106.8098');
    expect(href).not.toContain('key=');
    await expect(previewLink).toHaveAttribute('target', '_blank');
    await expect(previewLink).toHaveAttribute('rel', 'noopener noreferrer');

    // Submit
    await card.locator('button[type="submit"]').click();

    await expect(card.locator('.kiosk-feedback-success')).toContainText(
      'ÄÃ£ lÆ°u vá»‹ trÃ­ cho kiosk Kiosk FPT University thÃ nh cÃ´ng.',
    );

    expect(putPayload).toEqual({
      address: 'Khu CÃ´ng Nghá»‡ Cao, TP. Thá»§ Äá»©c',
      latitude: 10.8414,
      longitude: 106.8098,
    });
  });

  test('Handles empty and error states in Seller Kiosks', async ({ page }) => {
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: {
          id: 'user-seller',
          name: 'Chá»§ shop',
          role: 'SELLER',
          sellerId,
          sellerStatus: 'ACTIVE',
        },
      }),
    );

    // Empty list
    await page.route(`**/api/sellers/${sellerId}/kiosks`, (route) => route.fulfill({ json: [] }));

    await page.goto('/seller/kiosks');
    await expect(page.locator('.kiosk-empty-state')).toContainText(
      'ChÆ°a cÃ³ kiosk nÃ o Ä‘Æ°á»£c phÃ¢n bá»•',
    );

    // Error state with retry
    await page.route(`**/api/sellers/${sellerId}/kiosks`, (route) =>
      route.fulfill({ status: 500, json: { message: 'MÃ¡y chá»§ gáº·p lá»—i' } }),
    );

    await page.locator('.kiosk-reload-btn').click();
    await expect(page.locator('.kiosk-error-state')).toContainText('MÃ¡y chá»§ gáº·p lá»—i');
  });

  test('Kiosk picker map sets strict-origin-when-cross-origin referrerPolicy on tile images', async ({
    page,
  }) => {
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: {
          id: 'user-seller',
          name: 'Chá»§ shop',
          role: 'SELLER',
          sellerId,
          sellerStatus: 'ACTIVE',
        },
      }),
    );

    await page.route(`**/api/sellers/${sellerId}/kiosks`, (route) =>
      route.fulfill({ json: sampleSellerKiosks }),
    );

    await page.goto('/seller/kiosks');

    // Meaningful assertion that map tile images enforce strict-origin-when-cross-origin referrerPolicy
    const tile = page.locator('.kiosk-picker-map img.leaflet-tile').first();
    await expect(tile).toBeVisible();
    await expect(tile).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
  });

  test('Kiosk picker map shows fallback warning on tileerror and protects manual inputs', async ({
    page,
  }) => {
    // Simulate OSM 403 / tile loading error
    await page.route('https://tile.openstreetmap.org/**', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'text/plain',
        body: '403 Forbidden: OSM policy',
      }),
    );

    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: {
          id: 'user-seller',
          name: 'Chá»§ shop',
          role: 'SELLER',
          sellerId,
          sellerStatus: 'ACTIVE',
        },
      }),
    );

    await page.route(`**/api/sellers/${sellerId}/kiosks`, (route) =>
      route.fulfill({ json: sampleSellerKiosks }),
    );

    await page.goto('/seller/kiosks');

    const card = page.locator('.kiosk-card').filter({ hasText: 'Kiosk Landmark 81' });
    const tileWarning = card.locator('.kiosk-map-tile-warning');
    await expect(tileWarning).toBeVisible();
    await expect(tileWarning).toContainText(
      'Báº£n Ä‘á»“ chÆ°a táº£i Ä‘Æ°á»£c Ä‘áº§y Ä‘á»§ Ã´ hÃ¬nh áº£nh. Báº¡n váº«n cÃ³ thá»ƒ nháº­p Ä‘á»‹a chá»‰ vÃ  tá»a Ä‘á»™ báº±ng tay.',
    );

    // Manual fallback remains interactive even when tiles fail
    await expect(card.locator('input[name="address"]')).toBeEnabled();
    await expect(card.locator('input[name="latitude"]')).toBeEnabled();
    await expect(card.locator('input[name="longitude"]')).toBeEnabled();
    await expect(card.locator('button[type="submit"]')).toBeEnabled();
  });
});

test.describe('Public Customer Kiosk Locator (/tim-kiosk)', () => {
  test('Customer page displays array response, handles status labels (MAINTENANCE=Báº£o trÃ¬) and XSS prevention', async ({
    page,
  }) => {
    let callCount = 0;
    await page.route('**/api/kiosks', (route) => {
      callCount++;
      if (callCount === 1) {
        return route.fulfill({ status: 500, json: { message: 'Lá»—i táº£i danh sÃ¡ch' } });
      }
      // Return ARRAY per backend contract
      return route.fulfill({ json: sampleCustomerLocations });
    });

    await page.goto('/tim-kiosk');

    // Heading
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'TÃ¬m kiosk nháº­n hoa FloraBot',
    );

    // 1. Error state first
    await expect(page.locator('.customer-error-state')).toContainText('Lá»—i táº£i danh sÃ¡ch');

    // Click retry
    await page.locator('.customer-error-state button').click();

    // 2. Success state with array items
    await expect(page.getByRole('heading', { name: 'Kiosk Landmark 81' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Kiosk Shared Central' })).toBeVisible();

    // Status verification:
    // ONLINE = Äang hoáº¡t Ä‘á»™ng
    await expect(
      page.locator('.customer-kiosk-item').filter({ hasText: 'Kiosk Landmark 81' }),
    ).toContainText('Äang hoáº¡t Ä‘á»™ng');

    // MAINTENANCE = Báº£o trÃ¬ (NOT Hoáº¡t Ä‘á»™ng)
    const maintItem = page
      .locator('.customer-kiosk-item')
      .filter({ hasText: 'Kiosk Maintenance Hub' });
    await expect(maintItem.locator('.customer-status-badge')).toHaveText('Báº£o trÃ¬');
    await expect(maintItem.locator('.customer-maintenance-notice')).toContainText(
      'Kiosk Ä‘ang trong quÃ¡ trÃ¬nh báº£o trÃ¬ ká»¹ thuáº­t',
    );

    // OFFLINE = Ngoáº¡i tuyáº¿n
    const offlineItem = page
      .locator('.customer-kiosk-item')
      .filter({ hasText: 'Kiosk Shared Central' });
    await expect(offlineItem.locator('.customer-status-badge')).toHaveText('Ngoáº¡i tuyáº¿n');

    // Directions anchor has google.com/maps/dir with api=1 destination coords only, noopener
    const dirLink = page
      .locator('.customer-kiosk-item')
      .filter({ hasText: 'Kiosk Landmark 81' })
      .locator('.customer-btn-directions');
    const href = await dirLink.getAttribute('href');
    expect(href).toContain('https://www.google.com/maps/dir/?api=1&destination=');
    expect(href).not.toContain('key=');
    await expect(dirLink).toHaveAttribute('target', '_blank');
    await expect(dirLink).toHaveAttribute('rel', 'noopener noreferrer');

    // Link to flower shop without claiming unsupported filters
    const shopLink = page
      .locator('.customer-kiosk-item')
      .filter({ hasText: 'Kiosk Landmark 81' })
      .locator('.customer-btn-shop');
    await expect(shopLink).toHaveAttribute('href', '/dat-hoa');

    // 3. Stored XSS Prevention Regression Check:
    // The XSS kiosk address or name must not execute scripts
    const xssFired = await page.evaluate(
      () => (window as unknown as { __xss_fired?: boolean }).__xss_fired,
    );
    expect(xssFired).toBeUndefined();

    // Click "Xem trÃªn báº£n Ä‘á»“" to trigger map popup creation
    const xssItem = page.locator('.customer-kiosk-item').filter({ hasText: 'Safe XSS Test' });
    const mapMarkers = page.locator(
      '.customer-kiosk-map .maplibregl-marker, .customer-kiosk-map .leaflet-interactive',
    );
    await expect(mapMarkers).toHaveCount(sampleCustomerLocations.length);
    await xssItem.locator('.customer-btn-focus').click();
    const popupContent = page.locator('.maplibregl-popup-content, .leaflet-popup-content');
    await expect(popupContent).toContainText('999 XSS Ave <img');
    await expect(popupContent.locator('img, script')).toHaveCount(0);

    // Confirm script still hasn't fired in the Leaflet DOM popup
    const xssFiredAfterPopup = await page.evaluate(
      () => (window as unknown as { __xss_fired?: boolean }).__xss_fired,
    );
    expect(xssFiredAfterPopup).toBeUndefined();
  });

  test('Unified search filters kiosk list client-side and supports clearing query', async ({
    page,
  }) => {
    await page.route('**/api/kiosks', (route) => route.fulfill({ json: sampleCustomerLocations }));

    await page.goto('/tim-kiosk');

    const searchInput = page.locator('.customer-quick-search-input');
    await expect(searchInput).toBeVisible();

    // Filter by keyword "Landmark"
    await searchInput.fill('Landmark');
    await expect(page.locator('.customer-kiosk-item')).toHaveCount(1);
    await expect(page.getByRole('heading', { name: 'Kiosk Landmark 81' })).toBeVisible();

    // Clear search using clear button
    await page.locator('.customer-search-clear-btn').click();
    await expect(searchInput).toHaveValue('');
    await expect(page.locator('.customer-kiosk-item')).toHaveCount(sampleCustomerLocations.length);

    // Search for non-existent keyword -> shows empty state inside unified card
    await searchInput.fill('DiaDiemKhongTonTai123');
    await expect(page.locator('.customer-empty-state')).toContainText(
      'KhÃ´ng cÃ³ kiosk phÃ¹ há»£p',
    );

    // Click "XÃ³a bá»™ lá»c tÃ¬m kiáº¿m"
    await page.locator('.customer-empty-state button').click();
    await expect(page.locator('.customer-kiosk-item')).toHaveCount(sampleCustomerLocations.length);
  });

  test('Geolocation button displays the browser position without changing the public kiosk request', async ({
    page,
    context,
  }) => {
    let requestCount = 0;
    await page.route('**/api/kiosks', (route) => {
      requestCount++;
      return route.fulfill({ json: sampleCustomerLocations });
    });

    await page.goto('/tim-kiosk');

    await expect.poll(() => requestCount).toBe(1);

    // Grant geolocation and click locate button
    await context.grantPermissions(['geolocation']);
    await context.setGeolocation({ latitude: 10.78, longitude: 106.7 });
    await page.locator('.customer-btn-geolocate').click();

    const activeLocation = page.locator('.customer-geo-active-bar');
    await expect(activeLocation).toContainText('10.780');
    await expect.poll(() => requestCount).toBe(1);

    // Clear origin
    await page.locator('.customer-btn-clear').click();
    await expect(activeLocation).toBeHidden();
  });

  test('Geolocation denied handles gracefully without requesting on mount', async ({
    page,
    context,
  }) => {
    await context.clearPermissions();

    await page.route('**/api/kiosks', (route) => route.fulfill({ json: sampleCustomerLocations }));

    await page.goto('/tim-kiosk');

    // On mount, no message shown
    await expect(page.locator('.customer-geo-notice')).toBeHidden();

    // Click locate icon
    await page.locator('.customer-btn-geolocate').click();

    // Denial message is shown gracefully
    await expect(page.locator('.customer-geo-message')).toContainText(
      'Quyá»n truy cáº­p vá»‹ trÃ­ Ä‘Ã£ bá»‹ tá»« chá»‘i',
    );
  });

  test('Unified card displays region filter pills when regions are present', async ({ page }) => {
    await page.route('**/api/kiosks', (route) => route.fulfill({ json: sampleCustomerLocations }));

    await page.goto('/tim-kiosk');

    // Open filter drawer if not open
    const filterToggle = page.locator('.customer-filter-toggle-btn');
    if (await filterToggle.isVisible()) {
      const areasWrap = page.locator('.customer-quick-areas');
      if (!(await areasWrap.isVisible())) {
        await filterToggle.click();
      }
    }

    const areasWrap = page.locator('.customer-quick-areas');
    await expect(areasWrap).toBeVisible();
    await expect(areasWrap.locator('.customer-area-pill')).toContainText([
      'Táº¥t cáº£',
      'TP. Há»“ ChÃ­ Minh',
    ]);
  });

  test('Responsive design and accessibility at mobile (390px) and tablet (1024px)', async ({
    page,
  }) => {
    await page.route('**/api/kiosks', (route) => route.fulfill({ json: sampleCustomerLocations }));

    for (const width of [390, 1024]) {
      await page.setViewportSize({ width, height: 844 });
      await page.goto('/tim-kiosk');

      // Check no horizontal overflow
      await expect(page.locator('body')).toHaveJSProperty('scrollWidth', width);

      // Verify touch targets are at least 44px
      if (width === 390) {
        await page.locator('.customer-tab-btn').filter({ hasText: 'Báº£n Ä‘á»“' }).click();
      }
      const geolocateBtn = page.locator('.customer-btn-geolocate');
      const geoBox = await geolocateBtn.boundingBox();
      expect(geoBox).not.toBeNull();
      expect(geoBox!.height).toBeGreaterThanOrEqual(44);

      if (width === 390) {
        await page.locator('.customer-tab-btn').filter({ hasText: 'Danh sÃ¡ch' }).click();
      }

      const reloadBtn = page.locator('.customer-reload-btn');
      const box = await reloadBtn.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.height).toBeGreaterThanOrEqual(44);

      const searchInput = page.locator('.customer-quick-search-input');
      const inputBbox = await searchInput.boundingBox();
      expect(inputBbox).not.toBeNull();
      expect(inputBbox!.height).toBeGreaterThanOrEqual(44);

      // Run Axe accessibility scan
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(axe.violations).toEqual([]);
    }
  });

  test('Customer kiosk map renders securely and initializes interactive map display', async ({
    page,
  }) => {
    await page.route('**/api/kiosks', (route) => route.fulfill({ json: sampleCustomerLocations }));

    await page.goto('/tim-kiosk');

    // Either MapLibre GL canvas (Goong Maps) or Leaflet tiles (fallback with strict referrer policy)
    const mapCanvas = page.locator('.customer-kiosk-map canvas.maplibregl-canvas');
    const tile = page.locator('.customer-kiosk-map img.leaflet-tile').first();

    await expect(mapCanvas.or(tile)).toBeVisible();
    if (await tile.isVisible()) {
      await expect(tile).toHaveAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
    }
  });

  test('Customer kiosk map shows tile error warning on failure and protects manual kiosk list and directions', async ({
    page,
  }) => {
    // Simulate map tile network failure for Goong or OSM
    await page.route('**/*goong*/**', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'text/plain',
        body: '403 Forbidden: tile error',
      }),
    );
    await page.route('https://tile.openstreetmap.org/**', (route) =>
      route.fulfill({
        status: 403,
        contentType: 'text/plain',
        body: '403 Forbidden: OSM policy',
      }),
    );

    await page.route('**/api/kiosks', (route) => route.fulfill({ json: sampleCustomerLocations }));

    await page.goto('/tim-kiosk');

    const warning = page.locator('.customer-kiosk-map-container .kiosk-map-tile-warning');
    await expect(warning).toBeVisible();
    await expect(warning).toContainText(
      'Báº£n Ä‘á»“ chÆ°a táº£i Ä‘Æ°á»£c Ä‘áº§y Ä‘á»§ hÃ¬nh áº£nh. Báº¡n váº«n cÃ³ thá»ƒ xem danh sÃ¡ch Ä‘á»‹a chá»‰ vÃ  báº¥m chá»‰ Ä‘Æ°á»ng bÃªn dÆ°á»›i.',
    );

    // Kiosk cards and directions button remain accessible as manual fallback
    await expect(page.locator('.customer-kiosk-item')).toHaveCount(sampleCustomerLocations.length);
    const dirLink = page
      .locator('.customer-kiosk-item')
      .filter({ hasText: 'Kiosk Landmark 81' })
      .locator('.customer-btn-directions');
    await expect(dirLink).toBeVisible();
    await expect(dirLink).toHaveAttribute('href', /google\.com\/maps\/dir/);
  });
});

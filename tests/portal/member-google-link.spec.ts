import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const customerSession = {
  id: '10000000-0000-0000-0000-000000000010',
  name: 'Lan',
  role: 'CUSTOMER',
  sellerId: null,
  sellerStatus: null,
  packageExpiresAt: null,
};

const customerProfile = {
  id: '10000000-0000-0000-0000-000000000010',
  fullName: 'Lan Nguyễn',
  email: 'lan@example.com',
  loyaltyPoints: 12000,
};

test.describe('Member Google Account Linking', () => {
  test('Shows disabled notice when Google linking is disabled in auth config', async ({ page }) => {
    let scriptLoaded = false;
    await page.route('https://accounts.google.com/gsi/client', async (route) => {
      scriptLoaded = true;
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: '' });
    });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/auth/me') return route.fulfill({ json: customerSession });
      if (url.pathname === '/api/member/profile') return route.fulfill({ json: customerProfile });
      if (url.pathname === '/api/member/history' || url.pathname.endsWith('/preorders')) {
        return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
      }
      if (url.pathname === '/api/auth/config') {
        return route.fulfill({
          json: {
            googleClientId: null,
            googleEnabled: false,
            registrationEmailEnabled: true,
          },
        });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto('/tai-khoan#member-profile');
    const linkSection = page.locator('#member-google-link');
    await expect(linkSection).toBeVisible();
    await expect(
      linkSection.getByText(/Tính năng liên kết tài khoản Google hiện không khả dụng/),
    ).toBeVisible();
    await expect(page.locator('[data-testid="google-link-button-container"]')).toHaveCount(0);
    expect(scriptLoaded).toBe(false);

    const a11y = await new AxeBuilder({ page })
      .include('#member-google-link')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(a11y.violations).toEqual([]);
  });

  test('Handles GIS script failure and provides retry', async ({ page }) => {
    let attempts = 0;
    await page.route('https://accounts.google.com/gsi/client', async (route) => {
      attempts++;
      if (attempts === 1) {
        await route.abort('failed');
      } else {
        const stub = `
          window.google = window.google || {};
          window.google.accounts = window.google.accounts || {};
          window.google.accounts.id = {
            initialize: function() {},
            renderButton: function(parent) {
              parent.innerHTML = '<button type="button" data-testid="mock-gis-button">Google</button>';
            }
          };
        `;
        await route.fulfill({ status: 200, contentType: 'application/javascript', body: stub });
      }
    });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/auth/me') return route.fulfill({ json: customerSession });
      if (url.pathname === '/api/member/profile') return route.fulfill({ json: customerProfile });
      if (url.pathname === '/api/member/history' || url.pathname.endsWith('/preorders')) {
        return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
      }
      if (url.pathname === '/api/auth/config') {
        return route.fulfill({
          json: {
            googleClientId: 'test-client-id-123.apps.googleusercontent.com',
            googleEnabled: true,
            registrationEmailEnabled: true,
          },
        });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto('/tai-khoan#member-profile');
    const linkSection = page.locator('#member-google-link');
    await expect(linkSection.getByRole('alert')).toContainText(
      'Không thể tải dịch vụ Google Identity',
    );
    const retryButton = linkSection.getByRole('button', { name: 'Thử lại' });
    await expect(retryButton).toBeVisible();

    await retryButton.click();
    await expect(page.locator('[data-testid="mock-gis-button"]')).toBeVisible();
    await expect(linkSection.getByRole('alert')).toHaveCount(0);
  });

  test('Enforces same-email instruction, measures button width to 320px, and links credential without mock fallback', async ({
    page,
  }) => {
    let linkedPayload: unknown = null;
    let linkCalls = 0;

    await page.route('https://accounts.google.com/gsi/client', async (route) => {
      const stub = `
        window.google = window.google || {};
        window.google.accounts = window.google.accounts || {};
        window.google.accounts.id = {
          initialize: function(config) {
            window.__gsiConfig = config;
          },
          renderButton: function(parent, options) {
            window.__gsiButtonOptions = options;
            parent.innerHTML = '';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('data-testid', 'mock-gis-button');
            btn.textContent = 'Continue with Google';
            btn.onclick = function() {
              if (window.__gsiConfig && window.__gsiConfig.callback) {
                window.__gsiConfig.callback({ credential: window.__testToken || 'real-google-jwt-token' });
              }
            };
            parent.appendChild(btn);
          }
        };
      `;
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: stub });
    });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/auth/me') return route.fulfill({ json: customerSession });
      if (url.pathname === '/api/member/profile') return route.fulfill({ json: customerProfile });
      if (url.pathname === '/api/member/history' || url.pathname.endsWith('/preorders')) {
        return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
      }
      if (url.pathname === '/api/auth/config') {
        return route.fulfill({
          json: {
            googleClientId: 'test-client-id-abc.apps.googleusercontent.com',
            googleEnabled: true,
            registrationEmailEnabled: true,
          },
        });
      }
      if (url.pathname === '/api/member/google/link') {
        linkCalls++;
        linkedPayload = route.request().postDataJSON();
        return route.fulfill({
          status: 200,
          json: { message: 'Đã liên kết tài khoản Google thành công.' },
        });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto('/tai-khoan#member-profile');
    const linkSection = page.locator('#member-google-link');
    await expect(linkSection).toBeVisible();

    // Verify friendly instruction shows profile email and benefits
    await expect(linkSection).toContainText('lan@example.com');
    await expect(linkSection).toContainText('chọn tài khoản Google sử dụng cùng email');
    await expect(linkSection).toContainText('đăng nhập bằng mật khẩu hiện tại hoặc bằng Google');

    // Verify NO mock fallback inputs (no email input, no manual token input)
    await expect(linkSection.locator('input')).toHaveCount(0);

    // Verify button rendered and measured width is 320px
    const gisButton = page.locator('[data-testid="mock-gis-button"]');
    await expect(gisButton).toBeVisible();

    const options = await page.evaluate(
      () => (window as unknown as { __gsiButtonOptions: { width: number } }).__gsiButtonOptions,
    );
    expect(options.width).toBe(320);

    // Accessibility check
    const a11y = await new AxeBuilder({ page })
      .include('#member-google-link')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(a11y.violations).toEqual([]);

    // Click Google GIS button to trigger credential callback
    await gisButton.click();

    await expect(linkSection.getByText('Đã liên kết tài khoản Google thành công.')).toBeVisible();
    expect(linkCalls).toBe(1);
    expect(linkedPayload).toEqual({ idToken: 'real-google-jwt-token' });
  });

  test('Delayed auth config measures button width after mounting and does not exceed container width', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 360, height: 800 });

    await page.route('https://accounts.google.com/gsi/client', async (route) => {
      const stub = `
        window.google = window.google || {};
        window.google.accounts = window.google.accounts || {};
        window.google.accounts.id = {
          initialize: function(config) {
            window.__gsiConfig = config;
          },
          renderButton: function(parent, options) {
            window.__gsiButtonOptions = options;
            parent.innerHTML = '<button type="button" data-testid="mock-gis-button">Google</button>';
          }
        };
      `;
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: stub });
    });

    let releaseConfig: () => void = () => {};
    const configHold = new Promise<void>((resolve) => {
      releaseConfig = resolve;
    });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/auth/me') return route.fulfill({ json: customerSession });
      if (url.pathname === '/api/member/profile') return route.fulfill({ json: customerProfile });
      if (url.pathname === '/api/member/history' || url.pathname.endsWith('/preorders')) {
        return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
      }
      if (url.pathname === '/api/auth/config') {
        // Hold config response until pending state assertions have completed
        await configHold;
        return route.fulfill({
          json: {
            googleClientId: 'test-client-id-delayed.apps.googleusercontent.com',
            googleEnabled: true,
            registrationEmailEnabled: true,
          },
        });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto('/tai-khoan#member-profile');

    // While config is pending, container is not rendered
    const loadingMessage = page.getByText('Đang tải cấu hình liên kết Google…');
    await expect(loadingMessage).toBeVisible();
    expect(await page.locator('[data-testid="google-link-button-container"]').count()).toBe(0);

    // Release config so the component receives data and finishes rendering
    releaseConfig();

    // Wait for button to be rendered once config arrives
    const gisButton = page.locator('[data-testid="mock-gis-button"]');
    await expect(gisButton).toBeVisible();

    // Verify option width is measured and does NOT exceed available container width
    const containerWidth = await page
      .locator('[data-testid="google-link-button-container"]')
      .evaluate((el) => el.clientWidth);

    const buttonWidthOption = await page.evaluate(
      () =>
        (window as unknown as { __gsiButtonOptions: { width: number } }).__gsiButtonOptions.width,
    );

    expect(buttonWidthOption).toBeGreaterThanOrEqual(200);
    expect(buttonWidthOption).toBeLessThanOrEqual(320);
    expect(buttonWidthOption).toBeLessThanOrEqual(containerWidth);
  });

  test('Guards against duplicate credential submissions while request is in flight', async ({
    page,
  }) => {
    let linkRequests = 0;

    await page.route('https://accounts.google.com/gsi/client', async (route) => {
      const stub = `
        window.google = window.google || {};
        window.google.accounts = window.google.accounts || {};
        window.google.accounts.id = {
          initialize: function(config) {
            window.__gsiConfig = config;
          },
          renderButton: function(parent) {
            parent.innerHTML = '';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('data-testid', 'mock-gis-button');
            btn.textContent = 'Continue with Google';
            btn.onclick = function() {
              if (window.__gsiConfig && window.__gsiConfig.callback) {
                // Fire twice concurrently
                window.__gsiConfig.callback({ credential: 'token-concurrent-1' });
                window.__gsiConfig.callback({ credential: 'token-concurrent-2' });
              }
            };
            parent.appendChild(btn);
          }
        };
      `;
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: stub });
    });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/auth/me') return route.fulfill({ json: customerSession });
      if (url.pathname === '/api/member/profile') return route.fulfill({ json: customerProfile });
      if (url.pathname === '/api/member/history' || url.pathname.endsWith('/preorders')) {
        return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
      }
      if (url.pathname === '/api/auth/config') {
        return route.fulfill({
          json: {
            googleClientId: 'test-client-id-dup.apps.googleusercontent.com',
            googleEnabled: true,
            registrationEmailEnabled: true,
          },
        });
      }
      if (url.pathname === '/api/member/google/link') {
        linkRequests++;
        await new Promise((resolve) => setTimeout(resolve, 200));
        return route.fulfill({
          status: 200,
          json: { message: 'Đã liên kết tài khoản Google thành công.' },
        });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto('/tai-khoan#member-profile');
    const gisButton = page.locator('[data-testid="mock-gis-button"]');
    await expect(gisButton).toBeVisible();

    await gisButton.click();
    await expect(page.getByText('Đã liên kết tài khoản Google thành công.')).toBeVisible();
    expect(linkRequests).toBe(1);
  });

  test('Handles 409 email mismatch error when linking mismatched Google account', async ({
    page,
  }) => {
    await page.route('https://accounts.google.com/gsi/client', async (route) => {
      const stub = `
        window.google = window.google || {};
        window.google.accounts = window.google.accounts || {};
        window.google.accounts.id = {
          initialize: function(config) {
            window.__gsiConfig = config;
          },
          renderButton: function(parent) {
            parent.innerHTML = '';
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.setAttribute('data-testid', 'mock-gis-button');
            btn.textContent = 'Continue with Google';
            btn.onclick = function() {
              if (window.__gsiConfig && window.__gsiConfig.callback) {
                window.__gsiConfig.callback({ credential: 'mismatched-google-token' });
              }
            };
            parent.appendChild(btn);
          }
        };
      `;
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: stub });
    });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/auth/me') return route.fulfill({ json: customerSession });
      if (url.pathname === '/api/member/profile') return route.fulfill({ json: customerProfile });
      if (url.pathname === '/api/member/history' || url.pathname.endsWith('/preorders')) {
        return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
      }
      if (url.pathname === '/api/auth/config') {
        return route.fulfill({
          json: {
            googleClientId: 'test-client-id-abc.apps.googleusercontent.com',
            googleEnabled: true,
            registrationEmailEnabled: true,
          },
        });
      }
      if (url.pathname === '/api/member/google/link') {
        return route.fulfill({
          status: 409,
          json: { detail: 'Email tài khoản Google không khớp với tài khoản hiện tại.' },
        });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto('/tai-khoan#member-profile');
    const gisButton = page.locator('[data-testid="mock-gis-button"]');
    await expect(gisButton).toBeVisible();

    await gisButton.click();

    const linkSection = page.locator('#member-google-link');
    await expect(linkSection.getByRole('alert')).toContainText('Email tài khoản Google không khớp');
  });

  test('SELLER profile can view same-email Google linking in MemberAccount', async ({ page }) => {
    const sellerSession = {
      id: '10000000-0000-0000-0000-000000000020',
      name: 'Tiệm Hoa Lan',
      role: 'SELLER',
      sellerId: '20000000-0000-0000-0000-000000000002',
      sellerStatus: 'ACTIVE',
      packageExpiresAt: '2026-12-31',
    };
    const sellerProfile = {
      id: '10000000-0000-0000-0000-000000000020',
      fullName: 'Chủ Tiệm Lan',
      email: 'seller@example.com',
      loyaltyPoints: 5000,
    };

    await page.route('https://accounts.google.com/gsi/client', async (route) => {
      const stub = `
        window.google = window.google || {};
        window.google.accounts = window.google.accounts || {};
        window.google.accounts.id = {
          initialize: function() {},
          renderButton: function(parent) {
            parent.innerHTML = '<button type="button" data-testid="mock-gis-button">Google</button>';
          }
        };
      `;
      await route.fulfill({ status: 200, contentType: 'application/javascript', body: stub });
    });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname === '/api/auth/me') return route.fulfill({ json: sellerSession });
      if (url.pathname === '/api/member/profile') return route.fulfill({ json: sellerProfile });
      if (url.pathname === '/api/member/history' || url.pathname.endsWith('/preorders')) {
        return route.fulfill({ json: { items: [], page: 1, hasMore: false } });
      }
      if (url.pathname === '/api/auth/config') {
        return route.fulfill({
          json: {
            googleClientId: 'test-client-id-seller.apps.googleusercontent.com',
            googleEnabled: true,
            registrationEmailEnabled: true,
          },
        });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto('/tai-khoan#member-profile');
    const linkSection = page.locator('#member-google-link');
    await expect(linkSection).toBeVisible();
    await expect(linkSection).toContainText('seller@example.com');
    await expect(page.locator('[data-testid="mock-gis-button"]')).toBeVisible();
  });
});

import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (config: { callback: (resp: { credential: string }) => void }) => void;
          renderButton: (container: HTMLElement) => void;
        };
      };
    };
    __gsiCb?: (resp: { credential: string }) => void;
  }
}

test.describe('Real Auth Provider & Email OTP Flow (Mocked Network in Tests Only)', () => {
  test.beforeEach(async ({ page }) => {
    // Provide baseline session/mock handlers
    await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401 }));
    await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 401 }));
  });

  test('Server config unavailable presents honest unavailable state without mock prompt or token', async ({
    page,
  }) => {
    // Mock /api/auth/config returning google disabled
    await page.route('**/api/auth/config', (route) =>
      route.fulfill({
        json: {
          googleClientId: null,
          googleEnabled: false,
          registrationEmailEnabled: true,
        },
      }),
    );

    let promptCalled = false;
    page.on('dialog', async (dialog) => {
      promptCalled = true;
      await dialog.dismiss();
    });

    await page.goto('/dang-nhap');
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();

    const unavailableBtn = page.getByRole('button', {
      name: 'Đăng nhập Google hiện không khả dụng',
    });
    await expect(unavailableBtn).toBeVisible();
    await expect(unavailableBtn).toBeDisabled();
    await expect(
      page.getByText('Đăng nhập Google tạm thời chưa được kích hoạt trên hệ thống.'),
    ).toBeVisible();

    expect(promptCalled).toBe(false);
  });

  test('Server config with registrationEmailEnabled=false honest unavailable state', async ({
    page,
  }) => {
    await page.route('**/api/auth/config', (route) =>
      route.fulfill({
        json: {
          googleClientId: null,
          googleEnabled: false,
          registrationEmailEnabled: false,
        },
      }),
    );

    await page.goto('/dang-ky');
    await expect(page.getByRole('heading', { name: 'Tạo tài khoản FloraBot' })).toBeVisible();
    await expect(
      page.getByText('Chức năng đăng ký tài khoản qua email hiện đang tạm tắt.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tạo tài khoản', exact: true })).toBeDisabled();
  });

  test('GIS credential exchange sends idToken to /auth/google and redirects customer to /tai-khoan', async ({
    page,
  }) => {
    await page.route('**/api/auth/config', (route) =>
      route.fulfill({
        json: {
          googleClientId: 'test-google-client-id-xyz',
          googleEnabled: true,
          registrationEmailEnabled: true,
        },
      }),
    );

    let googleTokenReceived: string | null = null;
    await page.route('**/api/auth/google', async (route) => {
      const data = route.request().postDataJSON() as { idToken: string };
      googleTokenReceived = data.idToken;
      await route.fulfill({
        json: {
          id: '10000000-0000-0000-0000-000000000001',
          name: 'Khách Hàng Google Thật',
          role: 'CUSTOMER',
          email: 'customer.real@gmail.com',
        },
      });
    });

    // Mock catalog/order APIs for /tai-khoan landing
    await page.route('**/api/orders**', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/shop/catalog**', (route) => route.fulfill({ json: [] }));

    // Inject Google Identity Services stub into page before GIS script runs
    await page.addInitScript(() => {
      window.google = {
        accounts: {
          id: {
            initialize: (config: { callback: (resp: { credential: string }) => void }) => {
              (window as unknown as { __gsiCb: (resp: { credential: string }) => void }).__gsiCb =
                config.callback;
            },
            renderButton: (container: HTMLElement) => {
              const btn = document.createElement('button');
              btn.id = 'gis-rendered-test-btn';
              btn.setAttribute('type', 'button');
              btn.textContent = 'Tiếp tục với Google (GIS)';
              btn.onclick = () => {
                const cb = (
                  window as unknown as { __gsiCb: (resp: { credential: string }) => void }
                ).__gsiCb;
                if (cb) cb({ credential: 'real-google-credential-token-999' });
              };
              container.appendChild(btn);
            },
          },
        },
      };
    });

    await page.goto('/dang-nhap');
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();

    const gisBtn = page.locator('#gis-rendered-test-btn');
    await expect(gisBtn).toBeVisible();
    await gisBtn.click();

    await expect.poll(() => googleTokenReceived).toBe('real-google-credential-token-999');
    await expect(page).toHaveURL(/\/tai-khoan$/);
  });

  test('GIS login for existing Seller retains SELLER role and routes to /seller', async ({
    page,
  }) => {
    await page.route('**/api/auth/config', (route) =>
      route.fulfill({
        json: {
          googleClientId: 'test-google-client-id-xyz',
          googleEnabled: true,
          registrationEmailEnabled: true,
        },
      }),
    );

    await page.route('**/api/auth/google', async (route) => {
      await route.fulfill({
        json: {
          id: '10000000-0000-0000-0000-000000000003',
          name: 'Chủ Tiệm Google',
          role: 'SELLER',
          sellerId: '20000000-0000-0000-0000-000000000001',
          sellerStatus: 'ACTIVE',
        },
      });
    });

    await page.route('**/api/**/wallet', (route) =>
      route.fulfill({
        json: {
          balance: 1000000,
          entries: [],
          bankConfigured: true,
          minimumWithdrawal: 50000,
          withdrawals: [],
          hasMoreEntries: false,
          hasMoreWithdrawals: false,
        },
      }),
    );
    await page.route('**/api/**/slots', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/**/products', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/**/subscriptions', (route) =>
      route.fulfill({ json: { package: null, subscriptions: [] } }),
    );

    await page.addInitScript(() => {
      window.google = {
        accounts: {
          id: {
            initialize: (config: { callback: (resp: { credential: string }) => void }) => {
              (window as unknown as { __gsiCb: (resp: { credential: string }) => void }).__gsiCb =
                config.callback;
            },
            renderButton: (container: HTMLElement) => {
              const btn = document.createElement('button');
              btn.id = 'gis-seller-btn';
              btn.setAttribute('type', 'button');
              btn.textContent = 'Đăng nhập Google';
              btn.onclick = () => {
                const cb = (
                  window as unknown as { __gsiCb: (resp: { credential: string }) => void }
                ).__gsiCb;
                if (cb) cb({ credential: 'seller-google-token' });
              };
              container.appendChild(btn);
            },
          },
        },
      };
    });

    await page.goto('/dang-nhap');
    const gisBtn = page.locator('#gis-seller-btn');
    await expect(gisBtn).toBeVisible();
    await gisBtn.click();

    await expect(page).toHaveURL(/\/seller$/);
  });

  test('GIS script load error shows honest connection failure message', async ({ page }) => {
    await page.route('**/api/auth/config', (route) =>
      route.fulfill({
        json: {
          googleClientId: 'test-google-client-id-xyz',
          googleEnabled: true,
          registrationEmailEnabled: true,
        },
      }),
    );

    // Abort GIS script download
    await page.route('https://accounts.google.com/gsi/client', (route) => route.abort());

    await page.goto('/dang-nhap');
    await expect(
      page.getByRole('button', { name: 'Không thể tải đăng nhập Google' }),
    ).toBeVisible();
    await expect(page.getByText('Không thể kết nối đến Google Identity Services.')).toBeVisible();
  });

  test('Registration flow: pending challenge shows OTP step with NO immediate redirect, handles wrong code, resend cooldown, back, and verify success', async ({
    page,
  }) => {
    await page.route('**/api/auth/config', (route) =>
      route.fulfill({
        json: {
          googleClientId: null,
          googleEnabled: false,
          registrationEmailEnabled: true,
        },
      }),
    );

    let registerCalls = 0;
    let registerBody: unknown = null;
    await page.route('**/api/auth/register', async (route) => {
      registerCalls++;
      registerBody = route.request().postDataJSON();
      await route.fulfill({
        json: {
          challengeId: `challenge-id-${registerCalls}`,
          expiresInSeconds: 600,
          resendAfterSeconds: 2,
          message: 'Mã xác thực đã được gửi tới email khach@example.com.',
        },
      });
    });

    let verifyCalls = 0;
    let verifyBody: unknown = null;
    await page.route('**/api/auth/register/verify', async (route) => {
      verifyCalls++;
      verifyBody = route.request().postDataJSON();
      const body = verifyBody as { challengeId: string; code: string };
      if (body.code === '000000') {
        await route.fulfill({
          status: 400,
          json: { detail: 'Mã xác thực không hợp lệ hoặc đã hết hạn.' },
        });
        return;
      }
      await route.fulfill({
        json: {
          id: '10000000-0000-0000-0000-000000000009',
          name: 'Khách Đăng Ký',
          role: 'CUSTOMER',
          email: 'khach@example.com',
        },
      });
    });

    await page.route('**/api/orders**', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/shop/catalog**', (route) => route.fulfill({ json: [] }));

    await page.goto('/dang-ky');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tạo tài khoản FloraBot');

    // Fill registration form
    await page.getByLabel('Họ và tên', { exact: true }).fill('Khách Đăng Ký');
    await page.getByLabel('Email', { exact: true }).fill('khach@example.com');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('MatKhauBaoMat-123');
    await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('MatKhauBaoMat-123');
    await page.getByRole('checkbox').check();

    // Submit registration
    await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();

    // 1. Assert: NO redirect happened before OTP! Still on /dang-ky
    await expect(page).toHaveURL(/\/dang-ky$/);
    expect(registerCalls).toBe(1);
    expect(registerBody).toEqual({
      fullName: 'Khách Đăng Ký',
      email: 'khach@example.com',
      password: 'MatKhauBaoMat-123',
    });

    // 2. Assert: OTP verification UI rendered
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Xác thực tài khoản');
    await expect(page.getByText('khach@example.com')).toBeVisible();
    const otpInput = page.getByLabel('Mã xác thực (6 chữ số)');
    await expect(otpInput).toBeVisible();
    await expect(otpInput).toBeFocused();
    await expect(page.getByText(/Mã có hiệu lực trong/)).toBeVisible();

    // 3. Resend button is initially disabled with countdown
    const resendBtn = page.getByRole('button', { name: /Gửi lại mã/ });
    await expect(resendBtn).toBeDisabled();

    // 4. Test wrong OTP code submission
    await otpInput.fill('000000');
    await page.getByRole('button', { name: 'Xác thực và đăng nhập' }).click();

    await expect(page.getByRole('main').getByRole('alert')).toContainText(
      'Mã xác thực không hợp lệ hoặc đã hết hạn.',
    );
    // Still on /dang-ky
    await expect(page).toHaveURL(/\/dang-ky$/);
    expect(verifyCalls).toBe(1);
    expect(verifyBody).toEqual({
      challengeId: 'challenge-id-1',
      code: '000000',
    });

    // 5. Test resend after cooldown
    await expect(page.getByRole('button', { name: 'Gửi lại mã xác thực' })).toBeEnabled({
      timeout: 5000,
    });
    await page.getByRole('button', { name: 'Gửi lại mã xác thực' }).click();

    expect(registerCalls).toBe(2);
    // Resend obeyed cooldown and sent same credentials
    expect(registerBody).toEqual({
      fullName: 'Khách Đăng Ký',
      email: 'khach@example.com',
      password: 'MatKhauBaoMat-123',
    });
    await expect(page.getByText('Đã gửi lại mã xác thực mới tới email của bạn.')).toBeVisible();

    // 6. Test Back / Change Email button clears sensitive state
    await page.getByRole('button', { name: 'Đổi email hoặc quay lại' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Tạo tài khoản FloraBot');
    // Password cleared from form on cancel
    await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveValue('');
    // Email preserved for convenience
    await expect(page.getByLabel('Email', { exact: true })).toHaveValue('khach@example.com');

    // Re-fill password and submit again
    await page.getByLabel('Mật khẩu', { exact: true }).fill('MatKhauBaoMat-123');
    await page.getByLabel('Nhập lại mật khẩu', { exact: true }).fill('MatKhauBaoMat-123');
    await page.getByRole('button', { name: 'Tạo tài khoản', exact: true }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Xác thực tài khoản');
    expect(registerCalls).toBe(3);

    // 7. Verify valid OTP code leads to session & redirection
    await page.getByLabel('Mã xác thực (6 chữ số)').fill('654321');
    await page.getByRole('button', { name: 'Xác thực và đăng nhập' }).click();

    expect(verifyCalls).toBe(2);
    expect(verifyBody).toEqual({
      challengeId: 'challenge-id-3',
      code: '654321',
    });

    // ONLY NOW session is established and redirected to account page
    await expect(page).toHaveURL(/\/tai-khoan$/);
  });

  test('Standard password login regressions stay intact', async ({ page }) => {
    let loginData: unknown = null;
    await page.route('**/api/auth/login', async (route) => {
      loginData = route.request().postDataJSON();
      await route.fulfill({
        json: {
          id: '10000000-0000-0000-0000-000000000001',
          name: 'Khách Hàng',
          role: 'CUSTOMER',
          email: 'user@example.com',
        },
      });
    });

    await page.route('**/api/orders**', (route) => route.fulfill({ json: [] }));
    await page.route('**/api/shop/catalog**', (route) => route.fulfill({ json: [] }));

    await page.goto('/dang-nhap');
    await page.getByLabel('Email', { exact: true }).fill('user@example.com');
    await page.getByLabel('Mật khẩu', { exact: true }).fill('MatKhau-123456');
    await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();

    expect(loginData).toEqual({
      email: 'user@example.com',
      password: 'MatKhau-123456',
    });
    await expect(page).toHaveURL(/\/tai-khoan$/);
  });

  test('Privileged admin login is password-only and does not show Google option', async ({
    page,
  }) => {
    await page.goto('/admin/login');
    await expect(page.getByRole('heading', { name: 'Đăng nhập vận hành' })).toBeVisible();
    await expect(page.getByLabel('Email', { exact: true })).toBeVisible();
    await expect(page.getByLabel('Mật khẩu', { exact: true })).toBeVisible();
    // No Google button on privileged portal
    await expect(page.locator('.auth-google-btn')).toHaveCount(0);
    await expect(page.locator('.auth-social-section')).toHaveCount(0);
  });

  test('Viewport 320px responsiveness: GIS and OTP views do not cause horizontal overflow', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 900 });

    await page.route('**/api/auth/config', (route) =>
      route.fulfill({
        json: {
          googleClientId: 'test-google-client-id-xyz',
          googleEnabled: true,
          registrationEmailEnabled: true,
        },
      }),
    );

    await page.goto('/dang-nhap');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );

    const accessibility = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    expect(accessibility.violations).toEqual([]);
  });
});

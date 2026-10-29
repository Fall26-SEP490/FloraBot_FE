import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const sessions = {
  ADMIN: {
    id: '10000000-0000-0000-0000-000000000001',
    name: 'Quản Trị Viên',
    role: 'ADMIN',
    sellerId: null,
    sellerStatus: null,
    packageExpiresAt: null,
  },
  OPERATIONS_MANAGER: {
    id: '10000000-0000-0000-0000-000000000010',
    name: 'Nguyễn Quản Lý',
    role: 'OPERATIONS_MANAGER',
    sellerId: null,
    sellerStatus: null,
    packageExpiresAt: null,
  },
  TECHNICIAN: {
    id: '10000000-0000-0000-0000-000000000011',
    name: 'Trần Kỹ Thuật',
    role: 'TECHNICIAN',
    sellerId: null,
    sellerStatus: null,
    packageExpiresAt: null,
  },
  SELLER: {
    id: '10000000-0000-0000-0000-000000000020',
    name: 'Chủ Tiệm Hoa',
    role: 'SELLER',
    sellerId: '20000000-0000-0000-0000-000000000001',
    sellerStatus: 'ACTIVE',
    packageExpiresAt: '2030-01-01',
  },
  SELLER_STAFF: {
    id: '10000000-0000-0000-0000-000000000012',
    name: 'Lê Nhân Viên Shop',
    role: 'SELLER_STAFF',
    sellerId: '20000000-0000-0000-0000-000000000001',
    sellerStatus: 'ACTIVE',
    packageExpiresAt: null,
  },
  CUSTOMER: {
    id: '10000000-0000-0000-0000-000000000050',
    name: 'Khách Hàng Thân Thiết',
    role: 'CUSTOMER',
    sellerId: null,
    sellerStatus: null,
    packageExpiresAt: null,
  },
} as const;

function makeMockProfile(overrides: Record<string, unknown> = {}) {
  return {
    id: '10000000-0000-0000-0000-000000000001',
    fullName: 'Người Dùng Mẫu',
    loginEmail: 'user@florabot.vn',
    phone: '0901234567',
    address: '123 Đường Hoa, Phường Bến Nghé, Quận 1',
    contactEmail: 'user@florabot.vn',
    contactEmailIsDefault: true,
    contactEmailVerified: false,
    bank: {
      bankName: 'Ngân hàng Quân Đội',
      accountHolder: 'NGUYEN VAN MAU',
      accountLast4: '5678',
      hasAccount: true,
      accountNumber: '123456789012',
      status: 'READY',
    },
    ...overrides,
  };
}

test.describe('Personal Profile UI - Multi-Role, Verification, Bank & A11y', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
    await page.route('**/api/**', (route) =>
      route.fulfill({ status: 503, json: { detail: 'API chưa được cấu hình trong test này.' } }),
    );
  });

  test('All 6 roles can access /ho-so without being redirected away', async ({ page }) => {
    for (const [role, session] of Object.entries(sessions)) {
      const mockProfile = makeMockProfile({
        id: session.id,
        fullName: session.name,
        loginEmail: `${role.toLowerCase()}@florabot.vn`,
      });

      await page.route('**/api/auth/me', (route) => route.fulfill({ json: session }));
      await page.route('**/api/account/profile', (route) => route.fulfill({ json: mockProfile }));

      await page.goto('/ho-so');
      await expect(page).toHaveURL(/\/ho-so$/);
      await expect(page.getByRole('heading', { level: 1, name: session.name })).toBeVisible();
      await expect(
        page.getByRole('region', { name: 'Định danh tài khoản đăng nhập' }),
      ).toBeVisible();

      await page.unroute('**/api/account/profile');
      await page.unroute('**/api/auth/me');
    }
  });

  test('Anonymous visitor on /ho-so sees login options with preserved returnUrl', async ({
    page,
  }) => {
    await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401 }));

    await page.goto('/ho-so');
    await expect(page).toHaveURL(/\/ho-so$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Hồ sơ cá nhân' })).toBeVisible();

    const memberLogin = page.getByRole('link', { name: 'Đăng nhập tài khoản' });
    const adminLogin = page.getByRole('link', { name: 'Đăng nhập vận hành' });

    await expect(memberLogin).toHaveAttribute('href', '/dang-nhap?returnUrl=/ho-so');
    await expect(adminLogin).toHaveAttribute('href', '/admin/login?returnUrl=/ho-so');
  });

  test('Session 503 error displays connection failure notice and retry button instead of anonymous login', async ({
    page,
  }) => {
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        status: 503,
        json: { detail: 'Dịch vụ phiên đăng nhập đang bận. Vui lòng thử lại.' },
      }),
    );

    await page.goto('/ho-so');
    await expect(page).toHaveURL(/\/ho-so$/);
    await expect(page.getByRole('heading', { name: 'Chưa kết nối được FloraBot' })).toBeVisible();
    await expect(
      page.getByText('Dịch vụ phiên đăng nhập đang bận. Vui lòng thử lại.'),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: 'Thử lại' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Đăng nhập tài khoản' })).toHaveCount(0);
  });

  for (const portal of ['member', 'platform'] as const) {
    test(`Signing in through ${portal} profile link returns to the profile`, async ({ page }) => {
      const session = portal === 'member' ? sessions.CUSTOMER : sessions.ADMIN;
      let signedIn = false;
      await page.route('**/api/auth/config', (route) =>
        route.fulfill({
          json: { googleEnabled: false, googleClientId: null, registrationEmailEnabled: false },
        }),
      );
      await page.route('**/api/auth/me', (route) =>
        signedIn ? route.fulfill({ json: session }) : route.fulfill({ status: 401 }),
      );
      await page.route('**/api/auth/refresh', (route) => route.fulfill({ status: 401 }));
      await page.route(
        portal === 'member' ? '**/api/auth/login' : '**/api/auth/admin/login',
        (route) => {
          signedIn = true;
          return route.fulfill({ json: session });
        },
      );
      await page.route('**/api/account/profile', (route) =>
        route.fulfill({ json: makeMockProfile({ fullName: session.name }) }),
      );
      await page.goto('/ho-so');
      await page
        .getByRole('link', {
          name: portal === 'member' ? 'Đăng nhập tài khoản' : 'Đăng nhập vận hành',
          exact: true,
        })
        .click();
      await page.getByLabel('Email', { exact: true }).fill('test@example.test');
      await page.getByLabel('Mật khẩu', { exact: true }).fill('ExistingTest@1234');
      await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
      await expect(page).toHaveURL(/\/ho-so$/);
      await expect(page.getByRole('heading', { level: 1, name: session.name })).toBeVisible();
    });
  }

  test('Retired STAFF role on /ho-so displays retired notice and handles logout error gracefully', async ({
    page,
  }) => {
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: {
          id: '10000000-0000-0000-0000-000000000099',
          name: 'Cựu Nhân Viên',
          role: 'STAFF',
        },
      }),
    );
    await page.route('**/api/auth/logout', (route) =>
      route.fulfill({
        status: 500,
        json: { detail: 'Lỗi máy chủ khi đăng xuất.' },
      }),
    );

    await page.goto('/ho-so');
    await expect(page).toHaveURL(/\/ho-so$/);
    await expect(
      page.getByRole('heading', { name: 'Tài khoản nhân viên cũ đã ngừng hoạt động' }),
    ).toBeVisible();
    await expect(
      page.getByText('Tài khoản nhân viên FloraBot trước đây đã ngừng hoạt động.'),
    ).toBeVisible();

    const logoutBtn = page.locator('#main').getByRole('button', { name: 'Đăng xuất' });
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Verify error shown and does NOT pretend to be logged out
    await expect(
      page.getByRole('alert').filter({ hasText: 'Lỗi máy chủ khi đăng xuất.' }),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/ho-so$/);
  });

  test('Discoverable profile link exists in WorkspaceHeader and navigates to /ho-so', async ({
    page,
  }) => {
    const admin = sessions.ADMIN;
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: admin }));
    await page.route('**/api/account/profile', (route) =>
      route.fulfill({ json: makeMockProfile({ fullName: admin.name }) }),
    );
    await page.route('**/api/admin/managers**', (route) => route.fulfill({ json: [] }));

    await page.goto('/admin/managers');
    const accountToggle = page.getByRole('button', {
      name: `Mở menu người dùng của ${admin.name}`,
    });
    await expect(accountToggle).toBeVisible();
    await expect(page.getByRole('button', { name: 'Đăng xuất', exact: true })).toHaveCount(0);
    await accountToggle.click();
    const profileLink = page
      .locator('#workspace-user-menu')
      .getByRole('link', { name: 'Hồ sơ cá nhân', exact: true });
    await expect(profileLink).toBeVisible();
    await profileLink.click();
    await expect(page).toHaveURL(/\/ho-so$/);
    await expect(page.getByRole('heading', { level: 1, name: admin.name })).toBeVisible();
  });

  test('Update basic profile payload sends trimmed fullName, phone, address and updates UI', async ({
    page,
  }) => {
    const customer = sessions.CUSTOMER;
    let putPayload: unknown = null;
    let currentProfile = makeMockProfile({
      id: customer.id,
      fullName: customer.name,
      loginEmail: 'customer@florabot.vn',
      phone: '0901234567',
      address: '123 Đường Cũ',
    });

    await page.route('**/api/auth/me', (route) => route.fulfill({ json: customer }));
    await page.route('**/api/account/profile', async (route) => {
      if (route.request().method() === 'PUT') {
        putPayload = route.request().postDataJSON();
        const postData = putPayload as {
          fullName: string;
          phone: string | null;
          address: string | null;
        };
        currentProfile = {
          ...currentProfile,
          fullName: postData.fullName,
          phone: postData.phone,
          address: postData.address,
        };
        return route.fulfill({ json: currentProfile });
      }
      return route.fulfill({ json: currentProfile });
    });

    await page.goto('/ho-so');

    // Verify loginEmail is read-only
    const identitySection = page.getByRole('region', { name: 'Định danh tài khoản đăng nhập' });
    await expect(identitySection.getByText('customer@florabot.vn')).toBeVisible();

    // Fill form
    await page.getByLabel('Họ và tên *').fill('Nguyễn Thành Viên Mới');
    await page.getByLabel('Số điện thoại').fill('0987654321');
    await page.getByLabel('Địa chỉ').fill('456 Đường Mới, Quận 3');
    await page.getByRole('button', { name: 'Lưu thông tin cá nhân' }).click();

    expect(putPayload).toEqual({
      fullName: 'Nguyễn Thành Viên Mới',
      phone: '0987654321',
      address: '456 Đường Mới, Quận 3',
      clearGender: true,
      clearDateOfBirth: true,
    });

    await expect(
      page.getByRole('status').filter({ hasText: 'Đã lưu thay đổi hồ sơ cá nhân.' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: 'Nguyễn Thành Viên Mới' }),
    ).toBeVisible();
  });

  test('Duplicate phone rejection 409 displays alert message', async ({ page }) => {
    const seller = sessions.SELLER;
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: seller }));
    await page.route('**/api/account/profile', async (route) => {
      if (route.request().method() === 'PUT') {
        return route.fulfill({
          status: 409,
          json: { detail: 'Số điện thoại này đã được sử dụng.' },
        });
      }
      return route.fulfill({ json: makeMockProfile() });
    });

    await page.goto('/ho-so');
    await page.getByLabel('Số điện thoại').fill('0911223344');
    await page.getByRole('button', { name: 'Lưu thông tin cá nhân' }).click();

    await expect(
      page.getByRole('alert').filter({ hasText: 'Số điện thoại này đã được sử dụng' }),
    ).toBeVisible();
  });

  test('Bank masked display, reveal full digits, edit bundle, and clear bank', async ({ page }) => {
    const manager = sessions.OPERATIONS_MANAGER;
    let bankProfile = makeMockProfile({
      bank: {
        bankName: 'Ngân hàng Quân Đội',
        accountHolder: 'TRAN VAN QUAN LY',
        accountLast4: '9876',
        hasAccount: true,
        accountNumber: '00112233449876',
        status: 'READY',
      },
    });

    let putPayload: unknown = null;
    let profileReads = 0;

    await page.route('**/api/auth/me', (route) => route.fulfill({ json: manager }));
    await page.route('**/api/account/profile', async (route) => {
      if (route.request().method() === 'PUT') {
        putPayload = route.request().postDataJSON();
        const body = putPayload as {
          clearBank?: boolean;
          bank?: { bankName: string; accountHolder: string; accountNumber: string };
        };
        if (body.clearBank) {
          bankProfile = { ...bankProfile, bank: null };
        } else if (body.bank) {
          bankProfile = {
            ...bankProfile,
            bank: {
              bankName: body.bank.bankName,
              accountHolder: body.bank.accountHolder,
              accountLast4: body.bank.accountNumber.slice(-4),
              hasAccount: true,
              accountNumber: body.bank.accountNumber,
              status: 'READY',
            },
          };
        }
        return route.fulfill({ json: bankProfile });
      }
      profileReads++;
      return route.fulfill({ json: bankProfile });
    });

    await page.goto('/ho-so');

    // 1. Masked initially
    await expect(page.getByText('•••• •••• •••• 9876')).toBeVisible();

    // 2. Explicit reveal
    await page.getByRole('button', { name: 'Hiện đầy đủ số tài khoản ngân hàng' }).click();
    await expect(page.getByText('00112233449876')).toBeVisible();
    expect(profileReads).toBeGreaterThan(1);

    // Hide again
    await page.getByRole('button', { name: 'Ẩn số tài khoản' }).click();
    await expect(page.getByText('•••• •••• •••• 9876')).toBeVisible();

    // Re-reveal and test automatic clear on tab hide / visibility change
    await page.getByRole('button', { name: 'Hiện đầy đủ số tài khoản ngân hàng' }).click();
    await expect(page.getByText('00112233449876')).toBeVisible();

    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', {
        value: true,
        writable: true,
        configurable: true,
      });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await expect(page.getByText('•••• •••• •••• 9876')).toBeVisible();
    await expect(page.getByText('00112233449876')).toHaveCount(0);

    // 3. Edit bank bundle with review step
    await page.getByRole('button', { name: 'Đổi tài khoản ngân hàng' }).click();
    await page.getByLabel('Tên ngân hàng *').fill('Ngân hàng Ngoại Thương Vietcombank');
    await page.getByLabel('Tên chủ tài khoản *').fill('TRAN VAN QUAN LY');
    await page.getByLabel('Số tài khoản ngân hàng *').fill('9988776655');
    await page.getByRole('button', { name: 'Kiểm tra thông tin tài khoản' }).click();

    // In review card
    await expect(
      page.getByRole('heading', { name: 'Kiểm tra thông tin tài khoản cá nhân' }),
    ).toBeVisible();
    await expect(page.getByText('Ngân hàng Ngoại Thương Vietcombank')).toBeVisible();
    await page.getByRole('button', { name: 'Xác nhận lưu tài khoản' }).click();

    expect(putPayload).toMatchObject({
      bank: {
        bankName: 'Ngân hàng Ngoại Thương Vietcombank',
        accountHolder: 'TRAN VAN QUAN LY',
        accountNumber: '9988776655',
      },
    });
    await expect(page.getByText('•••• •••• •••• 6655')).toBeVisible();

    // 4. Clear bank with confirmation modal
    await page.getByRole('button', { name: 'Xóa tài khoản ngân hàng' }).click();
    const confirmDialog = page.getByRole('dialog', { name: 'Xác nhận xóa tài khoản ngân hàng?' });
    await expect(confirmDialog).toBeVisible();
    await confirmDialog.getByRole('button', { name: 'Xác nhận xóa' }).click();

    expect(putPayload).toMatchObject({ clearBank: true });
    await expect(
      page.getByText('Bạn chưa lưu thông tin tài khoản ngân hàng cá nhân.'),
    ).toBeVisible();
  });

  test('Contact email verification OTP flow with cooldown, wrong code, success, and reset default', async ({
    page,
  }) => {
    const technician = sessions.TECHNICIAN;
    let contactProfile = makeMockProfile({
      contactEmail: 'tech@florabot.vn',
      contactEmailIsDefault: true,
      contactEmailVerified: false,
    });

    let requestedChallengeEmail = '';
    let verifiedCode = '';
    let resetDefaultCalled = false;

    await page.route('**/api/auth/me', (route) => route.fulfill({ json: technician }));
    await page.route('**/api/account/profile', (route) => route.fulfill({ json: contactProfile }));

    await page.route('**/api/account/contact-email', async (route) => {
      const data = route.request().postDataJSON() as { email: string };
      requestedChallengeEmail = data.email;
      return route.fulfill({
        json: {
          challengeId: 'challenge-123456',
          expiresInSeconds: 600,
          resendAfterSeconds: 60,
          message: 'Mã OTP đã được gửi.',
        },
      });
    });

    await page.route('**/api/account/contact-email/verify', async (route) => {
      const data = route.request().postDataJSON() as { challengeId: string; code: string };
      verifiedCode = data.code;
      if (verifiedCode === '999999') {
        return route.fulfill({
          status: 400,
          json: { detail: 'Mã OTP không đúng hoặc đã hết hạn.' },
        });
      }
      contactProfile = {
        ...contactProfile,
        contactEmail: requestedChallengeEmail,
        contactEmailIsDefault: false,
        contactEmailVerified: true,
      };
      return route.fulfill({ json: contactProfile });
    });

    await page.route('**/api/account/contact-email/reset', async (route) => {
      resetDefaultCalled = true;
      contactProfile = {
        ...contactProfile,
        contactEmail: contactProfile.loginEmail,
        contactEmailIsDefault: true,
        contactEmailVerified: false,
      };
      return route.fulfill({ json: contactProfile });
    });

    await page.goto('/ho-so');

    // 1. Initial default state
    await expect(page.getByText('Mặc định (Email đăng nhập)')).toBeVisible();

    // 2. Request new contact email OTP
    await page.getByRole('button', { name: 'Thay đổi email liên hệ' }).click();
    await page.getByLabel('Địa chỉ email liên hệ mới *').fill('personal@gmail.com');
    await page.getByRole('button', { name: 'Gửi mã xác thực (OTP)' }).click();

    expect(requestedChallengeEmail).toBe('personal@gmail.com');

    // 3. OTP verification step & cooldown check
    await expect(page.getByText('personal@gmail.com')).toBeVisible();
    const resendBtn = page.getByRole('button', { name: /Gửi lại sau/ });
    await expect(resendBtn).toBeDisabled();

    // 4. Wrong OTP code
    await page.getByLabel('Mã xác thực OTP *').fill('999999');
    await page.getByRole('button', { name: 'Xác nhận mã OTP' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Mã OTP không đúng hoặc đã hết hạn.' }),
    ).toBeVisible();

    // 5. Correct OTP code
    await page.getByLabel('Mã xác thực OTP *').fill('123456');
    await page.getByRole('button', { name: 'Xác nhận mã OTP' }).click();
    expect(verifiedCode).toBe('123456');
    await expect(
      page.getByRole('status').filter({ hasText: 'Email liên hệ mới đã được xác thực' }),
    ).toBeVisible();
    await expect(page.getByText('Đã xác thực', { exact: true })).toBeVisible();

    // 6. Reset to default login email
    await page.getByRole('button', { name: 'Khôi phục về email đăng nhập mặc định' }).click();
    expect(resetDefaultCalled).toBe(true);
    await expect(page.getByText('Mặc định (Email đăng nhập)')).toBeVisible();
  });

  test('Switching identity clears the previous draft and revealed bank data', async ({ page }) => {
    await page.clock.install();
    let active: (typeof sessions)[keyof typeof sessions] = sessions.ADMIN;
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: active }));
    await page.route('**/api/account/profile', (route) =>
      route.fulfill({
        json: makeMockProfile({
          id: active.id,
          fullName: active.name,
          loginEmail: `${active.role.toLowerCase()}@florabot.test`,
        }),
      }),
    );
    await page.goto('/ho-so');
    const name = page.locator('#profile-full-name');
    await expect(name).toHaveValue(sessions.ADMIN.name);
    await name.fill('Bản nháp riêng của người trước');
    await page.getByRole('button', { name: 'Hiện đầy đủ số tài khoản ngân hàng' }).click();
    await expect(page.getByText('123456789012', { exact: true })).toBeVisible();
    active = sessions.CUSTOMER;
    await page.clock.fastForward(31_000);
    await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
    await expect(
      page.getByRole('heading', { level: 1, name: sessions.CUSTOMER.name }),
    ).toBeVisible();
    await expect(name).toHaveValue(sessions.CUSTOMER.name);
    await expect(page.getByText('123456789012', { exact: true })).toHaveCount(0);
  });

  test('Unsaved form draft is preserved during background refetch', async ({ page }) => {
    await page.clock.install();
    const staff = sessions.SELLER_STAFF;
    let reads = 0;
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: staff }));
    await page.route('**/api/account/profile', (route) => {
      reads++;
      return route.fulfill({
        json: makeMockProfile({
          fullName: reads === 1 ? 'Tên Ban Đầu Của Nhân Viên' : 'Tên mới từ máy chủ',
        }),
      });
    });

    await page.goto('/ho-so');
    const nameInput = page.getByLabel('Họ và tên *');
    await expect(nameInput).toHaveValue('Tên Ban Đầu Của Nhân Viên');

    // Type a draft
    await nameInput.fill('Bản Nháp Chưa Lưu Đang Soạn');

    await page.clock.fastForward(31_000);
    await page.evaluate(() => {
      window.dispatchEvent(new Event('visibilitychange'));
    });
    await expect.poll(() => reads).toBeGreaterThan(1);

    // Verify input still preserves the user's typed draft
    await expect(nameInput).toHaveValue('Bản Nháp Chưa Lưu Đang Soạn');
  });

  test('Demographics load, save, clear and cancel use backend clear flags', async ({ page }) => {
    let current = makeMockProfile({ gender: 'FEMALE', dateOfBirth: '2004-02-29' });
    let payload: Record<string, unknown> = {};
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: sessions.CUSTOMER }));
    await page.route('**/api/account/profile', (route) => {
      if (route.request().method() === 'PUT') {
        payload = route.request().postDataJSON();
        current = {
          ...current,
          ...payload,
          gender: payload.clearGender ? null : payload.gender,
          dateOfBirth: payload.clearDateOfBirth ? null : payload.dateOfBirth,
        };
      }
      return route.fulfill({ json: current });
    });
    await page.goto('/ho-so');
    await expect(page.getByLabel('Giới tính', { exact: true })).toHaveValue('FEMALE');
    await expect(page.getByLabel('Ngày sinh', { exact: true })).toHaveValue('2004-02-29');
    await page.getByLabel('Giới tính', { exact: true }).selectOption('UNDISCLOSED');
    await page.getByRole('button', { name: 'Hủy thay đổi', exact: true }).click();
    await expect(page.getByLabel('Giới tính', { exact: true })).toHaveValue('FEMALE');
    await page.getByLabel('Giới tính', { exact: true }).selectOption('OTHER');
    await page.getByLabel('Ngày sinh', { exact: true }).fill('2000-01-02');
    await page.getByRole('button', { name: 'Lưu thông tin cá nhân', exact: true }).click();
    await expect(page.getByRole('status').filter({ hasText: 'Đã lưu thay đổi' })).toBeVisible();
    expect(payload).toMatchObject({ gender: 'OTHER', dateOfBirth: '2000-01-02' });
    expect(payload).not.toHaveProperty('clearGender');
    await page.getByLabel('Giới tính', { exact: true }).selectOption('');
    await page.getByLabel('Ngày sinh', { exact: true }).fill('');
    await page.getByRole('button', { name: 'Lưu thông tin cá nhân', exact: true }).click();
    await expect.poll(() => payload.clearDateOfBirth).toBe(true);
    expect(payload).toMatchObject({ clearGender: true, clearDateOfBirth: true });
    expect(payload).not.toHaveProperty('dateOfBirth');
  });

  test('Future birth date is blocked before PUT', async ({ page }) => {
    let writes = 0;
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: sessions.CUSTOMER }));
    await page.route('**/api/account/profile', (route) => {
      if (route.request().method() === 'PUT') writes++;
      return route.fulfill({ json: makeMockProfile() });
    });
    await page.goto('/ho-so');
    await page.getByLabel('Ngày sinh', { exact: true }).fill('2999-01-01');
    await page.getByRole('button', { name: 'Lưu thông tin cá nhân', exact: true }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'Ngày sinh không hợp lệ' }),
    ).toBeVisible();
    expect(writes).toBe(0);
  });

  test('Bank decryption failure shows repair state and blocks reveal', async ({ page }) => {
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: sessions.ADMIN }));
    await page.route('**/api/account/profile', (route) =>
      route.fulfill({
        json: makeMockProfile({
          bank: {
            bankName: 'Test',
            accountHolder: 'TEST',
            hasAccount: true,
            accountLast4: '5678',
            accountNumber: null,
            status: 'NEEDS_UPDATE',
          },
        }),
      }),
    );
    await page.goto('/ho-so');
    await expect(
      page.getByText('Thông tin ngân hàng đã lưu chưa đọc được.', { exact: false }),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Hiện đầy đủ số tài khoản ngân hàng' }),
    ).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Đổi tài khoản ngân hàng' })).toBeEnabled();
    await expect(page.getByText(/Để đổi mật khẩu tài khoản quản trị viên/)).toBeVisible();
    await expect(page.getByLabel('Mật khẩu hiện tại', { exact: true })).toHaveCount(0);
  });

  test('OTP expiry uses server duration and a resend clears the old code', async ({ page }) => {
    await page.clock.install();
    let requests = 0;
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: sessions.TECHNICIAN }));
    await page.route('**/api/account/profile', (route) =>
      route.fulfill({ json: makeMockProfile() }),
    );
    await page.route('**/api/account/contact-email', (route) => {
      requests++;
      return route.fulfill({
        json: { challengeId: `challenge-${requests}`, expiresInSeconds: 5, resendAfterSeconds: 1 },
      });
    });
    await page.goto('/ho-so');
    await page.getByRole('button', { name: 'Thay đổi email liên hệ' }).click();
    await page.getByLabel('Địa chỉ email liên hệ mới *').fill('new@example.test');
    await page.getByRole('button', { name: 'Gửi mã xác thực (OTP)' }).click();
    await page.getByLabel('Mã xác thực OTP *').fill('123456');
    await page.clock.fastForward(6000);
    await expect(page.getByText(/Mã OTP đã hết hạn/)).toBeVisible();
    await expect(page.getByRole('button', { name: 'Xác nhận mã OTP' })).toBeDisabled();
    await page.getByRole('button', { name: 'Gửi lại mã OTP', exact: true }).click();
    await expect(page.getByLabel('Mã xác thực OTP *')).toHaveValue('');
    await expect(page.getByLabel('Mã xác thực OTP *')).toBeEnabled();
    expect(requests).toBe(2);
  });

  test('A bank read arriving after tab hiding cannot redisplay the number', async ({ page }) => {
    let reads = 0;
    let release: (() => void) | undefined;
    const delayed = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: sessions.ADMIN }));
    await page.route('**/api/account/profile', async (route) => {
      reads++;
      if (reads === 2) await delayed;
      return route.fulfill({ json: makeMockProfile() });
    });
    await page.goto('/ho-so');
    await page.getByRole('button', { name: 'Hiện đầy đủ số tài khoản ngân hàng' }).click();
    await expect.poll(() => reads).toBe(2);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    release?.();
    await expect(
      page.getByRole('button', { name: 'Hiện đầy đủ số tài khoản ngân hàng' }),
    ).toBeEnabled();
    await expect(page.getByText('123456789012', { exact: true })).toHaveCount(0);
  });

  test('Desktop has two form columns and active navigation follows the selected section', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1440, height: 950 });
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: sessions.CUSTOMER }));
    await page.route('**/api/account/profile', (route) =>
      route.fulfill({ json: makeMockProfile() }),
    );
    await page.goto('/ho-so');
    const name = await page.getByLabel('Họ và tên *').boundingBox();
    const phone = await page.getByLabel('Số điện thoại', { exact: true }).boundingBox();
    expect(name && phone && Math.abs(name.y - phone.y) < 2 && phone.x > name.x).toBeTruthy();
    const navigation = page.getByRole('navigation', { name: 'Mục hồ sơ' });
    await navigation.getByRole('link', { name: 'Bảo mật', exact: true }).click();
    await expect(navigation.getByRole('link', { name: 'Bảo mật', exact: true })).toHaveAttribute(
      'aria-current',
      'location',
    );
    const navBox = await navigation.boundingBox();
    expect(navBox && navBox.y >= 60 && navBox.y < 180).toBeTruthy();
    await page.setViewportSize({ width: 390, height: 850 });
    await navigation.getByRole('link', { name: 'Thông tin cá nhân', exact: true }).click();
    const mobileName = await page.getByLabel('Họ và tên *').boundingBox();
    const mobilePhone = await page.getByLabel('Số điện thoại', { exact: true }).boundingBox();
    expect(
      mobileName && mobilePhone && mobilePhone.y > mobileName.y + mobileName.height,
    ).toBeTruthy();
  });

  test('Password visibility toggles each field without changing its value or sending a request', async ({
    page,
  }) => {
    let passwordWrites = 0;
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: sessions.CUSTOMER }));
    await page.route('**/api/account/profile', (route) =>
      route.fulfill({ json: makeMockProfile() }),
    );
    await page.route('**/api/member/password', (route) => {
      passwordWrites++;
      return route.fulfill({ status: 204 });
    });
    await page.goto('/ho-so#security');
    const field = page.getByLabel('Mật khẩu hiện tại', { exact: true });
    await field.fill('DraftOnly@1234');
    await page.getByRole('button', { name: 'Hiện mật khẩu hiện tại', exact: true }).click();
    await expect(field).toHaveAttribute('type', 'text');
    await expect(field).toHaveValue('DraftOnly@1234');
    await expect(page.getByLabel('Mật khẩu mới', { exact: true })).toHaveAttribute(
      'type',
      'password',
    );
    await page.getByRole('button', { name: 'Ẩn mật khẩu hiện tại', exact: true }).click();
    await expect(field).toHaveAttribute('type', 'password');
    expect(passwordWrites).toBe(0);
  });

  test('Unsaved draft warns before navigation, supports staying and leaving', async ({ page }) => {
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: sessions.CUSTOMER }));
    await page.route('**/api/account/profile', (route) =>
      route.fulfill({ json: makeMockProfile() }),
    );
    await page.goto('/ho-so');
    await page.getByLabel('Họ và tên *').fill('Bản nháp chưa lưu');
    await page.getByRole('link', { name: 'Khu vực cá nhân', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Bạn có thay đổi chưa lưu' });
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: 'Tiếp tục chỉnh sửa', exact: true }).click();
    await expect(page.getByLabel('Họ và tên *')).toHaveValue('Bản nháp chưa lưu');
    await page.getByRole('link', { name: 'Khu vực cá nhân', exact: true }).click();
    await dialog.getByRole('button', { name: 'Rời trang', exact: true }).click();
    await expect(page).toHaveURL(/\/tai-khoan$/);
  });

  test('Reload warns about an unsaved draft and cancelling keeps the entered value', async ({
    page,
  }) => {
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: sessions.CUSTOMER }));
    await page.route('**/api/account/profile', (route) =>
      route.fulfill({ json: makeMockProfile() }),
    );
    await page.goto('/ho-so');
    const input = page.getByLabel('Họ và tên *');
    await input.click();
    await input.fill('Bản nháp giữ khi tải lại');
    const nativePrompt = page.waitForEvent('dialog');
    const reload = page.reload({ waitUntil: 'commit', timeout: 3000 }).catch(() => null);
    const dialog = await nativePrompt;
    expect(dialog.type()).toBe('beforeunload');
    await dialog.dismiss();
    await reload;
    // A cancelled native reload has no new navigation commit. Read the retained document.
    expect(
      await page.evaluate(
        () => document.querySelector<HTMLInputElement>('#profile-full-name')?.value,
      ),
    ).toBe('Bản nháp giữ khi tải lại');
  });

  test('Cancel draft removes the navigation warning and logout is guarded while dirty', async ({
    page,
  }) => {
    let logoutCalls = 0;
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: sessions.CUSTOMER }));
    await page.route('**/api/account/profile', (route) =>
      route.fulfill({ json: makeMockProfile() }),
    );
    await page.route('**/api/auth/logout', (route) => {
      logoutCalls++;
      return route.fulfill({ status: 204 });
    });
    await page.goto('/ho-so');
    await page.getByLabel('Họ và tên *').fill('Bản nháp');
    await page
      .getByRole('button', { name: `Mở menu người dùng của ${sessions.CUSTOMER.name}` })
      .click();
    await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
    await expect(page.getByRole('dialog', { name: 'Bạn có thay đổi chưa lưu' })).toBeVisible();
    expect(logoutCalls).toBe(0);
    await page.getByRole('button', { name: 'Tiếp tục chỉnh sửa', exact: true }).click();
    await page.getByRole('button', { name: 'Hủy thay đổi', exact: true }).click();
    await page.getByRole('link', { name: 'Khu vực cá nhân', exact: true }).click();
    await expect(page).toHaveURL(/\/tai-khoan$/);
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  for (const width of [320, 390, 1440]) {
    test(`Personal profile page responsive reflow and accessibility at ${width}px`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 950 });
      await page.route('**/api/auth/me', (route) => route.fulfill({ json: sessions.ADMIN }));
      await page.route('**/api/account/profile', (route) =>
        route.fulfill({ json: makeMockProfile() }),
      );

      await page.goto('/ho-so');
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();

      // Check horizontal overflow
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
        true,
      );

      // Check WCAG accessibility
      const axeResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(axeResults.violations).toEqual([]);
    });
  }

  test('Seller keeps personal actions in the avatar menu and out of the workspace sidebar', async ({
    page,
  }) => {
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: sessions.SELLER }));
    await page.route('**/api/account/profile', (route) =>
      route.fulfill({
        json: makeMockProfile({
          id: sessions.SELLER.id,
          fullName: sessions.SELLER.name,
          loginEmail: 'seller@florabot.vn',
        }),
      }),
    );
    await page.route('**/api/seller/**', (route) =>
      route.fulfill({ json: { items: [], total: 0 } }),
    );

    await page.goto('/seller');
    await expect(
      page.getByRole('banner').getByRole('link', { name: 'FloraBot — trang chủ' }),
    ).toHaveAttribute('href', '/');
    const navigation = page.getByRole('navigation', { name: 'Điều hướng quản lý' });
    await expect(navigation.getByRole('link', { name: 'Hoạt động mua hoa' })).toHaveCount(0);
    await expect(navigation.getByRole('link', { name: 'Hồ sơ cá nhân' })).toHaveCount(0);
    await expect(navigation.getByRole('link', { name: 'Về trang chủ' })).toHaveCount(0);

    await page
      .getByRole('button', { name: `Mở menu người dùng của ${sessions.SELLER.name}` })
      .click();
    const personalLinks = page.locator('#workspace-user-menu');

    const buyPersonal = personalLinks.getByRole('link', { name: 'Hoạt động mua hoa' });
    await expect(buyPersonal).toBeVisible();
    await expect(buyPersonal).toHaveAttribute('href', '/tai-khoan');

    const profileLink = personalLinks.getByRole('link', { name: 'Hồ sơ cá nhân' });
    await expect(profileLink).toBeVisible();
    await expect(profileLink).toHaveAttribute('href', '/ho-so');
    await expect(personalLinks.getByRole('link', { name: 'Về trang chủ' })).toHaveCount(0);
  });
});

import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

test.describe('Public Navigation and Footer Overhaul', () => {
  test('Navbar items are strictly streamlined and do not include removed items', async ({
    page,
  }) => {
    await page.goto('/');
    const header = page.getByRole('banner');

    // Expected public navbar items
    await expect(header.getByRole('link', { name: 'Trang chủ', exact: true })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Sản phẩm hoa', exact: true })).toBeVisible();
    await expect(
      header.getByRole('link', { name: 'Cách đặt & nhận hoa', exact: true }),
    ).toBeVisible();
    await expect(header.getByRole('link', { name: 'Vị trí tủ', exact: true })).toBeVisible();
    await expect(header.getByRole('link', { name: 'Đăng nhập', exact: true })).toBeVisible();

    // Verify removed items are NOT present in the navbar
    await expect(header.getByRole('link', { name: 'Về chúng tôi' })).toHaveCount(0);
    await expect(header.getByRole('link', { name: 'Liên hệ' })).toHaveCount(0);
    await expect(header.getByRole('link', { name: 'Hồ sơ cá nhân' })).toHaveCount(0);

    // Verify "Vị trí tủ" route links to /tim-kiosk, not / or /#vi-tri
    const kioskLink = header.getByRole('link', { name: 'Vị trí tủ', exact: true });
    await expect(kioskLink).toHaveAttribute('href', '/tim-kiosk');
    await kioskLink.click();
    await expect(page).toHaveURL('/tim-kiosk');
  });

  test('Footer contains organized columns with Về FloraBot and Liên hệ & hỗ trợ', async ({
    page,
  }) => {
    await page.goto('/');
    const footer = page.getByRole('contentinfo');

    // Verify key destinations in footer
    const aboutLink = footer.getByRole('link', { name: 'Về FloraBot', exact: true });
    await expect(aboutLink).toBeVisible();
    await expect(aboutLink).toHaveAttribute('href', '/ve-florabot');

    const contactLink = footer.getByRole('link', { name: 'Liên hệ & hỗ trợ', exact: true });
    await expect(contactLink).toBeVisible();
    await expect(contactLink).toHaveAttribute('href', '/lien-he');

    const privacyLink = footer.getByRole('link', { name: 'Chính sách riêng tư', exact: true });
    await expect(privacyLink).toBeVisible();
    await expect(privacyLink).toHaveAttribute('href', '/chinh-sach-rieng-tu');

    // Navigate to /ve-florabot
    await aboutLink.click();
    await expect(page).toHaveURL('/ve-florabot');

    // Navigate to /lien-he
    const footerOnAbout = page.getByRole('contentinfo');
    await footerOnAbout.getByRole('link', { name: 'Liên hệ & hỗ trợ', exact: true }).click();
    await expect(page).toHaveURL('/lien-he');
  });
});

test.describe('Account / Profile Page Redesign', () => {
  const memberSession = {
    id: '10000000-0000-0000-0000-000000000001',
    name: 'Nguyễn Mai Anh',
    email: 'maianh@example.com',
    role: 'CUSTOMER',
    sellerId: null,
    sellerStatus: null,
    packageExpiresAt: null,
  };

  test.beforeEach(async ({ page }) => {
    await page.route('**/api/auth/me', (route) => route.fulfill({ json: memberSession }));
    await page.route('**/api/member/profile', (route) =>
      route.fulfill({
        json: {
          id: memberSession.id,
          fullName: 'Nguyễn Mai Anh',
          email: 'maianh@example.com',
          loyaltyPoints: 35000,
        },
      }),
    );
    await page.route('**/api/member/history?*', (route) =>
      route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
    );
    await page.route('**/api/member/preorders?*', (route) =>
      route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
    );
    await page.route('**/api/member/chats?*', (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: 'chat-001',
              otherPartyName: 'Tiệm Hoa Nắng Mai',
              lastMessage: 'Shop đã nhận yêu cầu của bạn',
              lastMessageAt: new Date().toISOString(),
              createdAt: new Date().toISOString(),
              unreadCount: 2,
            },
          ],
          page: 1,
          hasMore: false,
        },
      }),
    );
    await page.route('**/api/member/chats/*/messages*', (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: 'msg-001',
              senderName: 'Tiệm Hoa Nắng Mai',
              isMine: false,
              content: 'Shop đã nhận yêu cầu của bạn',
              createdAt: new Date().toISOString(),
              imageUrl: null,
            },
          ],
          page: 1,
          hasMore: false,
        },
      }),
    );
    await page.route('**/hub/chat/**', (route) => route.fulfill({ status: 200, json: {} }));
  });

  test('Account header renders user details and navigation tabs switch panels with hash sync', async ({
    page,
  }) => {
    await page.goto('/tai-khoan');

    // Header info
    const hero = page.locator('.account-hero-card');
    await expect(hero).toBeVisible();
    await expect(hero.getByRole('heading', { name: 'Góc nhỏ của Nguyễn Mai Anh' })).toBeVisible();
    await expect(hero.getByText('maianh@example.com')).toBeVisible();
    await expect(page.locator('.overview-stat-value').filter({ hasText: '35.000' })).toBeVisible();

    await expect(hero.getByRole('link', { name: 'Chỉnh sửa hồ sơ' })).toHaveCount(0);

    // Tab navigation is visible
    const nav = page.getByRole('navigation', { name: 'Trong tài khoản' });
    await expect(nav).toBeVisible();

    // Verify "Hồ sơ cá nhân" and "Bảo mật" are not present in member tabs
    await expect(nav.getByRole('link', { name: /Hồ sơ cá nhân/ })).toHaveCount(0);
    await expect(nav.getByRole('link', { name: /Bảo mật/ })).toHaveCount(0);

    // Unread badge on chat tab
    await expect(nav.getByRole('link', { name: /Tin nhắn/ })).toContainText('2');

    // Click "Đơn đặt trước" tab
    await nav.getByRole('link', { name: /Đơn đặt trước/ }).click();
    await expect(page).toHaveURL(/#web-orders/);
    await expect(page.locator('#web-orders')).toBeVisible();

    // Click "Lịch sử mua" tab
    await nav.getByRole('link', { name: /Lịch sử mua/ }).click();
    await expect(page).toHaveURL(/#member-orders/);
    await expect(page.locator('#member-orders')).toBeVisible();

    // Click "Tin nhắn" tab
    await nav.getByRole('link', { name: /Tin nhắn/ }).click();
    await expect(page).toHaveURL(/#member-chats/);
    await expect(page.locator('#member-chats')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Tiệm Hoa Nắng Mai' })).toBeVisible();
  });

  test('Password change form validates and shows error on blur and submit', async ({ page }) => {
    await page.route('**/api/account/profile', (route) =>
      route.fulfill({
        json: {
          id: memberSession.id,
          fullName: 'Nguyễn Mai Anh',
          loginEmail: 'maianh@example.com',
          phone: '0901234567',
          address: '123 Đường Hoa',
          contactEmail: 'maianh@example.com',
          contactEmailIsDefault: true,
          contactEmailVerified: false,
          bank: { hasAccount: false },
        },
      }),
    );

    await page.goto('/ho-so#security');
    await expect(page.locator('#security')).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Mục hồ sơ' }).getByRole('link', { name: 'Bảo mật' }),
    ).toHaveAttribute('href', '#security');

    const currentPwd = page.getByLabel('Mật khẩu hiện tại');
    const newPwd = page.getByLabel('Mật khẩu mới', { exact: true });
    const confirmPwd = page.getByLabel('Nhập lại mật khẩu mới');

    // Trigger blur validation
    await currentPwd.focus();
    await newPwd.focus();
    await currentPwd.focus();

    // Submit with empty fields
    await page.getByRole('button', { name: 'Đổi mật khẩu và đăng nhập lại', exact: true }).click();
    await expect(page.getByText('Nhập mật khẩu.').first()).toBeVisible();

    // Fill mismatched new password with insufficient length (< 12)
    await currentPwd.fill('OldPassword123!');
    await newPwd.fill('Short1');
    await confirmPwd.fill('Mismatch999!');
    await page.getByRole('button', { name: 'Đổi mật khẩu và đăng nhập lại', exact: true }).click();

    await expect(page.getByText('Dùng ít nhất 12 ký tự cho mật khẩu.')).toBeVisible();
  });

  test('Successful password change posts the expected payload and returns to login', async ({
    page,
  }) => {
    await page.route('**/api/account/profile', (route) =>
      route.fulfill({
        json: {
          id: memberSession.id,
          fullName: 'Nguyễn Mai Anh',
          loginEmail: 'maianh@example.com',
          phone: '0901234567',
          address: '123 Đường Hoa',
          contactEmail: 'maianh@example.com',
          contactEmailIsDefault: true,
          contactEmailVerified: false,
          bank: { hasAccount: false },
        },
      }),
    );

    let passwordPayload: unknown;
    await page.route('**/api/member/password', async (route) => {
      passwordPayload = route.request().postDataJSON();
      await route.fulfill({ status: 204 });
    });

    await page.goto('/ho-so#security');
    await page.getByLabel('Mật khẩu hiện tại').fill('OldPassword123!');
    await page.getByLabel('Mật khẩu mới', { exact: true }).fill('NewPassword456!');
    await page.getByLabel('Nhập lại mật khẩu mới').fill('NewPassword456!');
    await page.getByRole('button', { name: 'Đổi mật khẩu và đăng nhập lại', exact: true }).click();

    await expect(page).toHaveURL(/\/dang-nhap$/);
    expect(passwordPayload).toEqual({
      currentPassword: 'OldPassword123!',
      newPassword: 'NewPassword456!',
    });
  });
});

test.describe('Flower Catalog (/dat-hoa) Redesign & Chat Integration', () => {
  test('Catalog renders mock products with search, filters and order action', async ({ page }) => {
    // Visit catalog with demo mode enabled
    await page.goto('/dat-hoa?demo=1');

    // Header and search
    await expect(
      page.getByRole('heading', { name: 'Chọn hoa cho một dịp thật riêng.' }),
    ).toBeVisible();
    const searchInput = page.getByLabel('Tìm mẫu hoa, shop hoặc tủ nhận');
    await expect(searchInput).toBeVisible();

    // Verify 12 cards are loaded
    const cards = page.locator('.flower-card');
    await expect(cards).toHaveCount(12);

    // Filter by search query
    await searchInput.fill('Hướng Dương');
    await page.getByRole('button', { name: 'Tìm hoa' }).click();
    await expect(page.locator('.flower-card')).toHaveCount(1);
    await expect(page.getByText('Bó Hướng Dương Rạng Rỡ')).toBeVisible();

    // Clear filter
    await page.getByRole('button', { name: 'Đặt lại bộ lọc' }).click();
    await expect(page.locator('.flower-card')).toHaveCount(12);

    // Cards order directly, without a product detail modal.
    await page
      .locator('.flower-card')
      .first()
      .getByRole('button', { name: 'Đặt hoa', exact: true })
      .click();
    await expect(page.locator('.flower-request')).toBeVisible();
    await expect(page.getByRole('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Đóng mẫu đang chọn' }).click();
    await expect(page.locator('.flower-request')).toHaveCount(0);
  });

  test('Clicking Nhắn tin với shop when not logged in redirects to login with returnUrl', async ({
    page,
  }) => {
    await page.route('**/api/auth/me', (route) => route.fulfill({ status: 401, json: {} }));
    await page.route('**/api/shop/catalog?*', (route) =>
      route.fulfill({
        json: {
          items: [
            {
              productId: '30000000-0000-0000-0000-000000000001',
              sellerId: '20000000-0000-0000-0000-000000000001',
              shopName: 'Tiệm Hoa Nắng Mai',
              name: 'Bó Hoa Cúc Họa Mi',
              description: 'Hoa tươi trong ngày',
              price: 250000,
              kioskId: '40000000-0000-0000-0000-000000000001',
              kioskName: 'Kiosk NVH Thanh Niên',
              address: '4 Phạm Ngọc Thạch',
              photo: null,
              bouquets: [],
            },
          ],
          page: 1,
          hasMore: false,
        },
      }),
    );
    await page.goto('/dat-hoa');

    await page
      .locator('.flower-card')
      .first()
      .getByRole('button', { name: 'Nhắn tin với shop' })
      .click();
    await expect(page).toHaveURL(/\/dang-nhap\?returnUrl=%2Fdat-hoa/);
  });

  test('Clicking Nhắn tin với shop when logged in as CUSTOMER opens conversation via API', async ({
    page,
  }) => {
    let chatOpenedPayload: { sellerId: string; productId: string } | null = null;
    await page.route('**/api/shop/catalog?*', (route) =>
      route.fulfill({
        json: {
          items: [
            {
              productId: '30000000-0000-0000-0000-000000000001',
              sellerId: '20000000-0000-0000-0000-000000000001',
              shopName: 'Tiệm Hoa Nắng Mai',
              name: 'Bó Hoa Cúc Họa Mi',
              description: 'Hoa tươi trong ngày',
              price: 250000,
              kioskId: '40000000-0000-0000-0000-000000000001',
              kioskName: 'Kiosk NVH Thanh Niên',
              address: '4 Phạm Ngọc Thạch',
              photo: null,
              bouquets: [],
            },
          ],
          page: 1,
          hasMore: false,
        },
      }),
    );
    await page.route('**/api/auth/me', (route) =>
      route.fulfill({ json: { id: 'user-01', name: 'Khách hàng', role: 'CUSTOMER' } }),
    );
    await page.route('**/api/member/profile', (route) =>
      route.fulfill({ json: { id: 'user-01', fullName: 'Khách hàng', email: 'kh@example.com' } }),
    );
    await page.route('**/api/member/history?*', (route) =>
      route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
    );
    await page.route('**/api/member/preorders?*', (route) =>
      route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
    );
    await page.route('**/api/member/chats/open', async (route) => {
      chatOpenedPayload = route.request().postDataJSON();
      return route.fulfill({
        json: {
          id: 'conv-999',
          sellerId: chatOpenedPayload?.sellerId,
          sellerShopName: 'Tiệm Hoa Nắng Mai',
          unreadCount: 0,
        },
      });
    });
    await page.route('**/api/member/chats?*', (route) =>
      route.fulfill({
        json: {
          items: [
            {
              id: 'conv-999',
              sellerId: 'seller-demo-01',
              sellerShopName: 'Tiệm Hoa Nắng Mai',
              lastMessagePreview: 'Xin chào!',
              lastMessageAt: new Date().toISOString(),
              unreadCount: 0,
            },
          ],
          page: 1,
          hasMore: false,
        },
      }),
    );
    await page.route('**/api/member/chats/conv-999/messages*', (route) =>
      route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
    );

    await page.goto('/dat-hoa');

    // Click chat on the first product card
    await page
      .locator('.flower-card')
      .first()
      .getByRole('button', { name: 'Nhắn tin với shop' })
      .click();

    // Verify API called with sellerId and productId
    expect(chatOpenedPayload).not.toBeNull();
    expect(chatOpenedPayload!.sellerId).toBeTruthy();
    expect(chatOpenedPayload!.productId).toBeTruthy();

    // Verify navigated to /tai-khoan with chat query and hash
    await expect(page).toHaveURL(/\/tai-khoan\?chat=conv-999#member-chats/);
  });
});

test.describe('Guide Page (/huong-dan-dat-hoa) and Contact (/lien-he) Overhaul', () => {
  test('Guide page renders both accessible purchase flows and comparison cards', async ({
    page,
  }) => {
    await page.goto('/huong-dan-dat-hoa');

    await expect(page.getByText('Biên nhận điện tử', { exact: true })).toHaveCount(0);
    await expect(
      page.getByRole('heading', { name: 'Đặt mẫu riêng để shop chuẩn bị' }),
    ).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Mua có sẵn tại tủ' })).toBeVisible();

    const availableTab = page.getByRole('tab', { name: 'Mua có sẵn' });
    const customTab = page.getByRole('tab', { name: 'Đặt mẫu riêng' });
    await expect(availableTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Chọn hoa & kiosk' })).toBeVisible();

    await customTab.click();
    await expect(customTab).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('heading', { name: 'Gửi yêu cầu' })).toBeVisible();

    await page.keyboard.press('ArrowLeft');
    await expect(availableTab).toHaveAttribute('aria-selected', 'true');
    await expect(availableTab).toBeFocused();

    await expect(page.getByRole('link', { name: 'Chọn hoa ngay', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tìm kiosk', exact: true })).toBeVisible();
  });

  test('Contact page renders support cards with appropriate destinations', async ({ page }) => {
    await page.goto('/lien-he');

    await expect(page.getByRole('heading', { name: 'Bạn cần hỗ trợ điều gì?' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mở đơn đặt trước', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Tra cứu biên nhận', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Xem gói thuê kiosk', exact: true })).toBeVisible();
  });

  test('Accessibility and responsive checks on marketing pages', async ({ page }) => {
    for (const route of ['/huong-dan-dat-hoa', '/lien-he']) {
      await page.goto(route);
      // Horizontal overflow check
      const hasOverflow = await page.evaluate(
        () => document.documentElement.scrollWidth > window.innerWidth,
      );
      expect(hasOverflow).toBe(false);

      // WCAG Accessibility check
      const axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
        .analyze();
      expect(axe.violations).toEqual([]);
    }
  });

  test('True 200% zoom and reflow audit on catalog, account, guide, and contact pages', async ({
    page,
  }) => {
    test.slow();

    await page.route('**/api/auth/me', (route) =>
      route.fulfill({
        json: {
          id: '10000000-0000-0000-0000-000000000001',
          name: 'Nguyễn Văn An',
          email: 'customer@example.com',
          role: 'CUSTOMER',
        },
      }),
    );
    await page.route('**/api/member/profile', (route) =>
      route.fulfill({
        json: {
          id: '10000000-0000-0000-0000-000000000001',
          fullName: 'Nguyễn Văn An',
          email: 'customer@example.com',
          loyaltyPoints: 10,
        },
      }),
    );
    await page.route('**/api/member/history?*', (route) =>
      route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
    );
    await page.route('**/api/member/preorders?*', (route) =>
      route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
    );
    await page.route('**/api/member/chats?*', (route) =>
      route.fulfill({ json: { items: [], page: 1, hasMore: false } }),
    );
    await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));

    const routes = ['/dat-hoa?demo=true', '/huong-dan-dat-hoa', '/lien-he', '/tai-khoan'];

    for (const route of routes) {
      for (const width of [1280, 768, 390]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto(route);
        await page.evaluate(() => document.fonts.ready);
        // Apply 200% font resize (:root 32px)
        await page.addStyleTag({ content: ':root { font-size: 32px !important; }' });
        const hasOverflow = await page.evaluate(
          () => document.documentElement.scrollWidth > window.innerWidth,
        );
        expect(hasOverflow).toBe(false);
      }
    }
  });
});

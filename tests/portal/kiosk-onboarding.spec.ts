import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const packagesMock = [
  {
    id: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
    name: 'Trial',
    annualFee: 10000,
    walkInSlots: 1,
    preorderSlots: 1,
    totalSlots: 2,
    termMonths: 12,
    status: 'ACTIVE',
    description: 'Gói trải nghiệm 1 năm: 1 ô vãng lai (Walk-in) + 1 ô đặt trước (Pre-order)',
  },
  {
    id: '4fa85f64-5717-4562-b3fc-2c963f66afa7',
    name: 'Pro',
    annualFee: 15000,
    walkInSlots: 4,
    preorderSlots: 4,
    totalSlots: 8,
    termMonths: 12,
    status: 'ACTIVE',
    description: 'Gói chuyên nghiệp 1 năm: 4 ô vãng lai (Walk-in) + 4 ô đặt trước (Pre-order)',
  },
  {
    id: '5fa85f64-5717-4562-b3fc-2c963f66afa8',
    name: 'Max',
    annualFee: 20000,
    walkInSlots: 6,
    preorderSlots: 6,
    totalSlots: 12,
    termMonths: 12,
    status: 'ACTIVE',
    description: 'Gói tối đa 1 năm: 6 ô vãng lai (Walk-in) + 6 ô đặt trước (Pre-order)',
  },
];

test.describe('Annual Kiosk Onboarding Workflow Tests', () => {
  test('Customer application: package catalog, Goong address suggestions, GPS overlay, coordinate validation, submit, and status timeline', async ({
    page,
  }) => {
    let currentApp: Record<string, unknown> | null = null;
    let paymentLinkAttempts = 0;
    let submittedPayload: Record<string, unknown> | null = null;
    let autocompleteMode: 'ok' | 'empty' | 'error' = 'ok';
    let autocompleteDelayMs = 0;

    await page.route(/rsapi\.goong\.io\/Place\/AutoComplete/, async (route) => {
      if (autocompleteDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, autocompleteDelayMs));
      }
      if (autocompleteMode === 'error') {
        return route.fulfill({ status: 500, json: { status: 'UNKNOWN_ERROR' } });
      }
      if (autocompleteMode === 'empty') {
        return route.fulfill({ status: 200, json: { status: 'ZERO_RESULTS', predictions: [] } });
      }
      return route.fulfill({
        status: 200,
        json: {
          status: 'OK',
          predictions: [
            {
              place_id: 'goong-place-1',
              description: '123 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM',
              structured_formatting: {
                main_text: '123 Nguyễn Huệ',
                secondary_text: 'Bến Nghé, Quận 1, TP.HCM',
              },
            },
            {
              place_id: 'goong-place-2',
              description: '125 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM',
              structured_formatting: {
                main_text: '125 Nguyễn Huệ',
                secondary_text: 'Bến Nghé, Quận 1, TP.HCM',
              },
            },
          ],
        },
      });
    });

    await page.route(/rsapi\.goong\.io\/Place\/Detail/, async (route) => {
      const placeId = new URL(route.request().url()).searchParams.get('place_id');
      if (placeId === 'goong-place-2') {
        return route.fulfill({
          status: 200,
          json: {
            status: 'OK',
            result: {
              place_id: 'goong-place-2',
              name: '125 Nguyễn Huệ',
              formatted_address: '125 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM',
              geometry: { location: { lat: 10.775123, lng: 106.701456 } },
            },
          },
        });
      }
      return route.fulfill({
        status: 200,
        json: {
          status: 'OK',
          result: {
            place_id: 'goong-place-1',
            name: '123 Nguyễn Huệ',
            formatted_address: '123 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM',
            geometry: { location: { lat: 10.776889, lng: 106.700806 } },
          },
        },
      });
    });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;

      if (path === '/api/auth/me') {
        return route.fulfill({
          json: {
            id: 'cust-101',
            name: 'Lan Vy',
            role: 'CUSTOMER',
            sellerId: null,
            sellerStatus: null,
            packageExpiresAt: null,
          },
        });
      }

      if (path === '/api/kiosk-packages') {
        return route.fulfill({ json: packagesMock });
      }

      if (path === '/api/member/kiosk-applications/current') {
        if (!currentApp) {
          return route.fulfill({ status: 404, json: { detail: 'Không tìm thấy hồ sơ' } });
        }
        return route.fulfill({ json: currentApp });
      }

      if (path === '/api/member/kiosk-applications' && route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        submittedPayload = body;
        currentApp = {
          id: 'app-999',
          customerId: 'cust-101',
          packageId: body.packageId,
          packageName: 'Trial',
          annualFee: 10000,
          walkInSlots: 1,
          preorderSlots: 1,
          totalSlots: 2,
          shopName: body.shopName,
          phone: body.phone,
          contactEmail: body.contactEmail,
          installationAddress: body.installationAddress,
          latitude: body.latitude,
          longitude: body.longitude,
          bankName: body.bankName,
          bankHolder: body.bankHolder,
          bankAccountSuffix: body.bankAccountNumber.slice(-4),
          status: 'AWAITING_PAYMENT',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          paymentStatus: 'PENDING',
          canVoluntaryCancel: true,
        };
        return route.fulfill({ status: 201, json: currentApp });
      }

      if (path.endsWith('/payment-link') && route.request().method() === 'POST') {
        paymentLinkAttempts++;
        if (paymentLinkAttempts === 1) {
          return route.fulfill({
            status: 503,
            json: { detail: 'Cổng thanh toán payOS đang bảo trì (503)' },
          });
        }
        return route.fulfill({
          json: {
            orderCode: 888123,
            amount: 10000,
            checkoutUrl: 'https://pay.payos.vn/web/demo888123',
          },
        });
      }

      if (path.endsWith('/reconcile') && route.request().method() === 'POST') {
        if (currentApp) {
          currentApp = {
            ...currentApp,
            status: 'PAID_REVIEW',
            paymentStatus: 'PAID',
          };
        }
        return route.fulfill({ json: currentApp });
      }

      if (path.endsWith('/cancel') && route.request().method() === 'POST') {
        if (currentApp) {
          currentApp = {
            ...currentApp,
            status: currentApp.status === 'PAID_REVIEW' ? 'REFUND_PENDING' : 'CANCELLED',
            canVoluntaryCancel: false,
          };
        }
        return route.fulfill({ json: currentApp });
      }

      return route.fulfill({ json: [] });
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/thue-kiosk');

    // Verify Packages rendered
    await expect(page.getByText('Trial')).toBeVisible();
    await expect(page.getByText('10.000')).toBeVisible();
    await expect(page.getByText('Pro')).toBeVisible();
    await expect(page.getByText('Max')).toBeVisible();

    // Accessibility check on catalog & form
    const a11yResult = await new AxeBuilder({ page })
      .include('.kiosk-onboarding-container')
      .withTags(['wcag2a', 'wcag2aa'])
      .disableRules(['color-contrast'])
      .analyze();
    expect(a11yResult.violations).toEqual([]);

    // Select Trial package
    await page.getByText('Trial').click();

    // Verify manual Latitude & Longitude inputs are removed from UI
    await expect(page.getByLabel('Vĩ độ (Latitude)')).toHaveCount(0);
    await expect(page.getByLabel('Kinh độ (Longitude)')).toHaveCount(0);

    await page.getByLabel('Tên shop hoa').fill('Tiệm Hoa Xinh');
    await page.getByLabel('Số điện thoại kinh doanh').fill('0901234567');
    await page.getByLabel('Email liên hệ công việc').fill('contact@tiemhoaxinh.vn');
    await page.getByLabel('Tên ngân hàng').fill('Vietcombank');
    await page.getByLabel('Tên chủ tài khoản').fill('NGUYEN VAN A');
    await page.getByLabel('Số tài khoản ngân hàng').fill('0071001234567');

    const addressInput = page.getByRole('combobox', { name: /Địa chỉ lắp đặt cụ thể/ });
    const mapRegion = page.getByRole('region', { name: 'Bản đồ chọn tọa độ lắp đặt kiosk' });

    // 1. Loading & Error states on Goong Autocomplete
    autocompleteMode = 'error';
    autocompleteDelayMs = 150;
    await addressInput.fill('123 Nguyễn');
    await expect(page.getByText('Đang tìm địa chỉ gợi ý...')).toBeVisible();
    await expect(page.getByText('Không thể tải gợi ý địa chỉ lúc này.')).toBeVisible();

    // 2. Empty (no-result) state
    autocompleteMode = 'empty';
    autocompleteDelayMs = 0;
    await addressInput.fill('Địa chỉ không tồn tại xyz');
    await expect(
      page.getByText('Không tìm thấy địa chỉ phù hợp. Vui lòng thử từ khóa chi tiết hơn.'),
    ).toBeVisible();

    // Click submit with unselected address & blank coordinates
    await page.getByRole('button', { name: 'Nộp hồ sơ thuê kiosk' }).click();
    await expect(
      page.getByText('Vui lòng chọn một địa chỉ từ danh sách gợi ý của Goong.'),
    ).toBeVisible();
    await expect(page.getByText('ô trống không đồng nghĩa với 0')).toBeVisible();

    // 3. Keyboard navigation (ArrowDown, Escape, Enter) & Suggestion Selection
    autocompleteMode = 'ok';
    await addressInput.fill('123 Nguyễn Huệ');
    const listbox = page.getByRole('listbox', { name: 'Gợi ý địa chỉ Goong' });
    await expect(listbox).toBeVisible();

    await addressInput.press('Escape');
    await expect(listbox).toHaveCount(0);

    await addressInput.press('ArrowDown');
    await expect(listbox).toBeVisible();
    await addressInput.press('ArrowDown');
    await addressInput.press('Enter');

    await expect(addressInput).toHaveValue('125 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM');
    await expect(mapRegion).toHaveAttribute('data-has-pin', 'true');
    await expect(mapRegion).toHaveAttribute('data-pin-lat', '10.775123');
    await expect(mapRegion).toHaveAttribute('data-pin-lon', '106.701456');
    await expect(
      page.getByText('Đã chọn địa chỉ gợi ý và cập nhật ghim vị trí trên bản đồ.'),
    ).toBeVisible();

    // 4. Editing address after selecting suggestion clears coordinates & pin and requires re-selecting
    await addressInput.fill('123 Nguyễn Huệ sửa tay');
    await expect(mapRegion).toHaveAttribute('data-has-pin', 'false');
    await expect(
      page.getByText(
        'Bạn vừa chỉnh sửa địa chỉ. Vui lòng chọn lại một gợi ý từ danh sách để xác nhận tọa độ.',
      ),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Nộp hồ sơ thuê kiosk' }).click();
    await expect(
      page.getByText('Vui lòng chọn một địa chỉ từ danh sách gợi ý của Goong.'),
    ).toBeVisible();
    expect(submittedPayload).toBeNull();

    // Re-select first suggestion ("123 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM")
    await addressInput.fill('123 Nguyễn');
    await expect(listbox).toBeVisible();
    await listbox.getByRole('option').first().click();
    await expect(addressInput).toHaveValue('123 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM');
    await expect(mapRegion).toHaveAttribute('data-pin-lat', '10.776889');
    await expect(mapRegion).toHaveAttribute('data-pin-lon', '106.700806');

    // 5. Overlaid GPS button updates marker while keeping current selected address
    await page.context().grantPermissions(['geolocation']);
    await page.context().setGeolocation({ latitude: 10.779999, longitude: 106.699888 });
    const gpsBtn = page.getByRole('button', { name: 'Dùng vị trí hiện tại' });
    await expect(gpsBtn).toBeVisible();
    await gpsBtn.click();
    await expect(mapRegion).toHaveAttribute('data-pin-lat', '10.779999');
    await expect(mapRegion).toHaveAttribute('data-pin-lon', '106.699888');
    await expect(addressInput).toHaveValue('123 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM');
    await expect(
      page.getByText(
        'Đã cập nhật ghim bản đồ theo vị trí hiện tại. Địa chỉ đang chọn được giữ nguyên.',
      ),
    ).toBeVisible();

    // Check responsive layout has no horizontal overflow at 390px and 1280px
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.setViewportSize({ width: 1280, height: 900 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await expect(page.getByLabel('Vĩ độ (Latitude)')).toHaveCount(0);
    await expect(page.getByLabel('Kinh độ (Longitude)')).toHaveCount(0);

    // Submit form successfully
    await page.getByRole('button', { name: 'Nộp hồ sơ thuê kiosk' }).click();
    expect(submittedPayload).toMatchObject({
      installationAddress: '123 Nguyễn Huệ, Bến Nghé, Quận 1, TP.HCM',
      latitude: 10.779999,
      longitude: 106.699888,
    });

    // Verify Application Status Timeline rendered
    await expect(page.getByText('Hồ sơ thuê: Tiệm Hoa Xinh')).toBeVisible();
    await expect(page.getByText('Chờ thanh toán phí thuê')).toBeVisible();

    // Test Payment link 503 handling:
    await page.getByRole('button', { name: 'Tạo liên kết thanh toán payOS' }).click();
    await expect(page.getByText('Cổng thanh toán payOS đang bảo trì')).toBeVisible();

    // Retry Payment link -> returns valid https://pay.payos.vn link
    await page.getByRole('button', { name: 'Tạo liên kết thanh toán payOS' }).click();
    await expect(
      page.getByRole('link', { name: /Mở trang thanh toán pay\.payos\.vn/ }),
    ).toBeVisible();

    // Test Server Reconciliation:
    await page.getByRole('button', { name: 'Kiểm tra thanh toán (Đối soát máy chủ)' }).click();
    await expect(page.getByText('Đã thanh toán - Chờ duyệt')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Đã thanh toán thành công' })).toBeVisible();

    // Test Pre-confirmation voluntary cancellation:
    await page.getByRole('button', { name: 'Hủy hồ sơ' }).click();
    await page.getByPlaceholder(/Ví dụ: Thay đổi kế hoạch/).fill('Thay đổi kế hoạch mở điểm');
    await page.getByRole('button', { name: 'Xác nhận hủy' }).click();

    // Moves to REFUND_PENDING
    await expect(page.getByRole('heading', { name: 'Đang xử lý hoàn tiền' })).toBeVisible();
  });

  test('Operations Manager: view queue, confirm contact, schedule tech & enroll offline kiosk with once-only key, review evidence and handover', async ({
    page,
  }) => {
    let appStatus = 'PAID_REVIEW';
    let assignedKiosk: string | null = null;
    const enrolledKiosks = [
      {
        id: 'kiosk-01',
        code: 'K-HCM-01',
        name: 'Kiosk Quận 1',
        slotCount: 2,
        status: 'OFFLINE',
      },
    ];

    const currentAppDetail = () => ({
      application: {
        id: 'app-500',
        customerId: 'cust-200',
        packageId: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
        packageName: 'Trial',
        annualFee: 10000,
        totalSlots: 2,
        shopName: 'Hoa Tươi Sài Gòn',
        phone: '0909888777',
        contactEmail: 'contact@hoatuoisaigon.vn',
        installationAddress: '45 Lê Duẩn, Bến Nghé, Quận 1',
        latitude: 10.7812,
        longitude: 106.6983,
        bankName: 'MB Bank',
        bankHolder: 'TRAN VAN B',
        bankAccountSuffix: '9988',
        status: appStatus,
        createdAt: '2026-10-15T08:00:00Z',
        updatedAt: '2026-10-15T08:00:00Z',
        reviewNote: appStatus !== 'PAID_REVIEW' ? 'Đã gọi điện xác nhận vị trí mặt bằng' : null,
        assignedTechnicianName: 'Nguyễn Kỹ Thuật',
        assignedKioskCode: assignedKiosk,
        assignedKioskId: enrolledKiosks.find((kiosk) => kiosk.code === assignedKiosk)?.id ?? null,
        scheduledDate: '2026-10-18',
        timeWindow: '09:00 - 12:00',
        technicianReport:
          appStatus === 'AWAITING_HANDOVER' || appStatus === 'ACTIVE'
            ? 'Đã lắp đặt hoàn chỉnh, kết nối nguồn điện an toàn.'
            : null,
        canVoluntaryCancel: appStatus === 'PAID_REVIEW',
      },
      evidencePhotos: [
        {
          id: 'ev-1',
          url: '/api/operations/kiosk-applications/app-500/evidence/ev-1',
          reference: 'evidence:v1:photo-kiosk-front',
          createdAt: '2026-10-18T10:00:00Z',
        },
      ],
    });

    await page.route('**/api/**', async (route) => {
      const url = new URL(route.request().url());
      const path = url.pathname;

      if (path === '/api/auth/me') {
        return route.fulfill({
          json: {
            id: 'manager-01',
            name: 'Phan Quản Lý',
            role: 'OPERATIONS_MANAGER',
            sellerId: null,
            sellerStatus: null,
            packageExpiresAt: null,
          },
        });
      }

      if (path === '/api/operations/kiosk-applications') {
        return route.fulfill({
          json: {
            items: [currentAppDetail().application],
            page: 1,
            hasMore: false,
          },
        });
      }

      if (path === '/api/operations/kiosk-applications/app-500') {
        return route.fulfill({ json: currentAppDetail() });
      }

      if (path === '/api/operations/technicians') {
        return route.fulfill({
          json: [
            {
              id: 'tech-01',
              fullName: 'Nguyễn Kỹ Thuật',
              email: 'tech@florabot.vn',
              phone: '0912345678',
              status: 'ACTIVE',
              role: 'TECHNICIAN',
              createdAt: '2026-10-01T00:00:00Z',
            },
          ],
        });
      }

      if (path === '/api/operations/eligible-kiosks') {
        return route.fulfill({
          json: enrolledKiosks.filter((kiosk) => kiosk.code !== assignedKiosk),
        });
      }

      if (path === '/api/operations/kiosks/enroll' && route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        expect(body.slotCount).toBe(2);
        expect(body.mqttClientId).toBeNull();
        expect(body.slotCount).toBeLessThanOrEqual(50);
        expect(body).not.toHaveProperty('walkInSlots');
        expect(body).not.toHaveProperty('preorderSlots');
        const newKiosk = {
          id: 'kiosk-02',
          code: body.code,
          name: body.name,
          slotCount: body.slotCount,
          status: 'OFFLINE',
          apiKey: 'kiosk-device-api-key-xyz',
        };
        enrolledKiosks.push(newKiosk);
        return route.fulfill({ status: 201, json: newKiosk });
      }

      if (path.endsWith('/confirm') && route.request().method() === 'POST') {
        appStatus = 'CONFIRMED';
        return route.fulfill({ json: currentAppDetail().application });
      }

      if (path.endsWith('/schedule') && route.request().method() === 'POST') {
        expect(route.request().postDataJSON()).toEqual({
          technicianId: 'tech-01',
          kioskId: 'kiosk-01',
          scheduledDate: '2026-10-18',
          timeWindow: '09:00 - 12:00',
        });
        appStatus = 'SCHEDULED';
        assignedKiosk = 'K-HCM-01';
        return route.fulfill({ json: currentAppDetail().application });
      }

      if (path.endsWith('/handover') && route.request().method() === 'POST') {
        appStatus = 'ACTIVE';
        return route.fulfill({ json: currentAppDetail().application });
      }

      if (path.includes('/evidence/ev-1')) {
        return route.fulfill({
          contentType: 'image/png',
          body: Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'base64',
          ),
        });
      }

      return route.fulfill({ json: [] });
    });

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/operations/installations');

    await expect(page.getByText('Hoa Tươi Sài Gòn')).toBeVisible();
    // The deployed application DTO exposes totalSlots without a W/P breakdown.
    const applicationRow = page.getByRole('row').filter({ hasText: 'Hoa Tươi Sài Gòn' });
    await expect(applicationRow).toContainText('Tổng số ô: 2');
    await expect(applicationRow).not.toContainText('W +');
    await page.getByRole('button', { name: 'Chi tiết' }).click();

    // Verify detail panel
    await expect(page.getByText('Chi tiết: Hoa Tươi Sài Gòn')).toBeVisible();
    await expect(page.getByText('MB Bank - ****9988')).toBeVisible();
    const packageSummary = page
      .locator('.detail-info-grid > div')
      .filter({ hasText: 'Gói đăng ký' });
    await expect(packageSummary).toContainText('Tổng số ô: 2');
    await expect(packageSummary).not.toContainText('ô vãng lai');
    await expect(packageSummary).not.toContainText('ô đặt trước');

    // Step 1: Confirm contact note
    await page
      .getByLabel('Ghi chú xác nhận liên hệ (bắt buộc):')
      .fill('Đã gọi điện xác nhận vị trí mặt bằng');
    await page.getByRole('button', { name: /Xác nhận liên hệ/ }).click();
    await expect(page.getByText('Đã xác nhận liên hệ cho shop Hoa Tươi Sài Gòn')).toBeVisible();

    // Enroll a new Kiosk and verify once-only key delivery panel
    await page.getByRole('button', { name: '+ Thêm tủ mới (Asset Enrollment)' }).click();
    await page.getByLabel('Mã tủ (Code) *').fill('K-NEW-02');
    await page.getByLabel('Tên tủ *').fill('Kiosk Phú Nhuận');
    await page.getByLabel('Hardware ID (Serial) *').fill('ESP32-SN-998811');
    await page.getByRole('button', { name: 'Đăng ký thiết bị (OFFLINE)' }).click();

    // Verify Once-Only Provisioning Panel
    await expect(page.getByText('Cấu hình khóa thiết bị Kiosk (API Key)')).toBeVisible();
    await expect(page.locator('#device-api-key-input')).toHaveValue('kiosk-device-api-key-xyz');
    await page.getByRole('button', { name: 'Tôi đã sao chép khóa - Đóng bảng này' }).click();

    // OFFLINE kiosks with a matching slotCount are selectable before installation.
    await expect(
      page.getByRole('option', { name: 'K-HCM-01 - Kiosk Quận 1 (2 ô) [OFFLINE]', exact: true }),
    ).toHaveCount(1);

    // Step 2: Schedule Tech and Kiosk
    await page.getByLabel('Kỹ thuật viên phụ trách (ACTIVE):').selectOption('tech-01');
    await page.getByLabel('Tủ Kiosk cấp phát:').selectOption('kiosk-01');
    await page.getByLabel('Ngày dự kiến lắp đặt:').fill('2026-10-18');
    await page.getByRole('button', { name: /Lưu lịch & Phân công/ }).click();
    await expect(page.getByText('Đã phân công KTV và lên lịch')).toBeVisible();
    await expect(
      page.getByRole('option', { name: 'K-HCM-01 · Tủ đang phân công cho hồ sơ này' }),
    ).toHaveCount(1);

    // Advance to AWAITING_HANDOVER
    appStatus = 'AWAITING_HANDOVER';
    await page.getByRole('button', { name: 'Làm mới' }).click();

    // Step 3: Review Evidence & Handover
    await expect(page.getByText('Minh chứng #1')).toBeVisible();
    await expect(page.getByText('Đã lắp đặt hoàn chỉnh')).toBeVisible();
    await page.getByRole('button', { name: /Nghiệm thu Đạt & Bàn giao Kiosk/ }).click();
    await expect(page.getByText(/Đã nghiệm thu bàn giao và kích hoạt Chủ shop/)).toBeVisible();
  });

  test('Operations: ProvisionedKeyModal resets copySuccess and cleanly unmounts across open-copy-close-reopen cycle', async ({
    page,
    context,
  }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);

    let enrollCount = 0;
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me') {
        return route.fulfill({
          json: {
            id: 'manager-01',
            name: 'Phan Quản Lý',
            role: 'OPERATIONS_MANAGER',
            sellerId: null,
            sellerStatus: null,
            packageExpiresAt: null,
          },
        });
      }
      if (path === '/api/operations/kiosk-applications') {
        return route.fulfill({
          json: {
            items: [
              {
                id: 'app-501',
                packageId: 'pkg-1',
                shopName: 'Hoa Tươi Thử Nghiệm',
                packageName: 'Cơ bản',
                annualFee: 12000,
                walkInSlots: 2,
                preorderSlots: 4,
                totalSlots: 6,
                phone: '0901234567',
                contactName: 'Trần Văn A',
                contactPhone: '0901234567',
                contactEmail: 'shop@test.vn',
                installationAddress: '123 Lê Lợi',
                latitude: 10.77,
                longitude: 106.69,
                bankName: 'MB Bank',
                bankAccountSuffix: '1234',
                bankHolder: 'TRAN VAN A',
                status: 'CONFIRMED',
                assignedTechnicianId: null,
                assignedKioskId: null,
                scheduledDate: null,
                timeWindow: null,
                createdAt: '2026-10-10T00:00:00Z',
              },
            ],
            page: 1,
            hasMore: false,
          },
        });
      }
      if (path === '/api/operations/kiosk-applications/app-501') {
        return route.fulfill({
          json: {
            application: {
              id: 'app-501',
              packageId: 'pkg-1',
              shopName: 'Hoa Tươi Thử Nghiệm',
              packageName: 'Cơ bản',
              annualFee: 12000,
              walkInSlots: 2,
              preorderSlots: 4,
              totalSlots: 6,
              phone: '0901234567',
              contactName: 'Trần Văn A',
              contactPhone: '0901234567',
              contactEmail: 'shop@test.vn',
              installationAddress: '123 Lê Lợi',
              latitude: 10.77,
              longitude: 106.69,
              bankName: 'MB Bank',
              bankAccountSuffix: '1234',
              bankHolder: 'TRAN VAN A',
              status: 'CONFIRMED',
              assignedTechnicianId: null,
              assignedKioskId: null,
              scheduledDate: null,
              timeWindow: null,
              createdAt: '2026-10-10T00:00:00Z',
            },
            evidencePhotos: [],
          },
        });
      }
      if (path === '/api/operations/technicians') {
        return route.fulfill({ json: [] });
      }
      if (path === '/api/operations/eligible-kiosks') {
        return route.fulfill({ json: [] });
      }
      if (path === '/api/operations/kiosks/enroll' && route.request().method() === 'POST') {
        enrollCount += 1;
        const body = route.request().postDataJSON();
        expect(body.mqttClientId).toBe(enrollCount === 1 ? 'mqtt-cycle-001' : null);
        return route.fulfill({
          status: 201,
          json: {
            id: 'kiosk-' + enrollCount,
            code: body.code,
            name: body.name,
            slotCount: body.slotCount,
            status: 'OFFLINE',
            apiKey:
              enrollCount === 1 ? 'kiosk-device-api-key-FIRST' : 'kiosk-device-api-key-SECOND',
          },
        });
      }
      return route.fulfill({ json: {} });
    });

    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto('/operations/installations');

    await expect(page.getByText('Hoa Tươi Thử Nghiệm')).toBeVisible();
    await page.getByRole('button', { name: 'Chi tiết' }).click();

    // 1. First Enrollment
    await page.getByRole('button', { name: '+ Thêm tủ mới (Asset Enrollment)' }).click();
    await page.getByLabel('Mã tủ (Code) *').fill('K-CYCLE-01');
    await page.getByLabel('Tên tủ *').fill('Kiosk Chu Kỳ 1');
    await page.getByLabel('Hardware ID (Serial) *').fill('SN-CYCLE-001');
    await page.getByLabel('MQTT Client ID (nếu có)').fill('mqtt-cycle-001');
    await page.getByRole('button', { name: 'Đăng ký thiết bị (OFFLINE)' }).click();

    // Verify Modal 1 is visible
    await expect(page.getByText('Cấu hình khóa thiết bị Kiosk (API Key)')).toBeVisible();
    await expect(page.locator('#device-api-key-input')).toHaveValue('kiosk-device-api-key-FIRST');
    const copyHint = page.getByText('Đã sao chép cấu hình JSON vào bộ nhớ tạm!');
    await expect(copyHint).not.toBeVisible();

    // Copy Key 1
    await page.getByRole('button', { name: 'Sao chép cấu hình JSON' }).click();
    await expect(copyHint).toBeVisible();

    // Close Modal 1
    await page.getByRole('button', { name: 'Tôi đã sao chép khóa - Đóng bảng này' }).click();
    await expect(page.getByText('Cấu hình khóa thiết bị Kiosk (API Key)')).not.toBeVisible();

    // 2. Second Enrollment
    await page.getByRole('button', { name: '+ Thêm tủ mới (Asset Enrollment)' }).click();
    await page.getByLabel('Mã tủ (Code) *').fill('K-CYCLE-02');
    await page.getByLabel('Tên tủ *').fill('Kiosk Chu Kỳ 2');
    await page.getByLabel('Hardware ID (Serial) *').fill('SN-CYCLE-002');
    await expect(page.getByLabel('MQTT Client ID (nếu có)')).toHaveValue('');
    await page.getByRole('button', { name: 'Đăng ký thiết bị (OFFLINE)' }).click();

    // Verify Modal 2 opens with NEW key and copySuccess is reset
    await expect(page.getByText('Cấu hình khóa thiết bị Kiosk (API Key)')).toBeVisible();
    await expect(page.locator('#device-api-key-input')).toHaveValue('kiosk-device-api-key-SECOND');
    await expect(page.getByText('Đã sao chép cấu hình JSON vào bộ nhớ tạm!')).not.toBeVisible();

    // Close Modal 2
    await page.getByRole('button', { name: 'Tôi đã sao chép khóa - Đóng bảng này' }).click();
    await expect(page.getByText('Cấu hình khóa thiết bị Kiosk (API Key)')).not.toBeVisible();
  });

  test('Admin viewing operations installations has NO write buttons (strict role boundary)', async ({
    page,
  }) => {
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/auth/me') {
        return route.fulfill({
          json: {
            id: 'admin-01',
            name: 'Võ Admin',
            role: 'ADMIN',
            sellerId: null,
            sellerStatus: null,
            packageExpiresAt: null,
          },
        });
      }
      if (path === '/api/operations/kiosk-applications') {
        return route.fulfill({
          json: {
            items: [
              {
                id: 'app-1',
                shopName: 'Hoa Bách Hợp',
                packageName: 'Pro',
                annualFee: 15000,
                walkInSlots: 4,
                preorderSlots: 4,
                totalSlots: 8,
                phone: '0988776655',
                contactEmail: 'bachhop@flower.vn',
                installationAddress: '10 Hai Bà Trưng, Quận 1',
                latitude: 10.778,
                longitude: 106.701,
                bankName: 'VCB',
                bankHolder: 'LE THI C',
                bankAccountSuffix: '1122',
                status: 'PAID_REVIEW',
                createdAt: '2026-10-15T08:00:00Z',
                canVoluntaryCancel: true,
              },
            ],
            page: 1,
            hasMore: false,
          },
        });
      }
      if (path === '/api/operations/kiosk-applications/app-1') {
        return route.fulfill({
          json: {
            application: {
              id: 'app-1',
              shopName: 'Hoa Bách Hợp',
              packageName: 'Pro',
              annualFee: 15000,
              walkInSlots: 4,
              preorderSlots: 4,
              totalSlots: 8,
              phone: '0988776655',
              contactEmail: 'bachhop@flower.vn',
              installationAddress: '10 Hai Bà Trưng, Quận 1',
              latitude: 10.778,
              longitude: 106.701,
              bankName: 'VCB',
              bankHolder: 'LE THI C',
              bankAccountSuffix: '1122',
              status: 'PAID_REVIEW',
              createdAt: '2026-10-15T08:00:00Z',
              canVoluntaryCancel: true,
            },
            evidencePhotos: [],
          },
        });
      }
      return route.fulfill({ json: [] });
    });

    await page.goto('/operations/installations');

    // Admin sees monitor notice
    await expect(page.getByText('Chế độ giám sát (Admin)')).toBeVisible();

    // Click details
    await page.getByRole('button', { name: 'Chi tiết' }).click();

    // Verify operational write buttons are NOT present for Admin!
    await expect(page.getByRole('button', { name: /Xác nhận liên hệ/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Từ chối hồ sơ' })).toHaveCount(0);
  });

  test('Technician workspace: shows assigned jobs only, directions link, start visit, photo evidence upload, and report submission', async ({
    page,
  }) => {
    let jobStatus = 'SCHEDULED';
    const attachedPhotos: { id: string; reference: string }[] = [];

    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;

      if (path === '/api/auth/me') {
        return route.fulfill({
          json: {
            id: 'tech-99',
            name: 'Lê Kỹ Thuật',
            role: 'TECHNICIAN',
            sellerId: null,
            sellerStatus: null,
            packageExpiresAt: null,
          },
        });
      }

      if (path === '/api/staff/kiosk-installations') {
        return route.fulfill({
          json: [
            {
              id: 'job-101',
              shopName: 'Tiệm Hoa Hồng Đỏ',
              phone: '0903334445',
              contactEmail: 'hongdo@gmail.com',
              installationAddress: '88 Nguyễn Trãi, Phường 3, Quận 5',
              latitude: 10.758,
              longitude: 106.678,
              kioskCode: 'K-Q5-01',
              scheduledDate: '2026-10-18',
              timeWindow: '09:00 - 12:00',
              status: jobStatus,
              reworkReason: null,
            },
          ],
        });
      }

      if (path === '/api/staff/kiosk-installations/job-101') {
        return route.fulfill({
          json: {
            id: 'job-101',
            shopName: 'Tiệm Hoa Hồng Đỏ',
            phone: '0903334445',
            contactEmail: 'hongdo@gmail.com',
            installationAddress: '88 Nguyễn Trãi, Phường 3, Quận 5',
            latitude: 10.758,
            longitude: 106.678,
            kioskCode: 'K-Q5-01',
            scheduledDate: '2026-10-18',
            timeWindow: '09:00 - 12:00',
            status: jobStatus,
            reworkReason: null,
          },
        });
      }

      if (path.endsWith('/start') && route.request().method() === 'POST') {
        jobStatus = 'INSTALLING';
        return route.fulfill({
          json: {
            id: 'job-101',
            shopName: 'Tiệm Hoa Hồng Đỏ',
            status: 'INSTALLING',
          },
        });
      }

      if (path.endsWith('/evidence/upload') && route.request().method() === 'POST') {
        return route.fulfill({
          json: {
            reference: 'evidence:v1:valid-actual-ticket-token-888',
          },
        });
      }

      if (path.endsWith('/evidence') && route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        attachedPhotos.push({ id: body.id, reference: body.reference });
        return route.fulfill({ json: { success: true } });
      }

      if (path.endsWith('/evidence') && route.request().method() === 'GET') {
        return route.fulfill({
          json: attachedPhotos.map((p) => ({
            id: p.id,
            reference: p.reference,
            createdAt: new Date().toISOString(),
          })),
        });
      }

      if (path.endsWith('/submit') && route.request().method() === 'POST') {
        jobStatus = 'AWAITING_HANDOVER';
        return route.fulfill({
          json: {
            id: 'job-101',
            shopName: 'Tiệm Hoa Hồng Đỏ',
            status: 'AWAITING_HANDOVER',
          },
        });
      }

      return route.fulfill({ json: [] });
    });

    await page.goto('/technician/installations');

    await expect(page.locator('#job-detail-title')).toHaveText('Tiệm Hoa Hồng Đỏ');
    await expect(page.locator('.tech-contact-box')).toContainText('88 Nguyễn Trãi');

    // Verify Google Maps directions link
    const directionsLink = page.getByRole('link', { name: 'Chỉ đường Google Maps' });
    await expect(directionsLink).toBeVisible();
    await expect(directionsLink).toHaveAttribute('href', /google\.com\/maps\/dir/);

    // Start visit
    await page.getByRole('button', { name: /Bắt đầu khảo sát & Lắp đặt/ }).click();
    await expect(page.getByText('Đã bắt đầu công việc tại điểm: Tiệm Hoa Hồng Đỏ')).toBeVisible();

    // Upload Photo Evidence (PNG simulation)
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'kiosk-photo.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-png-binary-data'),
    });

    await page.getByRole('button', { name: 'Tải ảnh lên' }).click();
    await expect(
      page.getByText('Đã tải lên và đính kèm ảnh kiosk-photo.png thành công.'),
    ).toBeVisible();

    // Submit Report
    await page
      .getByLabel('Nội dung báo cáo chi tiết:')
      .fill('Đã kết nối nguồn điện ổn định, khóa tủ hoạt động bình thường.');
    await page.getByRole('button', { name: /Nộp báo cáo hoàn thành/ }).click();
    await expect(page.getByText('Đã nộp báo cáo thành công!')).toBeVisible();
  });

  test('Admin manual refund: queue with masked bank, two-step separation of duty, and approve/confirm payout', async ({
    page,
  }) => {
    let refundApprovedBy: string | null = null;
    let refundStatus = 'REFUND_PENDING';

    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;

      if (path === '/api/auth/me') {
        return route.fulfill({
          json: {
            id: 'admin-02',
            name: 'Đặng Admin Chi Trả',
            role: 'ADMIN',
            sellerId: null,
            sellerStatus: null,
            packageExpiresAt: null,
          },
        });
      }

      if (path === '/api/admin/kiosk-applications/refunds') {
        return route.fulfill({
          json:
            refundStatus === 'REFUNDED'
              ? []
              : [
                  {
                    id: 'ref-100',
                    shopName: 'Hoa Sen Trắng',
                    amount: 15000,
                    bankName: 'Techcombank',
                    bankHolder: 'HOANG THI D',
                    bankAccountSuffix: '5566',
                    refundReason: 'Khách hủy trước khi xác nhận',
                    status: refundStatus,
                    refundApprovedBy,
                    createdAt: '2026-10-15T08:00:00Z',
                  },
                ],
        });
      }

      if (path.endsWith('/refund/approve') && route.request().method() === 'POST') {
        refundApprovedBy = 'admin-01'; // Approved by Admin 1
        return route.fulfill({ json: { success: true } });
      }

      if (path.endsWith('/refund/bank-details') && route.request().method() === 'POST') {
        return route.fulfill({
          json: {
            bankName: 'Techcombank',
            holder: 'HOANG THI D',
            accountNumber: '1903001234567',
          },
        });
      }

      if (path.endsWith('/refund/evidence/upload') && route.request().method() === 'POST') {
        return route.fulfill({
          json: {
            reference: 'evidence:v1:admin-proof-ref-888',
          },
        });
      }

      if (path.endsWith('/refund/confirm') && route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        expect(body.reference).toBe('TCB-FT-991288');
        expect(body.evidenceReference).toBe('evidence:v1:admin-proof-ref-888');
        refundStatus = 'REFUNDED';
        return route.fulfill({ json: { success: true } });
      }

      return route.fulfill({ json: [] });
    });

    await page.goto('/admin/kiosk-refunds');

    await expect(page.getByText('Hoa Sen Trắng')).toBeVisible();
    await expect(page.getByText('15.000 đ')).toBeVisible();
    await expect(page.getByText('****5566 (HOANG THI D)')).toBeVisible();

    // Open detail
    await page.getByRole('button', { name: 'Xử lý' }).click();

    // Step 1: Approve
    await page.getByRole('button', { name: 'Phê duyệt hoàn tiền (Bước 1)' }).click();
    await expect(page.getByText('Đã phê duyệt hoàn tiền (Bước 1)')).toBeVisible();

    // Step 2: Reveal full recipient bank account
    await page.getByRole('button', { name: 'Xem số tài khoản đầy đủ để chuyển tiền' }).click();
    await expect(page.getByText('1903001234567')).toBeVisible();

    // Upload proof receipt
    const proofInput = page.locator('#proof-file-input');
    await proofInput.setInputFiles({
      name: 'bank-receipt.png',
      mimeType: 'image/png',
      buffer: Buffer.from('fake-bank-transfer-receipt'),
    });
    await page.getByRole('button', { name: 'Tải chứng từ' }).click();
    await expect(page.getByText(/Đã có mã chứng từ:/)).toBeVisible();

    // Confirm payout with transfer reference
    await page.getByLabel('Mã giao dịch ngân hàng / Mã chuẩn chi *').fill('TCB-FT-991288');
    await page.getByRole('button', { name: /Xác nhận đã chuyển khoản/ }).click();

    await expect(page.getByText(/Đã ghi nhận chuyển khoản hoàn tiền thành công/)).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Không có yêu cầu hoàn tiền nào đang chờ' }),
    ).toBeVisible();
    await expect(page.getByText('1903001234567')).toHaveCount(0);
  });
});

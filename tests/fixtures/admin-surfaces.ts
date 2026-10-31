import type { Page } from '@playwright/test';

export const adminApplication = {
  id: 'ui-lease',
  customerId: 'ui-customer',
  packageId: 'ui-package',
  packageName: 'Trial',
  annualFee: 10000,
  totalSlots: 2,
  shopName: 'Shop kiểm thử giao diện',
  phone: '0901234567',
  contactEmail: 'shop@example.test',
  installationAddress: 'Địa chỉ kiểm thử giao diện',
  latitude: 10.78,
  longitude: 106.69,
  bankName: 'Test Bank',
  bankHolder: 'TEST HOLDER',
  bankAccountSuffix: '1234',
  status: 'SCHEDULED',
  reviewNote: null,
  createdAt: '2026-10-31T01:00:00Z',
  updatedAt: '2026-10-31T01:00:00Z',
};
const manager = {
  id: 'ui-manager',
  fullName: 'Quản lý kiểm thử',
  email: 'manager@example.test',
  phone: '0901234567',
  status: 'ACTIVE',
  role: 'OPERATIONS_MANAGER',
  createdAt: '2026-10-10T00:00:00Z',
};
const seller = {
  id: 'ui-shop',
  shopName: 'Shop kiểm thử giao diện',
  phone: '0901234567',
  address: 'Địa chỉ shop',
  status: 'ACTIVE',
  packageId: null,
  packageExpiresAt: null,
};
const incident = {
  id: 'ui-incident',
  kind: 'DEVICE_FAULT',
  status: 'OPEN',
  reason: 'Cửa tủ cần kiểm tra',
  createdAt: '2026-10-31T02:00:00Z',
  resolvedAt: null,
  decision: null,
  kioskId: 'ui-kiosk',
  orderId: null,
  slotId: null,
  location: { kioskName: 'Tủ kiểm thử', address: 'Địa chỉ tủ' },
  slot: null,
};

export async function setupAdminSurfaces(page: Page) {
  const model = {
    empty: false,
    fail: new Set<string>(),
    writes: [] as { path: string; body: unknown }[],
  };
  await page.route('**/hub/**', (route) => route.fulfill({ status: 503 }));
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const path = url.pathname.replace(/^\/api/, '');
    if (model.fail.has(path))
      return route.fulfill({ status: 503, json: { detail: 'Dịch vụ kiểm thử tạm gián đoạn' } });
    if (req.method() !== 'GET') {
      const body = req.postDataJSON();
      model.writes.push({ path, body });
      if (path === '/admin/flows/reconcile_gateway') return route.fulfill({ json: { result: [] } });
      if (path === '/admin/flows/reconcile_daily')
        return route.fulfill({
          json: {
            result: [
              {
                muc: 'Tiền vào VietQR (đơn + phí gói)',
                chung_tu: 150000,
                so_cai: 150000,
                lech: 0,
                ghi_chu: '',
              },
            ],
          },
        });
      return route.fulfill({ status: 405, json: {} });
    }
    const list = (items: unknown[]) => (model.empty ? [] : items);
    const paged = (items: unknown[]) => ({ items: list(items), page: 1, hasMore: false });
    if (path === '/auth/me')
      return route.fulfill({
        json: { id: 'ui-admin', name: 'Admin kiểm thử', role: 'ADMIN', sellerId: null },
      });
    if (path === '/admin/managers') return route.fulfill({ json: list([manager]) });
    if (path === '/admin/accounts')
      return route.fulfill({
        json: paged([{ ...manager, role: 'OPERATIONS_MANAGER', bank: null }]),
      });
    if (path === '/admin/sellers') return route.fulfill({ json: list([seller]) });
    if (path === '/packages') return route.fulfill({ json: [] });
    if (path === '/admin/kiosks')
      return route.fulfill({
        json: list([
          {
            id: 'ui-kiosk',
            code: 'K-UI-01',
            name: 'Tủ kiểm thử',
            status: 'OFFLINE',
            sellerId: null,
            sellerName: null,
            slotCount: 2,
          },
        ]),
      });
    if (path === '/admin/slots') return route.fulfill({ json: [] });
    if (path === '/admin/incidents') return route.fulfill({ json: paged([incident]) });
    if (path === '/admin/incidents/ui-incident')
      return route.fulfill({ json: { incident, evidence: { items: [], hasMore: false } } });
    if (path === '/admin/staff-tasks')
      return route.fulfill({
        json: paged([
          {
            id: 'ui-task',
            kind: 'INCIDENT',
            kioskName: 'Tủ kiểm thử',
            assigneeName: 'Kỹ thuật viên kiểm thử',
            assigneeId: 'ui-tech',
            status: 'SUBMITTED',
            version: 1,
            instructions: 'Kiểm tra tại hiện trường',
            address: 'Địa chỉ tủ',
            shopName: 'Shop kiểm thử',
            report: 'Báo cáo đã gửi',
          },
        ]),
      });
    if (path === '/admin/preorders')
      return route.fulfill({
        json: paged([
          {
            id: 'ui-order',
            orderCode: 'UI-ORDER',
            kind: 'CATALOG',
            productName: 'Mẫu hoa kiểm thử',
            kioskName: 'Tủ kiểm thử',
            kioskId: 'ui-kiosk',
            sellerId: 'ui-shop',
            state: 'REQUESTED',
            orderStatus: null,
            pickupAt: '2026-11-02T02:00:00Z',
            pickupBefore: '2026-11-02T05:00:00Z',
            quotedPrice: null,
            ready: false,
          },
        ]),
      });
    if (path === '/admin/complaints')
      return route.fulfill({
        json: paged([
          {
            id: 'ui-complaint',
            orderId: 'ui-order',
            orderCode: 'UI-ORDER',
            orderTotal: 150000,
            createdAt: '2026-10-31T02:00:00Z',
            status: 'OPEN',
            reason: 'Yêu cầu kiểm tra đơn',
          },
        ]),
      });
    if (path === '/admin/refunds')
      return route.fulfill({
        json: paged([
          {
            id: 'ui-refund',
            orderId: 'ui-order',
            orderCode: 'UI-ORDER',
            amount: 150000,
            status: 'PENDING',
            reason: 'Kiểm thử giao diện',
            requiresApproval: true,
            createdAt: '2026-10-31T02:00:00Z',
            approvedBy: null,
            paidBy: null,
            paidAt: null,
          },
        ]),
      });
    if (path === '/admin/withdrawals')
      return route.fulfill({
        json: paged([
          {
            id: 'ui-withdrawal',
            sellerId: 'ui-shop',
            shopName: 'Shop kiểm thử',
            amount: 150000,
            status: 'PENDING',
            createdAt: '2026-10-31T02:00:00Z',
          },
        ]),
      });
    if (path === '/admin/kiosk-applications/refunds')
      return route.fulfill({
        json: list([
          {
            id: 'ui-kiosk-refund',
            shopName: 'Shop kiểm thử',
            amount: 10000,
            bankName: 'Test Bank',
            bankHolder: 'TEST HOLDER',
            bankAccountSuffix: '1234',
            refundReason: 'Khách hủy yêu cầu thuê',
            status: 'REFUND_PENDING',
            refundApprovedBy: null,
            createdAt: '2026-10-31T02:00:00Z',
          },
        ]),
      });
    if (path === '/operations/kiosk-applications')
      return route.fulfill({ json: paged([adminApplication]) });
    if (path === '/operations/kiosk-applications/ui-lease')
      return route.fulfill({ json: { application: adminApplication, evidencePhotos: [] } });
    if (path.startsWith('/admin/reports/'))
      return route.fulfill({
        json: list([
          {
            hang_cho: 'Hoàn tiền',
            so_luong: 2,
            ngay: '2026-10-31',
            kiosk: 'K-UI-01',
            so_don: 1,
            gmv: '150000',
            giam_do_diem: 0,
            thang: '2026-10',
            doanh_thu_phi_goi: '10000',
            kiosk_id: 'K-UI-01',
            source: 'WEB',
            so_khao_sat: 2,
            so_mua: 1,
            ty_le_mua: 50,
            latency_tb_ms: 300,
          },
        ]),
      });
    return route.fulfill({ status: 501, json: { detail: 'API chưa được giả lập trong test' } });
  });
  return model;
}
